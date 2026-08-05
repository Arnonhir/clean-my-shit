# Clean My Sh*t

A tool that scans a folder on your computer and finds junk worth deleting:
duplicate files (with a preview of each copy), files nobody's touched in
years, huge files, installed games gathering dust, and cache/temp clutter.

## How it works (the important bit)

This is a normal website — you'll open it from a link, just like any other
site. But real websites are **not allowed** to reach into your hard drive on
their own; that would let any site on the internet act like a virus. So
instead: you click **"Choose a folder to scan"**, pick a folder yourself
(even a whole drive), and the scanning happens **right there in your
browser**. Nothing is uploaded to any server — it all stays on your machine.

This only works in **Chrome or Edge on a desktop computer** (Windows, Mac, or
Linux). Phones, tablets, Safari, and Firefox don't support the browser
feature this relies on (the "File System Access API") — so the app politely
says so instead of pretending to work.

## The stack (and why)

- **Next.js (TypeScript, App Router)** — the framework. No backend, no
  database — everything runs client-side in the visitor's browser.
- **Tailwind CSS** — styling.
- No server, no accounts, no data ever leaves the computer it's running on.

## What it checks for

1. **Duplicates** — grouped by matching size + content, each copy shown with
   a thumbnail (photos/videos), name, path, and date, so you can tell which
   one to keep.
2. **Old & untouched** — not modified in a year or more.
3. **Big files** — anything over 100 MB, biggest first.
4. **Unplayed games** — folders under common game library locations (Steam,
   Epic, GOG, etc.), using the newest file inside as a "last played" guess.
   (Browsers can't ask Steam directly, so this is an approximation.)
5. **Cache & temp junk** — folders/files that look like cache, temp, or log
   data.
6. **Leftover installers** — old .exe/.msi/.dmg/.iso files sitting in a
   Downloads folder.
7. **Empty folders**.
8. **Dev build junk** — `node_modules`, `dist`, `build`, `.next`, etc. —
   summarized as one entry each rather than thousands of tiny files.

## How duplicates are actually verified

Files are grouped by exact size first, then a quick fingerprint (start + end
of the file), then — for anything under 500 MB — a full content hash, so
"duplicate" really means duplicate before you delete anything. Very large
matches (over 500 MB) are labeled "not fully verified" instead of silently
assumed.

## Deleting files

The folder picker only asks for **read** access up front — asking for write
access immediately used to make Chrome refuse to let you pick Downloads,
Desktop, Documents, or your whole user folder at all (Chrome deliberately
blocks websites from getting broad write access to those specific folders,
to stop a site from quietly getting delete-power over them). Write access is
now requested lazily, only when you actually click delete, and only for the
folders containing the files you selected.

One real limit this doesn't remove: Chrome still refuses write access to
those special folders **themselves**, so a file sitting directly inside
Downloads/Desktop/Documents (not in a subfolder) can be found and shown, but
can't be one-click deleted from the browser — the app shows a clear message
for those instead of failing silently, explaining that you'll need to delete
that one via File Explorer, or scan a subfolder instead if you want to bulk
delete from inside the app.

There's also a big warning before anything is deleted, because **browser
deletion is permanent and does not go through the Recycle Bin**. There's no
undo, so the confirm step is intentionally a little annoying.

## Language

There's a 🌐 toggle in the top-right that switches all UI text between
English and Hebrew (עברית), including switching the layout to right-to-left
for Hebrew. Your choice is remembered (saved in the browser) for next time.
File names/paths themselves aren't translated — only the app's own labels.

## How to run it locally

```
npm run dev
```
Then open http://localhost:3000.

## Decisions made so far

- **Moved off Google Drive.** The project was first scaffolded in
  `G:\האחסון שלי\Git`, which turned out to be a Google Drive–synced folder.
  Installing dependencies there (tens of thousands of small files) was
  extremely slow and actually corrupted mid-install. The project now lives
  locally at `C:\Users\user\Projects\clean-my-shit` — keep it here, or
  anywhere that isn't inside a cloud-synced folder (Google Drive, Dropbox,
  OneDrive), for the same reason.
- **App name is literally "Clean My Sh*t"** per your request — used as-is in
  the page title and manifest.
- **Desktop icon (for everyone, once it's live)**: the app has a web manifest
  + icon, so once it's deployed, Chrome/Edge's "Install app" option will put a
  real icon on the desktop for anyone who visits the link — no separate
  installer needed.
- **Desktop icon (for you, right now)**: there's also a real shortcut already
  on your Desktop — "Clean My Sh\*t" — that opens the app in its own clean
  window (via `chrome.exe --app=...`, using a separate small Chrome profile
  so it doesn't touch your normal Chrome tabs/history). The icon file is
  `public/app-icon.ico` (generated from a teal-broom design to match
  `public/icon.svg`). **This shortcut only works while the local dev server
  (`npm run dev`) is running** — it points at `http://localhost:3000`, not a
  real internet address yet. Once you `/buddy finish` and deploy, you'll want
  a new shortcut (or just use the real installed PWA) pointing at the real
  URL instead.
- **Icon is a toilet + poop emoji** (🚽💩) per your request — both
  `public/icon.svg` (used in-browser/manifest) and `public/app-icon.ico` +
  `public/icon-256.png` (used by the desktop shortcut) were regenerated to
  match.

## Cleaning Downloads/Desktop/Documents: the command-line tool

Chrome has a **hard, unconditional block** on any website getting access to
Downloads, Desktop, Documents, or your whole user profile folder — the
picker dialog refuses to let you select them at all, for any site, no matter
what permission is requested. That's intentional browser security policy
with no workaround from the web app's side.

So there's a second, separate tool for exactly those folders:
**`clean-downloads.bat`** (also on your Desktop as "Clean My Sh\*t -
Downloads Tool") — a command-line version that talks to your real
filesystem directly through Node, which isn't subject to that browser
restriction at all. Double-click it (or drag a different folder onto it to
scan that instead of Downloads) and it will:

- Scan and list everything the web app would find, numbered.
- Let you type numbers (e.g. `3,5,10-14`) to pick what to delete.
- Ask for a final "yes" before doing anything.
- Send deleted items to the **Recycle Bin** — actually safer than the web
  app's delete, which can't use the Recycle Bin at all due to browser
  limitations. Anything deleted this way can be restored normally.

Under the hood it reuses the exact same scanning and deletion code as the
web app (`src/lib/scan.ts`, `src/lib/deletion.ts`) via a small adapter
(`scripts/node-fs-shim.ts`) that makes Node's filesystem look like the
browser's File System Access API — so a fix or category added to one
automatically applies to both.

There's also `scripts/verify-scan.ts` — a read-only version of the same idea
for quickly checking the scan logic against a real folder without risking
any deletion:

```
npx tsx scripts/verify-scan.ts "C:\path\to\a\folder"
```

## Next steps

- `/buddy save` after you make changes, to create another save point.
- `/buddy finish` when you're ready to put this on the internet so the link
  actually works for other people (right now it only runs on this computer).
