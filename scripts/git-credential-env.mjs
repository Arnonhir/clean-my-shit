// A git credential helper that reads GH_TOKEN from .env.local instead of
// ever putting the token on a command line or in a stored git config value.
// Registered locally (this repo only) via `git config credential.helper`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(projectRoot, ".env.local");

function readToken() {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("GH_TOKEN=")) continue;
    return trimmed.slice("GH_TOKEN=".length).trim();
  }
  throw new Error("GH_TOKEN not found in .env.local");
}

const action = process.argv[2];
if (action === "get") {
  const token = readToken();
  process.stdout.write(`username=x-access-token\npassword=${token}\n`);
}
// "store"/"erase" are no-ops - the token's source of truth stays .env.local.
