// next build with output:"standalone" produces a self-contained server in
// .next/standalone, but deliberately doesn't include the static assets or
// the public/ folder - those have to be copied in by hand. Without this,
// the packaged app would load pages with no CSS and a missing favicon/icon.
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const standaloneDir = path.join(projectRoot, ".next", "standalone");

async function copyDir(src, dest) {
  await fs.rm(dest, { recursive: true, force: true });
  await fs.cp(src, dest, { recursive: true });
}

async function main() {
  if (!(await fs.stat(standaloneDir).catch(() => null))) {
    throw new Error(".next/standalone not found - did `next build` run with output: 'standalone'?");
  }

  await copyDir(path.join(projectRoot, ".next", "static"), path.join(standaloneDir, ".next", "static"));
  console.log("Copied .next/static -> .next/standalone/.next/static");

  await copyDir(path.join(projectRoot, "public"), path.join(standaloneDir, "public"));
  console.log("Copied public/ -> .next/standalone/public");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
