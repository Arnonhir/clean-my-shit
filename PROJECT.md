# Clean My Sh*t

A tool that scans a folder on your computer and finds junk worth deleting:
duplicate files (with a preview of each copy), files nobody's touched in
years, huge files, installed games gathering dust, and cache/temp clutter.

## How it works (the important bit)

This is **one app** — a single local web app you open at
`http://localhost:3000`, with a desktop shortcut so it opens like a normal
program. There is no separate tool for anything.

Under the hood it's a Next.js app with its own small server running on your
computer. When you browse to a folder and hit "Scan this folder," the
**server** (not your browser) reads the files directly through Node's normal
filesystem access — the same access any program on your computer has. That's
what makes it possible to scan **Downloads, Desktop, Documents, or your
whole user folder** with zero restrictions.

(Earlier versions of this app tried to do the scanning inside the browser
itself, using a browser feature that lets a page ask to open a folder. That
approach hit a wall: Chrome flatly refuses to let *any* website — including
this one — touch Downloads/Desktop/Documents/your home folder, on purpose,
so a malicious site can never get broad access to those folders. There was
no way around that from inside the browser, so the app was rebuilt to run
its own local server instead, which sidesteps the problem entirely and
removes the restriction for every folder, not just some.)

Because the server only runs on **your own computer** and only accepts
connections from this machine (see "Staying safe" below), this app is
inherently a "run it on your own computer" tool, not a public multi-user
website — which fits what it's actually for.

## The stack (and why)

- **Next.js (TypeScript, App Router)** — both the UI and a small local
  backend (API routes) in one project.
- **Tailwind CSS** — styling.
- **`trash`** (npm package) — sends deleted files to the Recycle Bin instead
  of permanently deleting them.
- Nothing leaves your computer. No accounts, no cloud, no external requests.

## What it checks for

1. **Duplicates** — grouped by matching size + content, each copy shown with
   a thumbnail (photos/videos), name, path, and date, so you can tell which
   one to keep.
2. **Old & untouched** — not modified in a year or more.
3. **Big files** — anything over 100 MB, biggest first.
4. **Unplayed games** — folders under common game library locations (Steam,
   Epic, GOG, etc.), using the newest file inside as a "last played" guess.
   (There's no direct way to ask Steam what you've actually played, so this
   is an approximation.)
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

Deletion goes through the Recycle Bin (via the `trash` package) — not a
permanent delete. There's still a big confirmation warning before anything
happens, both because it's the responsible default for a tool that deletes
things, and because there's no folder this app can't reach anymore, so the
confirmation step matters more, not less.

## Browsing to a folder

There's no native "choose a folder" dialog anymore — instead there's an
in-app folder browser: quick-link buttons (Home, Desktop, Documents,
Downloads, Pictures, Videos — resolved from Windows' real folder locations,
which matters because OneDrive can relocate Desktop/Documents/Pictures away
from their default spot), a breadcrumb-style folder list, and a text box to
type/paste a path directly (useful for a different drive, e.g. `D:\Games`).

## Language

There's a 🌐 toggle in the top-right that switches all UI text between
English and Hebrew (עברית), including switching the layout to right-to-left
for Hebrew. Your choice is remembered (saved in the browser) for next time.
File names/paths themselves aren't translated — only the app's own labels.

## Staying safe

Since this app can read and delete files anywhere on the computer, two
things keep that contained to *this* computer:

- The server only listens on `127.0.0.1` (`npm run dev`/`npm start` both
  pass `-H 127.0.0.1`) — other devices on the same network/WiFi cannot reach
  it, only processes on this machine.
- Deletes go to the Recycle Bin, not a permanent delete, and always require
  the in-app confirmation step first.

## How to run it locally

```
npm run dev
```
Then open http://localhost:3000 — or just use the desktop shortcut.

## Desktop icon

There's a real shortcut on your Desktop — "Clean My Sh\*t" — that opens the
app in its own clean window (`chrome.exe --app=...`, using a separate small
Chrome profile so it doesn't touch your normal Chrome tabs/history). Icon:
`public/app-icon-v2.ico` (🚽💩, matching `public/icon.svg`).

**This shortcut needs the local server running** (`npm run dev`) — it's not
a real internet address yet. `/buddy finish` would deploy this somewhere
with a real URL, but note that deployment doesn't make sense for *this* app
in its current form: hosting it publicly would mean the **server's own
disk** gets scanned, not the visitor's computer. This is meant to run
locally, one instance per computer — which is also exactly why the app
integrates the scan+browse+delete server directly instead of being a plain
static site.

## Decisions made so far

- **Moved off Google Drive.** The project was first scaffolded in
  `G:\האחסון שלי\Git`, a Google Drive–synced folder — installing dependencies
  there (tens of thousands of small files) was extremely slow and actually
  corrupted mid-install. The project now lives locally at
  `C:\Users\user\Projects\clean-my-shit` — keep it here, or anywhere that
  isn't inside a cloud-synced folder, for the same reason.
- **App name is literally "Clean My Sh*t"** and the icon is 🚽💩, both per
  your request — used as-is in the page title, manifest, and desktop icon.
- **Rebuilt from "browser picks the folder" to "local server does
  everything."** The original design used the browser's own folder-access
  feature, which turned out to flatly refuse Downloads/Desktop/Documents/home
  for every website, no exceptions. Rather than ship two separate tools (a
  web app for most folders + a command-line tool for the blocked ones), the
  whole app was rewritten around a local server that has no such
  restriction — one app, every folder, no exceptions.
- **Windows "known folder" resolution fixed twice**: once to point Desktop/
  Documents/Downloads at their *real* location (OneDrive can relocate them),
  and once to fix Hebrew folder names coming back corrupted from PowerShell
  (its default output encoding isn't UTF-8 unless forced explicitly).

## Next steps

- `/buddy save` after you make changes, to create another save point.
- If you ever want this reachable from another device you own (e.g. a
  laptop), that's a different, smaller project — worth a fresh conversation
  about what's actually needed, rather than folding it into this one.
