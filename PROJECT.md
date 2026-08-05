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

Deletion happens through the same browser permission the folder picker
grants — there's a big warning before anything is deleted, because **browser
deletion is permanent and does not go through the Recycle Bin**. There's no
undo, so the confirm step is intentionally a little annoying.

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
- **Desktop icon**: the app has a web manifest + icon, so once it's live,
  Chrome/Edge's "Install app" option will put a real icon on the desktop for
  anyone who visits the link — no separate installer needed.

## Next steps

- `/buddy save` after you make changes, to create another save point.
- `/buddy finish` when you're ready to put this on the internet so the link
  actually works for other people (right now it only runs on this computer).
