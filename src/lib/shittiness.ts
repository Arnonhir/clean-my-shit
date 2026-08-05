import type { ScanResults } from "./types";

export interface Shittiness {
  score: number; // 0-100, higher = shittier
  tier: 0 | 1 | 2 | 3 | 4;
}

// A rough "how much of this folder is junk" score: mostly driven by how many
// bytes could actually be reclaimed (duplicate extra copies, cache/temp,
// old installers, dev build junk), with a smaller bump for clutter that's
// annoying even when it's not much data (lots of duplicate groups, empty
// folders, a big pile of stale old files).
export function computeShittiness(r: ScanResults): Shittiness {
  const reclaimableBytes =
    r.duplicates.reduce((sum, g) => {
      const groupTotal = g.files.reduce((s, f) => s + f.size, 0);
      return sum + (groupTotal - g.size); // total minus the one file recommended to keep
    }, 0) +
    r.cacheTemp.reduce((s, f) => s + f.size, 0) +
    r.installers.reduce((s, f) => s + f.size, 0) +
    r.devJunk.reduce((s, f) => s + f.size, 0);

  const byteRatio = r.totalBytes > 0 ? reclaimableBytes / r.totalBytes : 0;

  const clutterScore =
    Math.min(r.duplicates.length / 2, 15) +
    Math.min(r.emptyFolders.length, 5) +
    Math.min(r.oldFiles.length / 100, 10);

  const score = Math.max(0, Math.min(100, Math.round(byteRatio * 70 + clutterScore)));

  let tier: Shittiness["tier"];
  if (score < 15) tier = 0;
  else if (score < 35) tier = 1;
  else if (score < 55) tier = 2;
  else if (score < 75) tier = 3;
  else tier = 4;

  return { score, tier };
}
