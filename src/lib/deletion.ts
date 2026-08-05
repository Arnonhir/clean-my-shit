export interface Deletable {
  id: string;
  name: string;
  parentHandle: FileSystemDirectoryHandle;
  recursive?: boolean;
}

export interface DeleteOutcome {
  succeeded: Deletable[];
  failed: { item: Deletable; error: string; blocked: boolean }[];
}

const BLOCKED_FOLDER_MESSAGE =
  "Chrome blocks websites from deleting directly inside this folder (it does this for Downloads, Desktop, Documents, and a few other special folders, so a site can't quietly get broad delete access). Delete this one yourself in File Explorer, or scan a subfolder instead of the whole folder.";

export async function deleteAll(items: Deletable[]): Promise<DeleteOutcome> {
  const succeeded: Deletable[] = [];
  const failed: { item: Deletable; error: string; blocked: boolean }[] = [];

  // Only ask for write permission once per folder, not once per file.
  const permissionCache = new Map<FileSystemDirectoryHandle, boolean>();

  async function canWrite(handle: FileSystemDirectoryHandle): Promise<boolean> {
    const cached = permissionCache.get(handle);
    if (cached !== undefined) return cached;

    let granted = false;
    try {
      let state = (await handle.queryPermission?.({ mode: "readwrite" })) ?? "prompt";
      if (state !== "granted") {
        state = (await handle.requestPermission?.({ mode: "readwrite" })) ?? "denied";
      }
      granted = state === "granted";
    } catch {
      granted = false;
    }
    permissionCache.set(handle, granted);
    return granted;
  }

  for (const item of items) {
    const writable = await canWrite(item.parentHandle);
    if (!writable) {
      failed.push({ item, error: BLOCKED_FOLDER_MESSAGE, blocked: true });
      continue;
    }
    try {
      await item.parentHandle.removeEntry(item.name, {
        recursive: !!item.recursive,
      });
      succeeded.push(item);
    } catch (err) {
      failed.push({
        item,
        error: err instanceof Error ? err.message : String(err),
        blocked: false,
      });
    }
  }

  return { succeeded, failed };
}
