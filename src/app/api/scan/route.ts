import { NextResponse } from "next/server";
import { scanFolder } from "@/lib/scan";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const targetPath = body?.path;

  if (!targetPath || typeof targetPath !== "string") {
    return NextResponse.json({ error: "Missing folder path" }, { status: 400 });
  }

  try {
    const results = await scanFolder(targetPath, () => {});
    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
