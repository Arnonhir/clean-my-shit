// Runs the app's real scan.ts / duplicates.ts logic against a real folder on
// disk (no browser needed) to catch crashes or bad categorization on real data.
// Read-only: never deletes anything. Run with: npx tsx scripts/verify-scan.ts <folder>

import { scanFolder } from "../src/lib/scan";
import { NodeDirectoryHandle } from "./node-fs-shim";
import { formatBytes, formatDate } from "../src/lib/format";

const target = process.argv[2];
if (!target) {
  console.error("Usage: npx tsx scripts/verify-scan.ts <folder-path>");
  process.exit(1);
}

async function main() {
  const root = new NodeDirectoryHandle(target);
  const start = Date.now();

  const results = await scanFolder(root as never, (p) => {
    if (p.phase === "walking" && p.filesScanned && p.filesScanned % 200 === 0) {
      console.log(`  ...${p.filesScanned} files scanned`);
    }
    if (p.phase === "hashing" && p.filesScanned && p.filesScanned % 50 === 0) {
      console.log(`  ...hashing ${p.filesScanned} candidates`);
    }
  });

  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n=== Scan finished in ${seconds}s ===`);
  console.log(`Root: ${results.rootName}`);
  console.log(`Total files: ${results.totalFiles}, total size: ${formatBytes(results.totalBytes)}`);

  console.log(`\n-- Duplicates: ${results.duplicates.length} group(s) --`);
  for (const g of results.duplicates.slice(0, 15)) {
    console.log(
      `  [${g.verified ? "verified" : "UNVERIFIED"}] ${formatBytes(g.size)} x${g.files.length}:`
    );
    for (const f of g.files) console.log(`    - ${f.path} (${formatDate(f.lastModified)})`);
  }

  console.log(`\n-- Old & untouched (1yr+): ${results.oldFiles.length} --`);
  for (const f of results.oldFiles.slice(0, 5))
    console.log(`  ${f.path} — ${formatDate(f.lastModified)}`);

  console.log(`\n-- Big files (>100MB): ${results.bigFiles.length} --`);
  for (const f of results.bigFiles.slice(0, 10))
    console.log(`  ${f.path} — ${formatBytes(f.size)}`);

  console.log(`\n-- Cache/temp junk: ${results.cacheTemp.length} --`);
  for (const f of results.cacheTemp.slice(0, 10)) console.log(`  ${f.path}`);

  console.log(`\n-- Leftover installers: ${results.installers.length} --`);
  for (const f of results.installers.slice(0, 10)) console.log(`  ${f.path}`);

  console.log(`\n-- Empty folders: ${results.emptyFolders.length} --`);
  for (const f of results.emptyFolders.slice(0, 10)) console.log(`  ${f.path}`);

  console.log(`\n-- Dev build junk: ${results.devJunk.length} --`);
  for (const f of results.devJunk.slice(0, 10))
    console.log(`  ${f.path} — ${formatBytes(f.size)} (${f.fileCount} files)`);

  console.log(`\n-- Unplayed games: ${results.unplayedGames.length} --`);
  for (const f of results.unplayedGames.slice(0, 10))
    console.log(`  ${f.path} — ${formatBytes(f.size)}, last touched ${formatDate(f.lastModified)}`);
}

main().catch((err) => {
  console.error("\n!!! SCAN CRASHED !!!");
  console.error(err);
  process.exit(1);
});
