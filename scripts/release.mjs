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

// electron-builder always creates GitHub releases as drafts (and setting
// "draft": false in the static package.json config breaks schema validation
// for plain, non-publish builds) - so un-draft it here instead, right after
// publishing.
const pkg = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const { owner, repo } = pkg.build.publish;
const tag = `v${pkg.version}`;
const headers = { Authorization: `Bearer ${env.GH_TOKEN}`, "User-Agent": "clean-my-shit-release" };

// GitHub's "get release by tag" endpoint never returns drafts - checking
// that one directly always looks like "not found" for a release that just
// got created (still a draft), which used to read as success and exit 0
// without actually publishing anything. Listing releases and filtering by
// tag sees drafts too, and lets a genuinely missing release fail loudly
// instead of silently.
const allReleases = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, { headers }).then((r) =>
  r.json()
);
if (!Array.isArray(allReleases)) {
  console.error(`Couldn't list releases for ${owner}/${repo}:`, allReleases);
  process.exit(1);
}
let matches = allReleases.filter((r) => r.tag_name === tag);
if (matches.length === 0) {
  console.error(`No release found for ${tag} after publish - electron-builder may have failed silently.`);
  process.exit(1);
}
if (matches.length > 1) {
  // electron-builder has been observed creating more than one draft release
  // for the same tag (a race between the per-asset publish calls) - keep
  // whichever has the most uploaded assets and delete the rest so drafts
  // don't pile up.
  matches.sort((a, b) => b.assets.length - a.assets.length);
  const [keep, ...extras] = matches;
  for (const extra of extras) {
    await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${extra.id}`, {
      method: "DELETE",
      headers,
    });
    console.log(`Deleted duplicate draft release id=${extra.id} (${extra.assets.length} asset(s))`);
  }
  matches = [keep];
}

const release = matches[0];
if (release.draft) {
  await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${release.id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ draft: false }),
  });
  console.log(`Published ${tag} (removed draft status)`);
} else {
  console.log(`${tag} was already published`);
}
