"use client";

import { formatBytes, formatDate } from "@/lib/format";
import type { ScannedFile } from "@/lib/types";
import type { SelectionMap } from "@/lib/selection";

export default function FileListSection({
  files,
  selected,
  onToggle,
  emptyMessage,
  dateLabel = "Last touched",
}: {
  files: ScannedFile[];
  selected: SelectionMap;
  onToggle: (id: string, file: ScannedFile) => void;
  emptyMessage: string;
  dateLabel?: string;
}) {
  if (files.length === 0) {
    return <p className="text-neutral-500 text-sm py-6 text-center">{emptyMessage}</p>;
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
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{f.name}</p>
            <p className="truncate text-xs text-neutral-500">{f.path}</p>
          </div>
          <div className="shrink-0 text-right text-xs text-neutral-400">
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
