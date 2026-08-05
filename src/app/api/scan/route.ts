import { NextResponse } from "next/server";
import { scanFolder } from "@/lib/scan";

// Streams newline-delimited JSON progress events instead of one big response
// at the end, so the client can show a live percentage/ETA on scans that
// take a while (large drives, network folders, etc.) instead of a silent
// wait that's indistinguishable from being frozen.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const targetPath = body?.path;

  if (!targetPath || typeof targetPath !== "string") {
    return NextResponse.json({ error: "Missing folder path" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      try {
        const results = await scanFolder(targetPath, (progress) => send({ type: "progress", progress }));
        send({ type: "done", results });
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
