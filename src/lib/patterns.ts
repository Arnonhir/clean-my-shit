// Folders we summarize as one unit instead of walking every file inside.
export const DEV_JUNK_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".nuxt",
  "target",
  "__pycache__",
  ".venv",
  "venv",
  ".cache",
  "vendor",
]);

// Folders that mark "this directory's children are installed games."
export const GAME_LIBRARY_DIR_NAMES = new Set([
  "common", // Steam: steamapps/common/<game>
  "epic games",
  "gog games",
  "riot games",
  "battle.net",
  "xboxgames",
]);

export const CACHE_TEMP_DIR_PATTERN = /(^|[\\/])(cache|caches|temp|tmp|code cache|gpucache|dxcache|logs?)([\\/]|$)/i;
export const CACHE_TEMP_EXTS = new Set(["tmp", "temp", "log", "dmp", "bak", "old"]);

export const INSTALLER_EXTS = new Set(["exe", "msi", "dmg", "pkg", "iso"]);
export const DOWNLOAD_DIR_PATTERN = /(^|[\\/])downloads?([\\/]|$)/i;

export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
export const BIG_FILE_THRESHOLD_BYTES = 100 * 1024 * 1024; // 100 MB
export const FULL_HASH_CAP_BYTES = 500 * 1024 * 1024; // 500 MB
export const QUICK_HASH_CHUNK_BYTES = 64 * 1024;

export function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}
