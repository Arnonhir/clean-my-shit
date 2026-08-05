"use client";

import { useEffect, useState } from "react";
import { IMAGE_EXTS, VIDEO_EXTS, type ScannedFile } from "@/lib/types";

export default function FilePreview({ file }: { file: ScannedFile }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = IMAGE_EXTS.has(file.ext);
  const isVideo = VIDEO_EXTS.has(file.ext);

  useEffect(() => {
    if (!isImage && !isVideo) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    file.handle.getFile().then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, isImage, isVideo]);

  if (isImage) {
    return url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={file.name}
        className="h-16 w-16 rounded-md object-cover bg-neutral-800"
      />
    ) : (
      <div className="h-16 w-16 rounded-md bg-neutral-800 animate-pulse" />
    );
  }

  if (isVideo) {
    return url ? (
      <video
        src={url}
        muted
        preload="metadata"
        className="h-16 w-16 rounded-md object-cover bg-neutral-800"
      />
    ) : (
      <div className="h-16 w-16 rounded-md bg-neutral-800 animate-pulse" />
    );
  }

  return (
    <div className="h-16 w-16 rounded-md bg-neutral-800 flex items-center justify-center text-2xl">
      📄
    </div>
  );
}
