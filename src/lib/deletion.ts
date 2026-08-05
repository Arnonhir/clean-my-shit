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
