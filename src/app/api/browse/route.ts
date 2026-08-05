import { NextResponse } from "next/server";
import * as os from "node:os";
import { browse, getQuickLinks } from "@/lib/browse";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const targetPath = url.searchParams.get("path") || os.homedir();
  const result = await browse(targetPath);
  return NextResponse.json({ ...result, quickLinks: getQuickLinks() });
}
