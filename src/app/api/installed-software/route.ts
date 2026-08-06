import { getDriveSpace, listInstalledApps } from "@/lib/installedSoftware";

// Streams progress the same way /api/scan does - measuring real disk usage
// for each installed program (a readdir+stat walk per app) can take a few
// seconds with 40+ programs installed, so a live "measuring App X" beats a
// silent wait.
export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      try {
        const drives = await getDriveSpace();
        const { apps, orphanedRegistryCount } = await listInstalledApps((progress) =>
          send({ type: "progress", progress })
        );
        send({ type: "done", results: { drives, apps, orphanedRegistryCount } });
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
