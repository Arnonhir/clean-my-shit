// electron-builder's extraResources copying applies its own default file
// filters even when given "**/*" - which silently dropped the entire
// node_modules folder from .next/standalone (0 files copied, no warning),
// breaking the packaged app with "Cannot find module 'next'". Copying it
// ourselves after packaging, with a plain recursive fs copy and no
// filtering involved, is the reliable fix.
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const src = path.join(context.packager.projectDir, ".next", "standalone");
  const dest = path.join(context.appOutDir, "resources", "standalone");

  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });

  const nextPkg = path.join(dest, "node_modules", "next", "package.json");
  if (!fs.existsSync(nextPkg)) {
    throw new Error(`afterPack: copy looks incomplete - missing ${nextPkg}`);
  }
  console.log(`[after-pack] copied standalone build: ${src} -> ${dest}`);

  // .env.local holds the Resend API key/feedback address - never committed,
  // so it only exists on the machine doing the packaging. Bundling a copy
  // into resources/ is what lets the shipped app send feedback without the
  // person installing it needing their own key.
  const envSrc = path.join(context.packager.projectDir, ".env.local");
  const envDest = path.join(context.appOutDir, "resources", "feedback.env");
  if (fs.existsSync(envSrc)) {
    fs.copyFileSync(envSrc, envDest);
    console.log(`[after-pack] copied feedback env: ${envSrc} -> ${envDest}`);
  } else {
    console.warn("[after-pack] no .env.local found - feedback sending will be disabled in this build");
  }
};
