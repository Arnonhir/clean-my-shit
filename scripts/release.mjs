// Loads .env.local into the environment before running electron-builder's
// publish step, the same way Next's own dev/build commands do - so GH_TOKEN
// never has to be typed into a shell command or stored in a persisted git/
// npm config value.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(projectRoot, ".env.local");

const env = { ...process.env };
try {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
} catch {
  // no .env.local present - GH_TOKEN must already be set in the environment
}

if (!env.GH_TOKEN) {
  console.error("GH_TOKEN not set (checked .env.local and the environment) - can't publish.");
  process.exit(1);
}

execSync("npx electron-builder --publish always", { stdio: "inherit", env, cwd: projectRoot });
