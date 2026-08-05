export interface Deletable {
  id: string;
  name: string;
  parentHandle: FileSystemDirectoryHandle;
  recursive?: boolean;
}

export interface DeleteOutcome {
  succeeded: Deletable[];
  failed: { item: Deletable; error: string }[];
}

export async function deleteAll(items: Deletable[]): Promise<DeleteOutcome> {
  const succeeded: Deletable[] = [];
  const failed: { item: Deletable; error: string }[] = [];

  for (const item of items) {
    try {
      await item.parentHandle.removeEntry(item.name, {
        recursive: !!item.recursive,
      });
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
