import {
  BIG_FILE_THRESHOLD_BYTES,
  CACHE_TEMP_DIR_PATTERN,
  CACHE_TEMP_EXTS,
  DEV_JUNK_DIR_NAMES,
  DOWNLOAD_DIR_PATTERN,
  GAME_LIBRARY_DIR_NAMES,
  INSTALLER_EXTS,
  ONE_YEAR_MS,
  extOf,
} from "./patterns";
import type {
  EmptyFolder,
  FolderAggregate,
  ScanProgress,
  ScannedFile,
  ScanResults,
} from "./types";
import { findDuplicates } from "./duplicates";

interface WalkContext {
  files: ScannedFile[];
  emptyFolders: EmptyFolder[];
  devJunk: FolderAggregate[];
  games: FolderAggregate[];
  onProgress: (p: Partial<ScanProgress>) => void;
  fileCounter: { n: number };
  folderCounter: { n: number };
}

// Sums up size/count/newest-file for a folder we're treating as one unit,
// without keeping every individual file around.
async function summarizeFolder(
  handle: FileSystemDirectoryHandle,
  path: string
): Promise<{ size: number; fileCount: number; lastModified: number }> {
  let size = 0;
  let fileCount = 0;
  let lastModified = 0;
  for await (const [, child] of handle.entries()) {
    if (child.kind === "file") {
      const file = await (child as FileSystemFileHandle).getFile();
      size += file.size;
      fileCount += 1;
      if (file.lastModified > lastModified) lastModified = file.lastModified;
    } else {
      const sub = await summarizeFolder(
        child as FileSystemDirectoryHandle,
        path
      );
      size += sub.size;
      fileCount += sub.fileCount;
      if (sub.lastModified > lastModified) lastModified = sub.lastModified;
    }
  }
  return { size, fileCount, lastModified };
}

async function walk(
  dirHandle: FileSystemDirectoryHandle,
  path: string,
  parentIsGameLibrary: boolean,
  ctx: WalkContext
) {
  let entryCount = 0;

  for await (const [name, handle] of dirHandle.entries()) {
    entryCount++;

    if (handle.kind === "directory") {
      const dirHandleTyped = handle as FileSystemDirectoryHandle;
      const lowerName = name.toLowerCase();
      const childPath = path ? `${path}/${name}` : name;

      ctx.folderCounter.n++;
      if (ctx.folderCounter.n % 20 === 0) {
        ctx.onProgress({
          foldersScanned: ctx.folderCounter.n,
          currentPath: childPath,
        });
      }

      if (DEV_JUNK_DIR_NAMES.has(lowerName)) {
        const summary = await summarizeFolder(dirHandleTyped, childPath);
        if (summary.fileCount > 0) {
          ctx.devJunk.push({
            id: childPath,
            name,
            path: childPath,
            size: summary.size,
            fileCount: summary.fileCount,
            lastModified: summary.lastModified,
            parentHandle: dirHandle,
          });
        }
        continue;
      }

      if (parentIsGameLibrary) {
        // This directory IS a game install — summarize, don't recurse further.
        const summary = await summarizeFolder(dirHandleTyped, childPath);
        if (summary.fileCount > 0) {
          ctx.games.push({
            id: childPath,
            name,
            path: childPath,
            size: summary.size,
            fileCount: summary.fileCount,
            lastModified: summary.lastModified,
            parentHandle: dirHandle,
          });
        }
        continue;
      }

      const childIsGameLibrary = GAME_LIBRARY_DIR_NAMES.has(lowerName);
      await walk(dirHandleTyped, childPath, childIsGameLibrary, ctx);
      continue;
    }

    // File
    const fileHandle = handle as FileSystemFileHandle;
    const file = await fileHandle.getFile();
    const childPath = path ? `${path}/${name}` : name;

    ctx.files.push({
      id: childPath,
      name,
      path: childPath,
      size: file.size,
      lastModified: file.lastModified,
      ext: extOf(name),
      handle: fileHandle,
      parentHandle: dirHandle,
    });

    ctx.fileCounter.n++;
    if (ctx.fileCounter.n % 25 === 0) {
      ctx.onProgress({
        filesScanned: ctx.fileCounter.n,
        currentPath: childPath,
      });
    }
  }

  if (entryCount === 0 && path !== "") {
    ctx.emptyFolders.push({
      id: path,
      name: path.split("/").pop() || path,
      path,
      parentHandle: dirHandle,
    });
  }
}

export async function scanFolder(
  rootHandle: FileSystemDirectoryHandle,
  onProgress: (p: Partial<ScanProgress>) => void
): Promise<ScanResults> {
  const ctx: WalkContext = {
    files: [],
    emptyFolders: [],
    devJunk: [],
    games: [],
    onProgress,
    fileCounter: { n: 0 },
    folderCounter: { n: 0 },
  };

  onProgress({ phase: "walking", filesScanned: 0, foldersScanned: 0 });
  await walk(rootHandle, "", false, ctx);

  onProgress({ phase: "hashing" });
  const duplicates = await findDuplicates(ctx.files, onProgress);

  const now = Date.now();
  const oldFiles = ctx.files
    .filter((f) => now - f.lastModified > ONE_YEAR_MS)
    .sort((a, b) => a.lastModified - b.lastModified);

  const bigFiles = ctx.files
    .filter((f) => f.size > BIG_FILE_THRESHOLD_BYTES)
    .sort((a, b) => b.size - a.size);

  const cacheTemp = ctx.files.filter(
    (f) =>
      CACHE_TEMP_DIR_PATTERN.test(f.path) || CACHE_TEMP_EXTS.has(f.ext)
  );

  const installers = ctx.files.filter(
    (f) => INSTALLER_EXTS.has(f.ext) && DOWNLOAD_DIR_PATTERN.test(f.path)
  );

  const totalBytes = ctx.files.reduce((sum, f) => sum + f.size, 0);

  onProgress({ phase: "done" });

  return {
    rootName: rootHandle.name,
    totalFiles: ctx.files.length,
    totalBytes,
    oldFiles,
    bigFiles,
    cacheTemp,
    installers,
    emptyFolders: ctx.emptyFolders,
    devJunk: ctx.devJunk,
    unplayedGames: ctx.games,
    duplicates,
  };
}
