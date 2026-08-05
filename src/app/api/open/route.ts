import { execFile } from "node:child_process";
import { NextResponse } from "next/server";

// Opens a file with its default associated app. execFile passes absPath as
// a single argument (no shell involved), so unusual characters in the path
// (spaces, parens, Hebrew) can't break out into a shell injection.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const absPath = body?.absPath;
  if (!absPath || typeof absPath !== "string") {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }
  execFile("explorer.exe", [absPath], () => {
    // explorer.exe often reports a nonzero exit code even when it
    // successfully opened something - nothing useful to check here.
  });
  return NextResponse.json({ ok: true });
}
