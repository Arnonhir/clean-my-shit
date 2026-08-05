import * as fs from "node:fs";
import * as path from "node:path";
import { Readable } from "node:stream";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  m4v: "video/x-m4v",
  wmv: "video/x-ms-wmv",
  avi: "video/x-msvideo",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const targetPath = url.searchParams.get("path");
  if (!targetPath) return new Response("Missing path", { status: 400 });

  let stat;
  try {
    stat = fs.statSync(targetPath);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const ext = path.extname(targetPath).slice(1).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";

  const range = request.headers.get("range");
  if (range) {
    const match = /bytes=(\d+)-(\d+)?/.exec(range);
    const start = match ? Number(match[1]) : 0;
    const end = match?.[2] ? Number(match[2]) : stat.size - 1;
    const nodeStream = fs.createReadStream(targetPath, { start, end });

    return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        "Content-Type": contentType,
      },
    });
  }

  const nodeStream = fs.createReadStream(targetPath);
  return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Length": String(stat.size),
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
    },
  });
}
