"use client";

import { formatBytes, formatDate } from "@/lib/format";
import type { ScannedFile } from "@/lib/types";
import type { SelectionMap } from "@/lib/selection";
import type { TranslationKey } from "@/lib/i18n";
import FilePreview from "./FilePreview";

function openFile(absPath: string) {
  fetch("/api/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ absPath }),
  });
}

function revealFile(absPath: string) {
  fetch("/api/reveal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ absPath }),
  });
}

export default function FileListSection({
  files,
  selected,
  onToggle,
  emptyMessage,
  dateLabel = "Last touched",
  t,
}: {
  files: ScannedFile[];
  selected: SelectionMap;
  onToggle: (id: string, file: ScannedFile) => void;
  emptyMessage: string;
  dateLabel?: string;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  if (files.length === 0) {
    return <p className="text-neutral-400 text-sm py-6 text-center">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-neutral-800">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-3 py-2.5">
          <input
            type="checkbox"
            checked={selected.has(f.id)}
            onChange={() => onToggle(f.id, f)}
            className="h-4 w-4 shrink-0 accent-teal-500"
          />
          <FilePreview file={f} />
          <div className="min-w-0 flex-1">
            <p className="break-all text-sm font-medium" title={f.name}>{f.name}</p>
            <p className="break-all text-xs text-neutral-400" title={f.path}>{f.path}</p>
          </div>
          <div className="shrink-0 flex items-center gap-1">
            <button
              type="button"
              title={t("openFile")}
              onClick={() => openFile(f.absPath)}
              className="rounded-md p-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white"
            >
              ↗️
            </button>
            <button
              type="button"
              title={t("showInFolder")}
              onClick={() => revealFile(f.absPath)}
              className="rounded-md p-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white"
            >
              📂
            </button>
          </div>
          <div className="shrink-0 text-right text-xs text-neutral-300">
            <p>{formatBytes(f.size)}</p>
            <p>
              {dateLabel} {formatDate(f.lastModified)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
