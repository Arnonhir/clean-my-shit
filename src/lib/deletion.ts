import { promises as fs } from "node:fs";
import trash from "trash";
import type { DeleteRequestItem } from "./types";

export interface DeleteOutcome {
  succeeded: DeleteRequestItem[];
  failed: { item: DeleteRequestItem; error: string }[];
}

// Deleting one file at a time was the original design, but each call to
// trash() shells out (e.g. to PowerShell on Windows), and that spawn
// overhead dominates completely past a few dozen files — turning what
// should be instant into multiple minutes. Chunking keeps almost all of
// that speedup (one spawn per 100 files instead of one per file) while
// still reporting progress often enough for a meaningful progress bar.
const CHUNK_SIZE = 100;

// trash() shells out to a helper process, and a single problematic path (a
// file locked in a way Windows doesn't fail fast on, an unresponsive cloud-
// sync placeholder) can leave that call hanging indefinitely. Without a cap,
// one stuck item stalls every chunk queued after it - the operation never
// reaches "done", nothing past that point ever gets attempted, and the user
// sees no error at all, just files that were supposedly deleted but weren't.
// Bounding each attempt guarantees the loop always keeps moving.
const CHUNK_TIMEOUT_MS = 20_000;
const ITEM_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

// trash() resolving without throwing turned out not to be reliable proof
// the file is actually gone - it's been observed reporting success on a
// path that's still there afterward (a cloud-only OneDrive placeholder or a
// file locked by another program are the likely culprits, but either way
// the library can't be trusted blindly). Checking the filesystem directly
// afterward is the only way to report what actually happened.
async function stillExists(absPath: string): Promise<boolean> {
  return fs.stat(absPath).then(
    () => true,
    () => false
  );
}

async function deleteChunk(chunk: DeleteRequestItem[]): Promise<DeleteOutcome> {
  try {
    await withTimeout(trash(chunk.map((i) => i.absPath)), CHUNK_TIMEOUT_MS);
  } catch {
    // Something in the batch threw or timed out - retry one at a time just
    // for this chunk, so a single bad item doesn't take the rest down with
    // it. Whether these succeed, throw, or time out again, the existence
    // check below is what actually decides success/failure either way.
    for (const item of chunk) {
      try {
        await withTimeout(trash([item.absPath]), ITEM_TIMEOUT_MS);
      } catch {
        // leave it - reported as failed below if it's still on disk
      }
    }
  }

  const succeeded: DeleteRequestItem[] = [];
  const failed: { item: DeleteRequestItem; error: string }[] = [];
  for (const item of chunk) {
    if (await stillExists(item.absPath)) {
      failed.push({
        item,
        error:
          "Still on disk after deletion - it may be open in another program, a cloud-only OneDrive file, or protected.",
      });
    } else {
      succeeded.push(item);
    }
  }
  return { succeeded, failed };
}

// Runs server-side against the real filesystem, so there's no browser
// permission model to deal with — just delete the path. Uses the Recycle
// Bin rather than a permanent delete, so mistakes are recoverable.
export async function deleteAll(
  items: DeleteRequestItem[],
  onProgress?: (done: number, total: number) => void
): Promise<DeleteOutcome> {
  if (items.length === 0) return { succeeded: [], failed: [] };

  const succeeded: DeleteRequestItem[] = [];
  const failed: { item: DeleteRequestItem; error: string }[] = [];

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const outcome = await deleteChunk(chunk);
    succeeded.push(...outcome.succeeded);
    failed.push(...outcome.failed);
    onProgress?.(succeeded.length + failed.length, items.length);
  }

  return { succeeded, failed };
}
