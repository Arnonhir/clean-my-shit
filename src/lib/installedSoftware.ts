import { promises as fs } from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { ONE_YEAR_MS } from "./patterns";
import type { DriveSpaceInfo, InstalledApp, SoftwareProgress } from "./types";

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

function recommendationFor(size: number, lastModified: number): "remove" | "review" | "keep" {
  // A corrupted or clock-drifted file can carry a future timestamp, which
  // would make it look "just touched" and suppress every staleness signal.
  // Clamping to now makes that come out as "unknown age" (age 0) instead
  // of silently hiding a program that's actually a fine removal candidate.
  const effectiveLastModified = Math.min(lastModified, Date.now());
  const age = Date.now() - effectiveLastModified;
  if (size > REMOVE_SIZE_BYTES && age > REMOVE_STALE_MS) return "remove";
  if (size > REVIEW_SIZE_BYTES || age > REVIEW_STALE_MS) return "review";
  return "keep";
}

export async function listInstalledApps(
  onProgress: (p: SoftwareProgress) => void
): Promise<{ apps: InstalledApp[]; orphanedRegistryCount: number }> {
  onProgress({ phase: "listing", done: 0 });
  const raw = readUninstallRegistry();

  // Dedupe by install location, not display name - MSI-based installs often
  // register the same product under two Uninstall subkeys with identical
  // paths, and Office-style installs register once per locale (e.g. an
  // "en-us" and matching "he-il" entry) that are the same physical install.
  // The path is the true identifier of "one physical thing on disk"; the
  // name is just a label that can legitimately vary for the same install.
  const byPath = new Map<string, RawRegistryEntry>();
  for (const entry of raw) {
    const key = cleanInstallLocation(entry.InstallLocation ?? "").toLowerCase();
    if (key && !byPath.has(key)) byPath.set(key, entry);
  }

  const candidates = [...byPath.values()];
  let orphanedRegistryCount = 0;
  const apps: InstalledApp[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const entry = candidates[i];
    onProgress({
      phase: "measuring",
      done: i,
      total: candidates.length,
      currentName: entry.DisplayName,
    });

    const cleanedPath = cleanInstallLocation(entry.InstallLocation ?? "");
    let statResult;
    try {
      statResult = await fs.stat(cleanedPath);
    } catch {
      orphanedRegistryCount++;
      continue;
    }

    // A few registry entries point at a specific file (an .exe) instead of
    // the install folder it lives in - measure the containing folder instead.
    const measurePath = statResult.isFile() ? path.dirname(cleanedPath) : cleanedPath;
    const { size, fileCount, lastModified } = await folderSize(measurePath);
    if (fileCount === 0) continue;

    apps.push({
      id: measurePath,
      name: cleanText(entry.DisplayName),
      publisher: entry.Publisher ? cleanText(entry.Publisher) : "",
      absPath: measurePath,
      size,
      fileCount,
      lastModified,
      installDate: parseInstallDate(entry.InstallDate),
      recommendation: recommendationFor(size, lastModified || Date.now() - ONE_YEAR_MS),
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
