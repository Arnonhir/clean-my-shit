import { promises as fs } from "node:fs";
import * as crypto from "node:crypto";
import { FULL_HASH_CAP_BYTES, QUICK_HASH_CHUNK_BYTES } from "./patterns";
import type { DuplicateGroup, ScannedFile, ScanProgress } from "./types";

async function readChunk(absPath: string, start: number, length: number): Promise<Buffer> {
  const handle = await fs.open(absPath, "r");
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buf, 0, length, start);
    return bytesRead === length ? buf : buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function sha256Hex(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// Fast fingerprint: first + last chunk of the file, so files that only differ
// near the end (common in videos with identical headers) don't false-match.
async function quickFingerprint(file: ScannedFile): Promise<string> {
  if (file.size <= QUICK_HASH_CHUNK_BYTES * 2) {
    const buf = await readChunk(file.absPath, 0, file.size);
    return sha256Hex(buf);
  }
  const head = await readChunk(file.absPath, 0, QUICK_HASH_CHUNK_BYTES);
  const tail = await readChunk(
    file.absPath,
    file.size - QUICK_HASH_CHUNK_BYTES,
    QUICK_HASH_CHUNK_BYTES
  );
  return sha256Hex(Buffer.concat([head, tail]));
}

async function fullHash(file: ScannedFile): Promise<string> {
  const hash = crypto.createHash("sha256");
  const fileHandle = await fs.open(file.absPath, "r");
  const stream = fileHandle.createReadStream();
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => hash.update(chunk as Buffer));
    stream.on("end", () => {
      fileHandle.close();
      resolve(hash.digest("hex"));
    });
    stream.on("error", (err) => {
      fileHandle.close();
      reject(err);
    });
  });
}

export async function findDuplicates(
  files: ScannedFile[],
  onProgress: (p: Partial<ScanProgress>) => void
): Promise<DuplicateGroup[]> {
  // Only files that share an exact size can possibly be duplicates.
  const bySize = new Map<number, ScannedFile[]>();
  for (const f of files) {
    if (f.size === 0) continue; // empty files aren't interesting duplicates
    const bucket = bySize.get(f.size);
    if (bucket) bucket.push(f);
    else bySize.set(f.size, [f]);
  }

  const candidates = [...bySize.values()].filter((group) => group.length > 1);
  const groups: DuplicateGroup[] = [];
  let processed = 0;

  for (const group of candidates) {
    const byFingerprint = new Map<string, ScannedFile[]>();
    for (const f of group) {
      let fp: string;
      try {
        fp = await quickFingerprint(f);
      } catch {
        continue; // file vanished/unreadable mid-scan
      }
      const bucket = byFingerprint.get(fp);
      if (bucket) bucket.push(f);
      else byFingerprint.set(fp, [f]);

      processed++;
      if (processed % 10 === 0) {
        onProgress({ phase: "hashing", filesScanned: processed });
      }
    }

    for (const fpGroup of byFingerprint.values()) {
      if (fpGroup.length < 2) continue;

      const size = fpGroup[0].size;
      if (size <= FULL_HASH_CAP_BYTES) {
        // Verify with a full content hash — cheap enough at this size, and
        // deletion is irreversible so it's worth being certain.
        const byFullHash = new Map<string, ScannedFile[]>();
        for (const f of fpGroup) {
          const h = await fullHash(f);
          const bucket = byFullHash.get(h);
          if (bucket) bucket.push(f);
          else byFullHash.set(h, [f]);
        }
        for (const confirmed of byFullHash.values()) {
          if (confirmed.length > 1) {
            groups.push({
              id: confirmed.map((f) => f.id).join("|"),
              size,
              verified: true,
              files: confirmed.sort((a, b) => a.lastModified - b.lastModified),
            });
          }
        }
      } else {
        // Too large to fully re-read comfortably — same size + matching
        // head/tail is very likely a duplicate, but flag as unverified.
        groups.push({
          id: fpGroup.map((f) => f.id).join("|"),
          size,
          verified: false,
          files: fpGroup.sort((a, b) => a.lastModified - b.lastModified),
        });
      }
    }
  }

  return groups.sort((a, b) => b.size * b.files.length - a.size * a.files.length);
}
