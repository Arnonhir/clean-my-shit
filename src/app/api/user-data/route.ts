import { analyzeUserDataFolders } from "@/lib/userData";

// Streams progress the same way the other Drive Analysis routes do - each
// folder here is a full "Clean up files"-style scan (including content
// hashing for duplicates), so a handful of folders can take a while.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const drive = searchParams.get("drive");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      try {
        if (!drive) throw new Error("Missing drive parameter");
        const results = await analyzeUserDataFolders(drive, (progress) =>
          send({ type: "progress", progress })
        );
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
