import { promises as fs } from "node:fs";
import { getQuickLinks } from "./browse";
import { scanFolder } from "./scan";
import { computeReclaimableBytes, computeShittiness } from "./shittiness";
import type { UserDataAnalysis, UserDataFolderSummary, UserDataProgress } from "./types";

// The same well-known folders FolderBrowser offers as quick links (which
// already handles OneDrive's "Known Folder Move" redirection) - just the
// ones that actually hold user files, not "This PC" or the profile root
// itself (that would mean recursing into AppData and everything else too).
const CANDIDATE_LABELS = new Set(["Desktop", "Documents", "Downloads", "Pictures", "Videos"]);

// Runs the exact same analysis "Clean up files" mode does (old files, big
// files, cache/temp, installers, duplicates, dev junk, empty folders) on
// each of a drive's well-known user-data folders, so the recommendation
// here is the real thing, not a shortcut approximation of it.
export async function analyzeUserDataFolders(
  driveLetter: string,
  onProgress: (p: UserDataProgress) => void
): Promise<UserDataAnalysis> {
  const driveLower = driveLetter.replace(/[\\/]+$/, "").toLowerCase();

  const candidates = getQuickLinks().filter(
    (q) => CANDIDATE_LABELS.has(q.label) && q.absPath.toLowerCase().startsWith(driveLower)
  );

  const folders: UserDataFolderSummary[] = [];
  onProgress({ phase: "scanning", done: 0, total: candidates.length });

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    onProgress({ phase: "scanning", done: i, total: candidates.length, currentName: candidate.label });

    try {
      await fs.stat(candidate.absPath);
    } catch {
      continue; // folder doesn't exist on this machine - skip it
    }

    const results = await scanFolder(candidate.absPath, () => {});
    const { score, tier } = computeShittiness(results);
    folders.push({
      label: candidate.label,
      absPath: candidate.absPath,
      totalBytes: results.totalBytes,
      reclaimableBytes: computeReclaimableBytes(results),
      shittinessScore: score,
      shittinessTier: tier,
    });
  }

  folders.sort((a, b) => b.shittinessScore - a.shittinessScore);
  onProgress({ phase: "done", done: candidates.length, total: candidates.length });

  return {
    folders,
    totalReclaimableBytes: folders.reduce((sum, f) => sum + f.reclaimableBytes, 0),
  };
}
