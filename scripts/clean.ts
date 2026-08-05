// Clean My Sh*t — command-line cleaner.
//
// Does the same scan as the web app, but runs directly against your real
// filesystem via Node — so it works on Downloads/Desktop/Documents/your
// whole user folder, which Chrome refuses to hand to ANY website (that's a
// deliberate browser security restriction, not something the web app can
// bypass). Deleted files go to the Recycle Bin, same as deleting them
// yourself in File Explorer — nothing here is more permanent than normal.
//
// Run with:  npx tsx scripts/clean.ts ["C:\path\to\folder"]
// With no path given, it defaults to your Downloads folder.

import * as readline from "node:readline/promises";
import * as os from "node:os";
import * as path from "node:path";
import { scanFolder } from "../src/lib/scan";
import { deleteAll, type Deletable } from "../src/lib/deletion";
import { NodeDirectoryHandle } from "./node-fs-shim";
import { formatBytes, formatDate } from "../src/lib/format";
import type { ScannedFile, FolderAggregate, EmptyFolder } from "../src/lib/types";

interface Candidate {
  n: number;
  category: string;
  label: string;
  size: number;
  toDeletable: () => Deletable;
}

function fileCandidate(category: string, f: ScannedFile, note = ""): Omit<Candidate, "n"> {
  return {
    category,
    label: `${f.path} — ${formatBytes(f.size)} — ${formatDate(f.lastModified)}${note}`,
    size: f.size,
    toDeletable: () => ({ name: f.name, parentHandle: f.parentHandle, recursive: false }),
  };
}

function folderCandidate(category: string, f: FolderAggregate): Omit<Candidate, "n"> {
  return {
    category,
    label: `${f.path}/ — ${formatBytes(f.size)} (${f.fileCount} files) — ${formatDate(f.lastModified)}`,
    size: f.size,
    toDeletable: () => ({ name: f.name, parentHandle: f.parentHandle, recursive: true }),
  };
}

function emptyFolderCandidate(category: string, f: EmptyFolder): Omit<Candidate, "n"> {
  return {
    category,
    label: `${f.path}/ (empty)`,
    size: 0,
    toDeletable: () => ({ name: f.name, parentHandle: f.parentHandle, recursive: true }),
  };
}

function parseSelection(input: string, max: number): Set<number> {
  const picked = new Set<number>();
  for (const part of input.split(",").map((s) => s.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      for (let i = from; i <= to; i++) if (i >= 1 && i <= max) picked.add(i);
    } else if (/^\d+$/.test(part)) {
      const i = Number(part);
      if (i >= 1 && i <= max) picked.add(i);
    }
  }
  return picked;
}

async function main() {
  const target = process.argv[2] || path.join(os.homedir(), "Downloads");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(`\n🚽 Clean My Sh*t — command-line cleaner`);
  console.log(`Scanning: ${target}\n`);

  const root = new NodeDirectoryHandle(target, undefined, true);
  const results = await scanFolder(root as never, (p) => {
    if (p.phase === "walking" && p.filesScanned && p.filesScanned % 300 === 0) {
      process.stdout.write(`\r  ...${p.filesScanned} files scanned so far`);
    }
  });
  process.stdout.write("\r" + " ".repeat(50) + "\r");

  console.log(
    `Done. ${results.totalFiles.toLocaleString()} files, ${formatBytes(results.totalBytes)} total.\n`
  );

  const candidates: Candidate[] = [];
  let n = 0;
  const add = (c: Omit<Candidate, "n">) => candidates.push({ ...c, n: ++n });

  for (const group of results.duplicates) {
    group.files.forEach((f, i) =>
      add(fileCandidate("Duplicate", f, i === 0 ? "  (oldest — probably the original)" : ""))
    );
  }
  results.oldFiles.forEach((f) => add(fileCandidate("Old & untouched", f)));
  results.bigFiles.forEach((f) => add(fileCandidate("Big file", f)));
  results.cacheTemp.forEach((f) => add(fileCandidate("Cache/temp", f)));
  results.installers.forEach((f) => add(fileCandidate("Old installer", f)));
  results.emptyFolders.forEach((f) => add(emptyFolderCandidate("Empty folder", f)));
  results.devJunk.forEach((f) => add(folderCandidate("Dev build junk", f)));
  results.unplayedGames.forEach((f) => add(folderCandidate("Unplayed game", f)));

  if (candidates.length === 0) {
    console.log("Nothing to clean up! 🎉");
    rl.close();
    return;
  }

  let lastCategory = "";
  for (const c of candidates) {
    if (c.category !== lastCategory) {
      console.log(`\n-- ${c.category} --`);
      lastCategory = c.category;
    }
    console.log(`[${c.n}] ${c.label}`);
  }

  console.log(
    `\n${candidates.length} items found. Type numbers to delete (e.g. "3,5,10-14"), or Enter to quit without deleting anything.`
  );
  const selection = await rl.question("> ");
  const picked = parseSelection(selection, candidates.length);

  if (picked.size === 0) {
    console.log("Nothing selected — exiting without changes.");
    rl.close();
    return;
  }

  const chosen = candidates.filter((c) => picked.has(c.n));
  const totalSize = chosen.reduce((sum, c) => sum + c.size, 0);

  console.log(`\nYou selected ${chosen.length} item(s), ${formatBytes(totalSize)} total:`);
  for (const c of chosen) console.log(`  [${c.n}] ${c.label}`);

  console.log(
    `\nThese will go to the Recycle Bin (not permanently deleted — you can restore them from there).`
  );
  const confirm = await rl.question(`Type "yes" to delete these ${chosen.length} item(s): `);

  if (confirm.trim().toLowerCase() !== "yes") {
    console.log("Cancelled — nothing was deleted.");
    rl.close();
    return;
  }

  const outcome = await deleteAll(chosen.map((c) => ({ id: String(c.n), ...c.toDeletable() })));
  const succeededIds = new Set(outcome.succeeded.map((s) => s.id));
  const freed = chosen
    .filter((c) => succeededIds.has(String(c.n)))
    .reduce((sum, c) => sum + c.size, 0);

  console.log(
    `\n✅ Sent ${outcome.succeeded.length} item(s) to the Recycle Bin, freeing about ${formatBytes(freed)}.`
  );
  if (outcome.failed.length > 0) {
    console.log(`⚠ ${outcome.failed.length} item(s) failed:`);
    for (const f of outcome.failed) console.log(`  - ${f.item.name}: ${f.error}`);
  }

  rl.close();
}

main().catch((err) => {
  console.error("\n!!! Something crashed !!!");
  console.error(err);
  process.exit(1);
});
