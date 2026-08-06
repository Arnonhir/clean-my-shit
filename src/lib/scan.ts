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
  FolderSizeEntry,
  ScanProgress,
  ScannedFile,
  ScanResults,
} from "./types";
import { findDuplicates } from "./duplicates";
import { throttle } from "./throttle";

// Bucket key for files sitting directly in the scanned root, not inside any
// subfolder - not a real folder, so it can't share a key with an actual name.
const LOOSE_FILES_KEY = "\0loose";

interface WalkContext {
  files: ScannedFile[];
  emptyFolders: EmptyFolder[];
  devJunk: FolderAggregate[];
  games: FolderAggregate[];
  aggregateBigFiles: ScannedFile[]; // big files found inside summarized dev-junk/game folders
  topLevelSizes: Map<string, { size: number; fileCount: number }>; // for the "what's using the space" bar chart
  onProgress: (p: Partial<ScanProgress>) => void;
  fileCounter: { n: number };
  folderCounter: { n: number };
  rootPath: string;
  totalFiles: number; // from the pre-count pass, used for percentage
}

function addToTopLevel(ctx: WalkContext, key: string, size: number, fileCount: number) {
  const existing = ctx.topLevelSizes.get(key);
  if (existing) {
    existing.size += size;
    existing.fileCount += fileCount;
  } else {
    ctx.topLevelSizes.set(key, { size, fileCount });
  }
}

// Sums up size/count/newest-file for a folder we're treating as one unit,
// without keeping every individual file around. Any individual file over
// the big-file threshold gets pushed into bigFilesOut regardless - a game
// install or node_modules being summarized as one unit for its own tab
// shouldn't make a genuinely huge file inside it invisible to Big Files
// (this is exactly how a 24GB game data file went missing from Big Files
// after landing inside a Steam "common" folder).
async function summarizeFolder(
  absDir: string,
  relPath: string,
  bigFilesOut: ScannedFile[]
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
    const childRelPath = relPath ? `${relPath}/${d.name}` : d.name;
    if (d.isDirectory()) {
      const sub = await summarizeFolder(full, childRelPath, bigFilesOut);
      size += sub.size;
      fileCount += sub.fileCount;
      if (sub.lastModified > lastModified) lastModified = sub.lastModified;
    } else if (d.isFile()) {
      try {
        const st = await fs.stat(full);
        size += st.size;
        fileCount += 1;
        if (st.mtimeMs > lastModified) lastModified = st.mtimeMs;
        if (st.size > BIG_FILE_THRESHOLD_BYTES) {
          bigFilesOut.push({
            id: childRelPath,
            name: d.name,
            path: childRelPath,
            absPath: full,
            size: st.size,
            lastModified: st.mtimeMs,
            ext: extOf(d.name),
          });
        }
      } catch {
        // file vanished/unreadable mid-scan — skip it
      }
    }
  }
  return { size, fileCount, lastModified };
}

// Fast pass to get a total file count before the real walk, so progress can
// show a real percentage instead of just "N so far". Mirrors walk()'s own
// traversal decisions (skip descending into dev-junk/game-library folders,
// since those get summarized as one unit and never individually counted)
// so the total actually matches what the real walk will report. No stat()
// calls here — just directory listings — so it's much cheaper than the
// real walk, even though it does touch every directory twice.
async function countFiles(
  absDir: string,
  parentIsGameLibrary: boolean,
  counter: { n: number },
  onTick: (n: number) => void
): Promise<void> {
  let dirents;
  try {
    dirents = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const d of dirents) {
    if (d.isSymbolicLink()) continue;
    if (d.isDirectory()) {
      const lowerName = d.name.toLowerCase();
      if (DEV_JUNK_DIR_NAMES.has(lowerName) || parentIsGameLibrary) continue;
      const childIsGameLibrary = GAME_LIBRARY_DIR_NAMES.has(lowerName);
      await countFiles(path.join(absDir, d.name), childIsGameLibrary, counter, onTick);
    } else if (d.isFile()) {
      counter.n++;
      if (counter.n % 500 === 0) onTick(counter.n);
    }
  }
}

async function walk(
  absDir: string,
  relPath: string,
  parentIsGameLibrary: boolean,
  ctx: WalkContext,
  topLevelName: string | null
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
        ctx.onProgress({
          phase: "walking",
          foldersScanned: ctx.folderCounter.n,
          currentPath: childPath,
          total: ctx.totalFiles,
        });
      }

      // If we're still at the root (topLevelName === null), this child IS
      // the top-level bucket everything beneath it gets attributed to.
      const childTopLevelName = topLevelName ?? d.name;

      if (DEV_JUNK_DIR_NAMES.has(lowerName)) {
        const summary = await summarizeFolder(absChild, childPath, ctx.aggregateBigFiles);
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
          addToTopLevel(ctx, childTopLevelName, summary.size, summary.fileCount);
        }
        continue;
      }

      if (parentIsGameLibrary) {
        const summary = await summarizeFolder(absChild, childPath, ctx.aggregateBigFiles);
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
          addToTopLevel(ctx, childTopLevelName, summary.size, summary.fileCount);
        }
        continue;
      }

      const childIsGameLibrary = GAME_LIBRARY_DIR_NAMES.has(lowerName);
      await walk(absChild, childPath, childIsGameLibrary, ctx, childTopLevelName);
      continue;
    }

    if (!d.isFile()) continue;

    let st;
    try {
      st = await fs.stat(absChild);
    } catch {
      continue; // vanished/unreadable mid-scan
    }

    addToTopLevel(ctx, topLevelName ?? LOOSE_FILES_KEY, st.size, 1);

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
      ctx.onProgress({
        phase: "walking",
        filesScanned: ctx.fileCounter.n,
        currentPath: childPath,
        total: ctx.totalFiles,
      });
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

  // Ticks within a phase are throttled to a fixed rate regardless of folder
  // size, so a scan with millions of files doesn't turn into tens of
  // thousands of stream writes; phase-boundary announcements below always
  // go through onProgress directly (unthrottled) so they're never dropped.
  const tick = throttle(onProgress, 200);

  onProgress({ phase: "counting", filesScanned: 0, foldersScanned: 0, currentPath: "" });
  const countRef = { n: 0 };
  await countFiles(rootAbsPath, false, countRef, (n) =>
    tick({ phase: "counting", filesScanned: n, foldersScanned: 0, currentPath: "" })
  );

  const ctx: WalkContext = {
    files: [],
    emptyFolders: [],
    devJunk: [],
    games: [],
    aggregateBigFiles: [],
    topLevelSizes: new Map(),
    onProgress: tick,
    fileCounter: { n: 0 },
    folderCounter: { n: 0 },
    rootPath,
    totalFiles: countRef.n,
  };

  onProgress({ phase: "walking", filesScanned: 0, foldersScanned: 0, total: countRef.n });
  await walk(rootAbsPath, rootPath, false, ctx, null);

  onProgress({ phase: "hashing", filesScanned: 0 });
  const duplicates = await findDuplicates(ctx.files, tick);

  const now = Date.now();
  const oldFiles = ctx.files
    .filter((f) => now - f.lastModified > ONE_YEAR_MS)
    .sort((a, b) => a.lastModified - b.lastModified);

  // Includes files found inside summarized dev-junk/game folders (see
  // summarizeFolder) - otherwise a huge file inside e.g. a Steam game
  // install would never show up here at all.
  const bigFiles = [
    ...ctx.files.filter((f) => f.size > BIG_FILE_THRESHOLD_BYTES),
    ...ctx.aggregateBigFiles,
  ].sort((a, b) => b.size - a.size);

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

  // Cap the bar chart to the biggest entries + one "Other" row for the rest,
  // so a folder with hundreds of subfolders doesn't turn it into an
  // unreadable wall of slivers.
  const FOLDER_SIZE_DISPLAY_CAP = 15;
  const allTopLevel: FolderSizeEntry[] = [...ctx.topLevelSizes.entries()]
    .filter(([, v]) => v.size > 0)
    .map(([key, v]) => ({
      name: key === LOOSE_FILES_KEY ? "" : key,
      absPath: key === LOOSE_FILES_KEY ? "" : path.join(rootAbsPath, key),
      size: v.size,
      fileCount: v.fileCount,
      isLoose: key === LOOSE_FILES_KEY,
    }))
    .sort((a, b) => b.size - a.size);

  const folderSizes: FolderSizeEntry[] =
    allTopLevel.length <= FOLDER_SIZE_DISPLAY_CAP
      ? allTopLevel
      : [
          ...allTopLevel.slice(0, FOLDER_SIZE_DISPLAY_CAP),
          {
            name: "",
            absPath: "",
            isOther: true,
            size: allTopLevel.slice(FOLDER_SIZE_DISPLAY_CAP).reduce((s, e) => s + e.size, 0),
            fileCount: allTopLevel.slice(FOLDER_SIZE_DISPLAY_CAP).reduce((s, e) => s + e.fileCount, 0),
          },
        ];

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
    folderSizes,
  };
}
