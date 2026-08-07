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

// One subfolder's total size, for the "what's using the space" sunburst.
// absPath is empty for the synthetic "Other"/loose-files rows, which
// aren't a single real folder and so aren't individually openable.
// `children` is that same shape one level down (this folder's own
// subfolders) - two rings deep: top-level folders, then their subfolders.
export interface FolderSizeEntry {
  name: string;
  absPath: string;
  size: number;
  fileCount: number;
  isLoose?: boolean; // files sitting directly in this folder, not in any subfolder
  isOther?: boolean; // rolled-up tail of the smallest folders, past the display cap
  children: FolderSizeEntry[];
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

export interface DriveSpaceInfo {
  name: string; // e.g. "C:\"
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
}

export type SoftwareRecommendation = "remove" | "review" | "keep";

// Which criterion actually triggered the recommendation, so the UI can
// explain *why* instead of just showing a bare "remove"/"review" badge.
export type RecommendationTrigger = "sizeAndStale" | "size" | "staleness" | "none";

// Where an entry was found - the registry alone misses Store apps (which
// have their own separate package list) and games installed to a library
// folder without ever registering an Uninstall entry.
export type SoftwareSource = "registry" | "appx" | "gameFolder";

export interface InstalledApp {
  id: string;
  name: string;
  publisher: string;
  absPath: string;
  size: number;
  fileCount: number;
  lastModified: number; // newest file inside its install folder - a proxy for "last used"
  installDate: string; // "YYYY-MM-DD", or "" if the registry didn't have one
  recommendation: SoftwareRecommendation;
  recommendationTrigger: RecommendationTrigger;
  ageDays: number;
  source: SoftwareSource;
}

export interface SoftwareAnalysis {
  drive: string; // the drive that was analyzed, e.g. "C:\"
  apps: InstalledApp[];
  orphanedRegistryCount: number; // registry entries whose install folder no longer exists on disk
}

export interface SoftwareProgress {
  phase: "listing" | "measuring" | "done";
  done: number;
  total?: number;
  currentName?: string;
}

export interface UserDataFolderSummary {
  label: string; // "Desktop", "Documents", etc.
  absPath: string;
  totalBytes: number;
  reclaimableBytes: number;
  shittinessScore: number;
  shittinessTier: 0 | 1 | 2 | 3 | 4;
}

export interface UserDataAnalysis {
  folders: UserDataFolderSummary[];
  totalReclaimableBytes: number;
}

export interface UserDataProgress {
  phase: "scanning" | "done";
  done: number;
  total: number;
  currentName?: string;
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
