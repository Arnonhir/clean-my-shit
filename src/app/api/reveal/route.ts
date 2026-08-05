import { execFile } from "node:child_process";
import * as path from "node:path";
import { NextResponse } from "next/server";

// Opens File Explorer at the file's containing folder.
//
// The "obvious" way to do this is `explorer.exe /select,<path>` so the file
// itself is highlighted - but /select and the path have to be jammed into
// one argument (comma-separated, no space), and explorer's own parsing of
// that combined argument is unreliable once the path contains spaces or
// parentheses (extremely common in real filenames - "Fight Club (1999)
// [1080p]", "CamScanner 10-29-2022 10.06(1)"). It would silently open the
// wrong folder or truncate the path instead of erroring, so there was no
// way to detect the failure short of a bug report ("the link doesn't open
// the right folder").
//
// Opening the parent folder as a single, ordinary argument (no embedded
// flag, no comma) is something execFile quotes correctly regardless of
// spaces/parens/Hebrew - same as /api/open already does - so it trades
// away highlighting the exact file for actually being reliable.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const absPath = body?.absPath;
  if (!absPath || typeof absPath !== "string") {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }
  execFile("explorer.exe", [path.dirname(absPath)], () => {});
  return NextResponse.json({ ok: true });
}
