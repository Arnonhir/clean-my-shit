"use client";

import { formatBytes, formatDate, daysAgo } from "@/lib/format";
import type { FolderAggregate } from "@/lib/types";
import type { SelectionMap } from "@/lib/selection";
import type { Lang } from "@/lib/i18n";

export default function FolderAggregateSection({
  folders,
  selected,
  onToggle,
  emptyMessage,
  dateLabel = "Last touched",
  lang,
}: {
  folders: FolderAggregate[];
  selected: SelectionMap;
  onToggle: (id: string, folder: FolderAggregate) => void;
  emptyMessage: string;
  dateLabel?: string;
  lang: Lang;
}) {
  if (folders.length === 0) {
    return <p className="text-neutral-400 text-sm py-6 text-center">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-neutral-800">
      {folders.map((f) => (
        <li key={f.id} className="flex items-center gap-3 py-2.5">
          <input
            type="checkbox"
            checked={selected.has(f.id)}
            onChange={() => onToggle(f.id, f)}
            className="h-4 w-4 shrink-0 accent-teal-500"
          />
          <div className="min-w-0 flex-1">
            <p className="break-all text-sm font-medium" title={f.name}>📁 {f.name}</p>
            <p className="break-all text-xs text-neutral-400" title={f.path}>
              {f.path} · {f.fileCount.toLocaleString()} files
            </p>
          </div>
          <div className="shrink-0 text-right text-xs text-neutral-400">
            <p>{formatBytes(f.size)}</p>
            <p>
              {dateLabel} {formatDate(f.lastModified, lang)} ({daysAgo(f.lastModified)}d ago)
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
