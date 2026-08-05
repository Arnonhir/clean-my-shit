import trash from "trash";
import type { DeleteRequestItem } from "./types";

export interface DeleteOutcome {
  succeeded: DeleteRequestItem[];
  failed: { item: DeleteRequestItem; error: string }[];
}

// Runs server-side against the real filesystem, so there's no browser
// permission model to deal with — just delete the path. Uses the Recycle
// Bin rather than a permanent delete, so mistakes are recoverable.
export async function deleteAll(items: DeleteRequestItem[]): Promise<DeleteOutcome> {
  if (items.length === 0) return { succeeded: [], failed: [] };

  try {
    // One batched call instead of one call per file — each call to trash()
    // shells out (e.g. to PowerShell on Windows), and that spawn overhead
    // dominates completely once you're deleting hundreds of files: doing it
    // one at a time turns a sub-second delete into several minutes.
    await trash(items.map((i) => i.absPath));
    return { succeeded: items, failed: [] };
  } catch {
    // Something in the batch failed - fall back to one at a time, just for
    // this rare path, so we can report which items actually succeeded
    // instead of failing the whole selection over one bad item.
    const succeeded: DeleteRequestItem[] = [];
    const failed: { item: DeleteRequestItem; error: string }[] = [];
    for (const item of items) {
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
