import { execFile } from "node:child_process";
import { NextResponse } from "next/server";

// Opens File Explorer with the file highlighted, via explorer's /select
// flag. execFile passes absPath as part of one argument array entry (no
// shell), so it's safe even with spaces/parens/Hebrew in the path.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const absPath = body?.absPath;
  if (!absPath || typeof absPath !== "string") {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }
  execFile("explorer.exe", [`/select,${absPath}`], () => {});
  return NextResponse.json({ ok: true });
}
