// Wraps Node's real filesystem behind the same shape the app's scan.ts /
// deletion.ts code expects from the browser's File System Access API (kind,
// entries(), getFile(), removeEntry(), queryPermission/requestPermission).
// This lets the exact same scanning AND deletion code run against a real
// folder from a plain Node script — no browser, and none of the browser's
// "can't touch Downloads/Desktop/Documents" restriction, since Node just
// uses the real filesystem directly.

import { promises as fs } from "node:fs";
import * as path from "node:path";

class NodeLazyBlob {
  constructor(
    private filePath: string,
    private start: number,
    private end: number
  ) {}

  get size() {
    return this.end - this.start;
  }

  slice(start = 0, end = this.size): NodeLazyBlob {
    return new NodeLazyBlob(this.filePath, this.start + start, this.start + end);
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const length = this.end - this.start;
    if (length === 0) return new ArrayBuffer(0);
    const handle = await fs.open(this.filePath, "r");
    try {
      const buf = Buffer.alloc(length);
      await handle.read(buf, 0, length, this.start);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } finally {
      await handle.close();
    }
  }
}

export class NodeFileHandle {
  kind = "file" as const;
  name: string;
  private filePath: string;
  private statCache: { size: number; mtimeMs: number } | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.name = path.basename(filePath);
  }

  async getFile() {
    if (!this.statCache) {
      const st = await fs.stat(this.filePath);
      this.statCache = { size: st.size, mtimeMs: st.mtimeMs };
    }
    const blob = new NodeLazyBlob(this.filePath, 0, this.statCache.size);
    const { size, mtimeMs } = this.statCache;
    const name = this.name;
    return {
      size,
      lastModified: mtimeMs,
      name,
      slice: (start?: number, end?: number) => blob.slice(start, end),
      arrayBuffer: () => blob.arrayBuffer(),
    };
  }
}

export class NodeDirectoryHandle {
  kind = "directory" as const;
  name: string;
  private dirPath: string;
  private allowDelete: boolean;

  constructor(dirPath: string, name?: string, allowDelete = false) {
    this.dirPath = dirPath;
    this.name = name ?? path.basename(dirPath);
    this.allowDelete = allowDelete;
  }

  // Always "granted" — Node has real filesystem access already, there's no
  // browser-style permission prompt to model here.
  async queryPermission(): Promise<"granted"> {
    return "granted";
  }
  async requestPermission(): Promise<"granted"> {
    return "granted";
  }

  async *entries(): AsyncGenerator<[string, NodeFileHandle | NodeDirectoryHandle]> {
    let dirents;
    try {
      dirents = await fs.readdir(this.dirPath, { withFileTypes: true });
    } catch (err) {
      console.warn(`  [skip unreadable folder] ${this.dirPath}: ${(err as Error).message}`);
      return;
    }
    for (const d of dirents) {
      const full = path.join(this.dirPath, d.name);
      if (d.isSymbolicLink()) continue; // avoid following symlink loops
      if (d.isDirectory()) {
        yield [d.name, new NodeDirectoryHandle(full, d.name, this.allowDelete)];
      } else if (d.isFile()) {
        yield [d.name, new NodeFileHandle(full)];
      }
    }
  }

  async removeEntry(name: string, options?: { recursive?: boolean }): Promise<void> {
    if (!this.allowDelete) {
      throw new Error(
        "removeEntry is disabled (this scan was opened read-only — pass allowDelete to enable it)"
      );
    }
    const { default: trash } = await import("trash");
    const full = path.join(this.dirPath, name);
    await trash([full]);
    void options;
  }
}
