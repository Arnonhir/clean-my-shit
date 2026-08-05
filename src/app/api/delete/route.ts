import { NextResponse } from "next/server";
import { deleteAll } from "@/lib/deletion";
import type { DeleteRequestItem } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const items = body?.items;

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "Missing items" }, { status: 400 });
  }

  const outcome = await deleteAll(items as DeleteRequestItem[]);
  return NextResponse.json(outcome);
}
