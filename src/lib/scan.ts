import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  BIG_FILE_THRESHOLD_BYTES,
  CACHE_TEMP_DIR_PATTERN,
  CACHE_TEMP_EXTS,
  DEV_JUNK_DIR_NAMES,
  DOCUMENT_EXTS,
  DOWNLOAD_DIR_PATTERN,
  GAME_LIBRARY_DIR_NAMES,
  INSTALLER_EXTS,
  ONE_YEAR_MS,
  RECENT_INSTALLER_MS,
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
  rootPath: string;
}

// Sums up size/count/newest-file for a folder we're treating as one unit,
// without keeping every individual file around.
async function summarizeFolder(
  absDir: string
): Promise<{ size: number; fileCount: number; lastModified: number }> {
  let size = 0;
  let fileCount = 0;
  let lastModified = 0;
  let dirents;
  try {
    dirents = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return { size, fileCount, lastModified };
  }
  for (const d of dirents) {
    if (d.isSymbolicLink()) continue;
    const full = path.join(absDir, d.name);
    if (d.isDirectory()) {
      const sub = await summarizeFolder(full);
      size += sub.size;
      fileCount += sub.fileCount;
      if (sub.lastModified > lastModified) lastModified = sub.lastModified;
    } else if (d.isFile()) {
      try {
        const st = await fs.stat(full);
        size += st.size;
        fileCount += 1;
        if (st.mtimeMs > lastModified) lastModified = st.mtimeMs;
      } catch {
        // file vanished/unreadable mid-scan — skip it
      }
    }
  }
  return { size, fileCount, lastModified };
}

async function walk(
  absDir: string,
  relPath: string,
  parentIsGameLibrary: boolean,
  ctx: WalkContext
) {
  let dirents;
  try {
    dirents = await fs.readdir(absDir, { withFileTypes: true });
  } catch (err) {
    console.warn(`[scan] skipping unreadable folder ${absDir}: ${(err as Error).message}`);
    return;
  }

  let entryCount = 0;

  for (const d of dirents) {
    entryCount++;
    if (d.isSymbolicLink()) continue; // avoid symlink loops

    const absChild = path.join(absDir, d.name);
    const childPath = relPath ? `${relPath}/${d.name}` : d.name;

    if (d.isDirectory()) {
      const lowerName = d.name.toLowerCase();

      ctx.folderCounter.n++;
      if (ctx.folderCounter.n % 20 === 0) {
        ctx.onProgress({ foldersScanned: ctx.folderCounter.n, currentPath: childPath });
      }

      if (DEV_JUNK_DIR_NAMES.has(lowerName)) {
        const summary = await summarizeFolder(absChild);
        if (summary.fileCount > 0) {
          ctx.devJunk.push({
            id: childPath,
            name: d.name,
            path: childPath,
            absPath: absChild,
            size: summary.size,
            fileCount: summary.fileCount,
            lastModified: summary.lastModified,
          });
        }
        continue;
      }

      if (parentIsGameLibrary) {
        const summary = await summarizeFolder(absChild);
        if (summary.fileCount > 0) {
          ctx.games.push({
            id: childPath,
            name: d.name,
            path: childPath,
            absPath: absChild,
            size: summary.size,
            fileCount: summary.fileCount,
            lastModified: summary.lastModified,
          });
        }
        continue;
      }

      const childIsGameLibrary = GAME_LIBRARY_DIR_NAMES.has(lowerName);
      await walk(absChild, childPath, childIsGameLibrary, ctx);
      continue;
    }

    if (!d.isFile()) continue;

    let st;
    try {
      st = await fs.stat(absChild);
    } catch {
      continue; // vanished/unreadable mid-scan
    }

    ctx.files.push({
      id: childPath,
      name: d.name,
      path: childPath,
      absPath: absChild,
      size: st.size,
      lastModified: st.mtimeMs,
      ext: extOf(d.name),
    });

    ctx.fileCounter.n++;
    if (ctx.fileCounter.n % 25 === 0) {
      ctx.onProgress({ filesScanned: ctx.fileCounter.n, currentPath: childPath });
    }
  }

  if (entryCount === 0 && relPath !== ctx.rootPath) {
    ctx.emptyFolders.push({
      id: relPath,
      name: relPath.split("/").pop() || relPath,
      path: relPath,
      absPath: absDir,
    });
  }
}

export async function scanFolder(
  rootAbsPath: string,
  onProgress: (p: Partial<ScanProgress>) => void
): Promise<ScanResults> {
  // Include the picked folder's own name as the base of every relative path,
  // so a file sitting directly in e.g. "Downloads" is still recognized as
  // being in a folder named "Downloads" (not just nested ones further down).
  const rootName = path.basename(rootAbsPath);
  const rootPath = rootName;
  const ctx: WalkContext = {
    files: [],
    emptyFolders: [],
    devJunk: [],
    games: [],
    onProgress,
    fileCounter: { n: 0 },
    folderCounter: { n: 0 },
    rootPath,
  };

  onProgress({ phase: "walking", filesScanned: 0, foldersScanned: 0 });
  await walk(rootAbsPath, rootPath, false, ctx);

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
    (f) => CACHE_TEMP_DIR_PATTERN.test(f.path) || CACHE_TEMP_EXTS.has(f.ext)
  );

  const allInstallers = ctx.files.filter(
    (f) => INSTALLER_EXTS.has(f.ext) && DOWNLOAD_DIR_PATTERN.test(f.path)
  );
  const installers = allInstallers.filter((f) => now - f.lastModified > RECENT_INSTALLER_MS);
  const newInstallers = allInstallers.filter((f) => now - f.lastModified <= RECENT_INSTALLER_MS);

  const unusedDocuments = ctx.files
    .filter((f) => DOCUMENT_EXTS.has(f.ext) && now - f.lastModified > ONE_YEAR_MS)
    .sort((a, b) => a.lastModified - b.lastModified);

  // Dev-junk and game folders are summarized as one unit and never added to
  // ctx.files, so they have to be added back in here or the totals would
  // silently undercount anyone with a node_modules or Steam library.
  const aggregateBytes =
    ctx.devJunk.reduce((sum, f) => sum + f.size, 0) +
    ctx.games.reduce((sum, f) => sum + f.size, 0);
  const aggregateFileCount =
    ctx.devJunk.reduce((sum, f) => sum + f.fileCount, 0) +
    ctx.games.reduce((sum, f) => sum + f.fileCount, 0);

  const totalBytes = ctx.files.reduce((sum, f) => sum + f.size, 0) + aggregateBytes;

  onProgress({ phase: "done" });

  return {
    rootName,
    totalFiles: ctx.files.length + aggregateFileCount,
    totalBytes,
    oldFiles,
    bigFiles,
    cacheTemp,
    newInstallers,
    unusedDocuments,
    installers,
    emptyFolders: ctx.emptyFolders,
    devJunk: ctx.devJunk,
    unplayedGames: ctx.games,
    duplicates,
  };
}
