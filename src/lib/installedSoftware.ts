import { promises as fs } from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { isGameLibraryDir, ONE_YEAR_MS } from "./patterns";
import { readAppManifests, readSteamLastPlayed } from "./steamPlaytime";
import type {
  DriveSpaceInfo,
  InstalledApp,
  RecommendationTrigger,
  SoftwareProgress,
  SoftwareSource,
} from "./types";

const REVIEW_STALE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const REMOVE_STALE_MS = 180 * 24 * 60 * 60 * 1000; // 6 months
const REVIEW_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const REMOVE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

interface RawRegistryEntry {
  DisplayName: string;
  Publisher: string | null;
  InstallLocation: string | null;
  InstallDate: string | null;
  UninstallString: string | null;
}

// Reads the Windows "installed programs" registry the same way Control
// Panel's "Programs and Features" does - both the 64-bit and 32-bit
// (WOW6432Node) machine-wide keys, plus the per-user key. Filters out
// hidden system components (SystemComponent=1, the same flag Windows itself
// uses to hide entries from that list) and Steam/Ubisoft-launched games,
// since those are already covered by the folder-based game detection and
// their registry entries don't carry a real InstallLocation anyway.
function readUninstallRegistry(): RawRegistryEntry[] {
  const script = `
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
    $paths = @(
      "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
      "HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
      "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
    )
    Get-ItemProperty $paths -ErrorAction SilentlyContinue |
      Where-Object {
        $_.DisplayName -and $_.DisplayName.Trim() -ne "" -and
        $_.SystemComponent -ne 1 -and
        $_.InstallLocation -and $_.InstallLocation.Trim() -ne "" -and
        $_.UninstallString -notlike "*steam://*" -and
        $_.UninstallString -notlike "*uplay://*"
      } |
      Select-Object @{n='DisplayName';e={$_.DisplayName}}, @{n='Publisher';e={$_.Publisher}}, @{n='InstallLocation';e={$_.InstallLocation}}, @{n='InstallDate';e={$_.InstallDate}}, @{n='UninstallString';e={$_.UninstallString}} |
      ConvertTo-Json
  `;
  try {
    const out = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
      encoding: "buffer",
      timeout: 15000,
      maxBuffer: 1024 * 1024 * 10,
    });
    const parsed = JSON.parse(out.toString("utf8"));
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

interface RawAppxEntry {
  Name: string;
  Publisher: string | null;
  InstallLocation: string | null;
}

// The Uninstall registry is what "Programs and Features" reads, but Store
// (UWP) apps live in a completely separate package list that never shows up
// there - Get-AppxPackage is the only way to see them. IsFramework/
// IsResourcePackage filters out the shared-runtime noise (VCLibs, language
// resource packs, etc.) that Windows itself doesn't show as an "app" either.
function listAppxPackages(): RawAppxEntry[] {
  const script = `
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
    Get-AppxPackage -ErrorAction SilentlyContinue |
      Where-Object { $_.InstallLocation -and -not $_.IsFramework -and -not $_.IsResourcePackage } |
      Select-Object @{n='Name';e={$_.Name}}, @{n='Publisher';e={$_.Publisher}}, @{n='InstallLocation';e={$_.InstallLocation}} |
      ConvertTo-Json
  `;
  try {
    const out = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
      encoding: "buffer",
      timeout: 20000,
      maxBuffer: 1024 * 1024 * 10,
    });
    const parsed = JSON.parse(out.toString("utf8"));
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

// Appx package names are dotted identifiers like "Microsoft.WindowsCalculator"
// or "king.com.CandyCrushSaga" - not what Windows itself would display, but
// there's no fast way to get the real DisplayName without opening each
// package's manifest. Taking the last dotted segment and splitting on
// case changes gets close enough ("WindowsCalculator" -> "Windows Calculator").
function friendlyAppxName(rawName: string): string {
  const lastSegment = rawName.includes(".") ? rawName.split(".").pop()! : rawName;
  return lastSegment.replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim();
}

// Appx Publisher is a full X.509 certificate subject ("CN=Skype Software
// Sarl, O=Microsoft Corporation, L=Luxembourg, ...") - only the CN
// component is a human name, same as what Windows itself shows for these.
function friendlyAppxPublisher(raw: string): string {
  const match = raw.match(/CN=([^,]+)/);
  return match ? match[1].trim() : raw;
}

const SKIP_DIR_NAMES = new Set([
  "windows",
  "programdata",
  "$recycle.bin",
  "system volume information",
  "recovery",
  "msocache",
  "perflogs",
  "config.msi",
]);

// Looks for known game-library container folders (Steam's steamapps/common,
// Epic Games, GOG Games, etc.) anywhere within a few levels of the drive
// root - not just the default install path - since Steam in particular
// lets a library live on any folder the user picked. Many of these games
// never register an Uninstall entry at all, so without this, the registry
// scan alone silently misses them.
async function findGameLibraryFolders(driveRoot: string): Promise<string[]> {
  const found: string[] = [];
  const maxDepth = 6;

  async function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    let dirents;
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const parentName = path.basename(dir);
    for (const d of dirents) {
      if (!d.isDirectory() || d.isSymbolicLink()) continue;
      const lower = d.name.toLowerCase();
      if (SKIP_DIR_NAMES.has(lower)) continue;
      const absPath = path.join(dir, d.name);
      if (isGameLibraryDir(lower, parentName)) {
        found.push(absPath);
        continue; // its children are games, not more library containers
      }
      await walk(absPath, depth + 1);
    }
  }

  await walk(driveRoot, 0);
  return found;
}

// A handful of registry entries carry stray control characters (a trailing
// null byte has shown up in the wild) in DisplayName/Publisher - strip them
// so they don't render as an invisible glyph in the UI.
function cleanText(raw: string): string {
  return raw.replace(/[\x00-\x1f]/g, "").trim();
}

function parseInstallDate(raw: string | null): string {
  if (!raw || !/^\d{8}$/.test(raw)) return "";
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

// Registry InstallLocation values are sometimes wrapped in literal quotes,
// and occasionally point at a specific file rather than its folder.
function cleanInstallLocation(raw: string): string {
  return raw.trim().replace(/^"(.*)"$/, "$1").replace(/\//g, "\\");
}

async function folderSize(
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
      const sub = await folderSize(full);
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
        // file vanished/unreadable mid-measure - skip it
      }
    }
  }
  return { size, fileCount, lastModified };
}

interface RecommendationResult {
  recommendation: "remove" | "review" | "keep";
  trigger: RecommendationTrigger;
  ageDays: number;
}

function recommendationFor(size: number, lastModified: number): RecommendationResult {
  // A corrupted or clock-drifted file can carry a future timestamp, which
  // would make it look "just touched" and suppress every staleness signal.
  // Clamping to now makes that come out as "unknown age" (age 0) instead
  // of silently hiding a program that's actually a fine removal candidate.
  const effectiveLastModified = Math.min(lastModified, Date.now());
  const ageMs = Date.now() - effectiveLastModified;
  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  const bigForRemove = size > REMOVE_SIZE_BYTES;
  const staleForRemove = ageMs > REMOVE_STALE_MS;
  if (bigForRemove && staleForRemove) {
    return { recommendation: "remove", trigger: "sizeAndStale", ageDays };
  }
  const bigForReview = size > REVIEW_SIZE_BYTES;
  const staleForReview = ageMs > REVIEW_STALE_MS;
  if (bigForReview && staleForReview) {
    return { recommendation: "review", trigger: "sizeAndStale", ageDays };
  }
  if (bigForReview) return { recommendation: "review", trigger: "size", ageDays };
  if (staleForReview) return { recommendation: "review", trigger: "staleness", ageDays };
  return { recommendation: "keep", trigger: "none", ageDays };
}

interface Candidate {
  name: string;
  publisher: string;
  installDate: string;
  source: SoftwareSource;
  lastPlayedMs?: number; // Steam's own recorded last-played time, when known
}

export async function listInstalledApps(
  driveLetter: string, // e.g. "C:" or "C:\" - trailing slash tolerated
  onProgress: (p: SoftwareProgress) => void
): Promise<{ apps: InstalledApp[]; orphanedRegistryCount: number }> {
  const normalizedDrive = driveLetter.replace(/[\\/]+$/, "");
  const driveRoot = `${normalizedDrive}\\`;
  const driveLower = normalizedDrive.toLowerCase();
  function isOnDrive(absPath: string): boolean {
    return absPath.toLowerCase().startsWith(driveLower);
  }

  onProgress({ phase: "listing", done: 0 });

  // Three independent lists, merged and deduped by install path (not name)
  // - the same physical install can legitimately appear in more than one
  // of them (Steam does register most games in the Uninstall registry too).
  const byPath = new Map<string, Candidate>();

  const registryEntries = readUninstallRegistry();
  for (const entry of registryEntries) {
    const key = cleanInstallLocation(entry.InstallLocation ?? "").toLowerCase();
    if (!key || !isOnDrive(key) || byPath.has(key)) continue;
    byPath.set(key, {
      name: cleanText(entry.DisplayName),
      publisher: entry.Publisher ? cleanText(entry.Publisher) : "",
      installDate: parseInstallDate(entry.InstallDate),
      source: "registry",
    });
  }

  const appxEntries = listAppxPackages();
  for (const pkg of appxEntries) {
    const key = cleanInstallLocation(pkg.InstallLocation ?? "").toLowerCase();
    if (!key || !isOnDrive(key) || byPath.has(key)) continue;
    byPath.set(key, {
      name: friendlyAppxName(pkg.Name),
      publisher: pkg.Publisher ? friendlyAppxPublisher(cleanText(pkg.Publisher)) : "",
      installDate: "",
      source: "appx",
    });
  }

  // Playing a game essentially never touches files inside its own install
  // folder - saves land in Documents/AppData, so folder mtime only reflects
  // the last patch, not the last play session. Steam records the real
  // last-played time itself (in each account's localconfig.vdf, keyed by
  // AppID, which the library's own appmanifest_*.acf maps back to from a
  // folder name) - fetched lazily, once, only if a Steam library shows up.
  let lastPlayedByAppId: Map<string, number> | null = null;
  async function steamLastPlayed(): Promise<Map<string, number>> {
    if (!lastPlayedByAppId) {
      const drives = await getDriveSpace();
      lastPlayedByAppId = await readSteamLastPlayed(drives.map((d) => d.name.replace(/[\\/]+$/, "")));
    }
    return lastPlayedByAppId;
  }

  const libraryDirs = await findGameLibraryFolders(driveRoot);
  for (const libDir of libraryDirs) {
    let children;
    try {
      children = await fs.readdir(libDir, { withFileTypes: true });
    } catch {
      continue;
    }

    const isSteamLibrary = path.basename(libDir).toLowerCase() === "common";
    let installDirToAppId: Map<string, string> | null = null;
    if (isSteamLibrary) {
      installDirToAppId = await readAppManifests(path.dirname(libDir));
    }

    for (const c of children) {
      if (!c.isDirectory()) continue;
      const absPath = path.join(libDir, c.name);
      const key = absPath.toLowerCase();
      if (byPath.has(key)) continue;

      let lastPlayedMs: number | undefined;
      const appId = installDirToAppId?.get(c.name.toLowerCase());
      if (appId) {
        const lastPlayedMap = await steamLastPlayed();
        lastPlayedMs = lastPlayedMap.get(appId);
      }

      byPath.set(key, {
        name: c.name.replace(/_/g, " ").trim(),
        publisher: "",
        installDate: "",
        source: "gameFolder",
        lastPlayedMs,
      });
    }
  }

  const candidates = [...byPath.entries()];
  let orphanedRegistryCount = 0;
  const apps: InstalledApp[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const [cleanedPath, info] = candidates[i];
    onProgress({
      phase: "measuring",
      done: i,
      total: candidates.length,
      currentName: info.name,
    });

    let statResult;
    try {
      statResult = await fs.stat(cleanedPath);
    } catch {
      if (info.source === "registry") orphanedRegistryCount++;
      continue;
    }

    // A few registry entries point at a specific file (an .exe) instead of
    // the install folder it lives in - measure the containing folder instead.
    const measurePath = statResult.isFile() ? path.dirname(cleanedPath) : cleanedPath;
    const { size, fileCount, lastModified } = await folderSize(measurePath);
    if (fileCount === 0) continue;

    // Take whichever signal is more recent - Steam's LastPlayed for actual
    // play sessions, folder mtime for everything else (including a patch
    // landing after the last time it was played).
    const effectiveLastModified = Math.max(lastModified, info.lastPlayedMs ?? 0);

    const rec = recommendationFor(size, effectiveLastModified || Date.now() - ONE_YEAR_MS);
    apps.push({
      id: measurePath,
      name: info.name,
      publisher: info.publisher,
      absPath: measurePath,
      size,
      fileCount,
      lastModified: effectiveLastModified,
      installDate: info.installDate,
      recommendation: rec.recommendation,
      recommendationTrigger: rec.trigger,
      ageDays: rec.ageDays,
      source: info.source,
    });
  }

  apps.sort((a, b) => b.size - a.size);
  onProgress({ phase: "done", done: candidates.length, total: candidates.length });
  return { apps, orphanedRegistryCount };
}

export async function getDriveSpace(): Promise<DriveSpaceInfo[]> {
  const script = `
    Get-PSDrive -PSProvider FileSystem |
      Where-Object { $_.Used -gt 0 } |
      Select-Object Name, Used, Free |
      ConvertTo-Json
  `;
  try {
    const out = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
      encoding: "utf8",
      timeout: 5000,
    });
    const parsed = JSON.parse(out);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map((d: { Name: string; Used: number; Free: number }) => ({
      name: `${d.Name}:\\`,
      usedBytes: d.Used,
      freeBytes: d.Free,
      totalBytes: d.Used + d.Free,
    }));
  } catch {
    return [];
  }
}
