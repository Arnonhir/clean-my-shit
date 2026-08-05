import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFileSync } from "node:child_process";

export interface BrowseFolder {
  name: string;
  absPath: string;
}

export interface BrowseResult {
  path: string;
  parent: string | null;
  folders: BrowseFolder[];
  error?: string;
}

export interface QuickLink {
  label: string;
  absPath: string;
}

// Sentinel "path" for the virtual root that lists every drive - not a real
// filesystem path, so it's handled specially in browse() below.
export const THIS_PC = "This PC";
const DRIVE_ROOT_PATTERN = /^[A-Za-z]:\\?$/;

let cachedQuickLinks: QuickLink[] | null = null;

async function listDrives(): Promise<BrowseFolder[]> {
  if (process.platform !== "win32") return [];
  try {
    const out = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-Command", "(Get-PSDrive -PSProvider FileSystem).Root"],
      { encoding: "utf8", timeout: 5000 }
    );
    return out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((root) => ({ name: root, absPath: root }));
  } catch {
    return [];
  }
}

// Desktop/Documents/etc. aren't always at "<home>/Desktop" — OneDrive's
// "Known Folder Move" feature can redirect them elsewhere. Ask Windows
// directly instead of guessing, so quick links point at the real folders.
function resolveWindowsKnownFolders(): Record<string, string> | null {
  try {
    // PowerShell's stdout defaults to the system's legacy codepage, which
    // mangles non-ASCII folder names (Hebrew, etc.) unless we force UTF-8
    // explicitly before writing anything out.
    const script = `
      [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
      $OutputEncoding = [System.Text.Encoding]::UTF8
      $obj = [ordered]@{
        Home = $env:USERPROFILE
        Desktop = [Environment]::GetFolderPath('Desktop')
        Documents = [Environment]::GetFolderPath('MyDocuments')
        Pictures = [Environment]::GetFolderPath('MyPictures')
        Videos = [Environment]::GetFolderPath('MyVideos')
        Downloads = (New-Object -ComObject Shell.Application).Namespace('shell:Downloads').Self.Path
      }
      $obj | ConvertTo-Json
    `;
    const out = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
      encoding: "buffer",
      timeout: 5000,
    });
    return JSON.parse(out.toString("utf8"));
  } catch {
    return null;
  }
}

export function getQuickLinks(): QuickLink[] {
  if (cachedQuickLinks) return cachedQuickLinks;

  const home = os.homedir();
  const known = process.platform === "win32" ? resolveWindowsKnownFolders() : null;

  const links: QuickLink[] = known
    ? [
        { label: "This PC", absPath: THIS_PC },
        { label: "Home", absPath: known.Home },
        { label: "Desktop", absPath: known.Desktop },
        { label: "Documents", absPath: known.Documents },
        { label: "Downloads", absPath: known.Downloads },
        { label: "Pictures", absPath: known.Pictures },
        { label: "Videos", absPath: known.Videos },
      ]
    : [
        { label: "This PC", absPath: THIS_PC },
        { label: "Home", absPath: home },
        { label: "Desktop", absPath: path.join(home, "Desktop") },
        { label: "Documents", absPath: path.join(home, "Documents") },
        { label: "Downloads", absPath: path.join(home, "Downloads") },
        { label: "Pictures", absPath: path.join(home, "Pictures") },
        { label: "Videos", absPath: path.join(home, "Videos") },
      ];

  cachedQuickLinks = links;
  return links;
}

export async function browse(targetPath: string): Promise<BrowseResult> {
  if (targetPath === THIS_PC) {
    const drives = await listDrives();
    return { path: THIS_PC, parent: null, folders: drives };
  }

  const resolved = path.resolve(targetPath);
  let dirents;
  try {
    dirents = await fs.readdir(resolved, { withFileTypes: true });
  } catch (err) {
    return {
      path: resolved,
      parent: DRIVE_ROOT_PATTERN.test(resolved) ? THIS_PC : path.dirname(resolved),
      folders: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const folders = dirents
    .filter((d) => d.isDirectory() && !d.isSymbolicLink())
    .map((d) => ({ name: d.name, absPath: path.join(resolved, d.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // A drive root's own dirname is itself on Windows, so it needs its own
  // case to go "up" to the This PC / drive list instead of dead-ending.
  const parent = DRIVE_ROOT_PATTERN.test(resolved) ? THIS_PC : path.dirname(resolved);
  return { path: resolved, parent: parent === resolved ? null : parent, folders };
}
