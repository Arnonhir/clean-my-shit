"use client";

import { IMAGE_EXTS, VIDEO_EXTS, type ScannedFile } from "@/lib/types";

export default function FilePreview({ file }: { file: ScannedFile }) {
  const isImage = IMAGE_EXTS.has(file.ext);
  const isVideo = VIDEO_EXTS.has(file.ext);
  const src = `/api/preview?path=${encodeURIComponent(file.absPath)}`;

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={file.name}
        loading="lazy"
        className="h-16 w-16 rounded-md object-cover bg-neutral-800"
      />
    );
  }

  if (isVideo) {
    return (
      <video
        src={src}
        muted
        preload="metadata"
        className="h-16 w-16 rounded-md object-cover bg-neutral-800"
      />
    );
  }

  return (
    <div className="h-16 w-16 rounded-md bg-neutral-800 flex items-center justify-center text-2xl">
      📄
    </div>
  );
}
