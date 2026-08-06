// Everything here is plain, JSON-serializable data — the scan runs on the
// server (via Node's real filesystem access, no browser involved), and these
// shapes travel over fetch() to the client as-is.

export interface ScannedFile {
  id: string; // full relative path, unique
  name: string;
  path: string; // e.g. "Downloads/old-installer.exe" (relative, for display)
  absPath: string; // real path on disk, used for delete/preview requests
  size: number;
  lastModified: number;
  ext: string;
}

// A folder we treat as one unit (a game install, a node_modules, etc.)
// instead of listing every file inside it.
export interface FolderAggregate {
  id: string;
  name: string;
  path: string;
  absPath: string;
  size: number;
  fileCount: number;
  lastModified: number; // newest file inside, used as "last touched"
}

export interface EmptyFolder {
  id: string;
  name: string;
  path: string;
  absPath: string;
}

export interface DuplicateGroup {
  id: string;
  size: number; // size of the recommended-keep file (sizes may differ within a "changed" group)
  verified: boolean; // true = confirmed by content check, false = same size + name only, not hashed
  changed: boolean; // false = files are byte-identical copies; true = same name family but content has diverged (edited versions)
  recommendedKeepId: string; // oldest file's id if !changed (probably the original), newest file's id if changed (probably the current version)
  files: ScannedFile[];
}

// One top-level subfolder's total size, for the "what's using the space"
// bar chart. absPath is empty for the synthetic "Other"/loose-files rows,
// which aren't a single real folder and so aren't individually openable.
export interface FolderSizeEntry {
  name: string;
  absPath: string;
  size: number;
  fileCount: number;
  isLoose?: boolean; // files sitting directly in the scanned root, not in any subfolder
  isOther?: boolean; // rolled-up tail of the smallest folders, past the display cap
}

export interface ScanResults {
  rootName: string;
  totalFiles: number;
  totalBytes: number;
  oldFiles: ScannedFile[];
  bigFiles: ScannedFile[];
  cacheTemp: ScannedFile[];
  installers: ScannedFile[];
  newInstallers: ScannedFile[];
  unusedDocuments: ScannedFile[];
  emptyFolders: EmptyFolder[];
  devJunk: FolderAggregate[];
  unplayedGames: FolderAggregate[];
  duplicates: DuplicateGroup[];
  folderSizes: FolderSizeEntry[];
}

export interface ScanProgress {
  filesScanned: number;
  foldersScanned: number;
  currentPath: string;
  phase: "counting" | "walking" | "hashing" | "done";
  // Known total for the current phase, so the client can show a real
  // percentage. Undefined during "counting" (that's what's computing it).
  total?: number;
}

// A single thing to delete — either a file or a folder (recursive).
export interface DeleteRequestItem {
  id: string;
  absPath: string;
  recursive: boolean;
}

export interface DeleteProgress {
  done: number;
  total: number;
}

export const IMAGE_EXTS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "heic",
  "avif",
]);

export const VIDEO_EXTS = new Set([
  "mp4",
  "mov",
  "mkv",
  "avi",
  "webm",
  "m4v",
  "wmv",
]);
