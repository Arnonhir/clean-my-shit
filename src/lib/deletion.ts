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

async function deleteChunk(chunk: DeleteRequestItem[]): Promise<DeleteOutcome> {
  try {
    await trash(chunk.map((i) => i.absPath));
    return { succeeded: chunk, failed: [] };
  } catch {
    // Something in the batch failed - fall back to one at a time, just for
    // this chunk, so a single bad item doesn't take the rest down with it.
    const succeeded: DeleteRequestItem[] = [];
    const failed: { item: DeleteRequestItem; error: string }[] = [];
    for (const item of chunk) {
      try {
        await trash([item.absPath]);
        succeeded.push(item);
      } catch (err) {
        failed.push({
          item,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return { succeeded, failed };
  }
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
