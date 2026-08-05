"use client";

import type { EmptyFolder } from "@/lib/types";
import type { SelectionMap } from "@/lib/selection";

export default function EmptyFolderSection({
  folders,
  selected,
  onToggle,
  emptyMessage,
}: {
  folders: EmptyFolder[];
  selected: SelectionMap;
  onToggle: (id: string, folder: EmptyFolder) => void;
  emptyMessage: string;
}) {
  if (folders.length === 0) {
    return (
      <p className="text-neutral-400 text-sm py-6 text-center">
        {emptyMessage}
      </p>
    );
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
            <p className="break-all text-xs text-neutral-400" title={f.path}>{f.path}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
