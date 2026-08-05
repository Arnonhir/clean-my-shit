import { NextResponse } from "next/server";
import { deleteAll } from "@/lib/deletion";
import type { DeleteRequestItem } from "@/lib/types";

// Streams progress the same way /api/scan does, so a large delete (which
// still takes a few seconds even chunked) shows a live percentage instead
// of a silent wait.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const items = body?.items;

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "Missing items" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      const outcome = await deleteAll(items as DeleteRequestItem[], (done, total) =>
        send({ type: "progress", done, total })
      );
      send({ type: "done", outcome });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
