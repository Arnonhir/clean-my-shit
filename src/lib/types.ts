export interface ScannedFile {
  id: string; // full relative path, unique
  name: string;
  path: string; // e.g. "Downloads/old-installer.exe"
  size: number;
  lastModified: number;
  ext: string;
  handle: FileSystemFileHandle;
  parentHandle: FileSystemDirectoryHandle;
}

// A folder we treat as one unit (a game install, a node_modules, etc.)
// instead of listing every file inside it.
export interface FolderAggregate {
  id: string;
  name: string;
  path: string;
  size: number;
  fileCount: number;
  lastModified: number; // newest file inside, used as "last touched"
  parentHandle: FileSystemDirectoryHandle;
}

export interface EmptyFolder {
  id: string;
  name: string;
  path: string;
  parentHandle: FileSystemDirectoryHandle;
}

export interface DuplicateGroup {
  id: string;
  size: number;
  verified: boolean; // true = full content hash matched, false = quick fingerprint only
  files: ScannedFile[];
}

export interface ScanResults {
  rootName: string;
  totalFiles: number;
  totalBytes: number;
  oldFiles: ScannedFile[];
  bigFiles: ScannedFile[];
  cacheTemp: ScannedFile[];
  installers: ScannedFile[];
  emptyFolders: EmptyFolder[];
  devJunk: FolderAggregate[];
  unplayedGames: FolderAggregate[];
  duplicates: DuplicateGroup[];
}

export interface ScanProgress {
  filesScanned: number;
  foldersScanned: number;
  currentPath: string;
  phase: "walking" | "hashing" | "done";
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
