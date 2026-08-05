"use client";

import { formatBytes, formatDate } from "@/lib/format";
import type { DuplicateGroup, ScannedFile } from "@/lib/types";
import type { SelectionMap } from "@/lib/selection";
import FilePreview from "./FilePreview";

export default function DuplicateSection({
  groups,
  selected,
  onToggle,
}: {
  groups: DuplicateGroup[];
  selected: SelectionMap;
  onToggle: (id: string, file: ScannedFile) => void;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-neutral-500 text-sm py-6 text-center">
        No duplicate files found. 🎉
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        // The oldest copy is assumed to be "the original" and left unchecked by default.
        const oldestId = group.files[0]?.id;
        return (
          <div
            key={group.id}
            className="rounded-lg border border-neutral-800 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-neutral-400">
                {group.files.length} copies · {formatBytes(group.size)} each
                {!group.verified && (
                  <span className="ml-2 rounded bg-amber-900/40 px-1.5 py-0.5 text-amber-400">
                    ⚠ not fully verified — very large file, matched by size + start/end only
                  </span>
                )}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {group.files.map((f) => (
                <label
                  key={f.id}
                  className="flex items-center gap-3 rounded-md bg-neutral-900 p-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(f.id)}
                    onChange={() => onToggle(f.id, f)}
                    className="h-4 w-4 shrink-0 accent-teal-500"
                  />
                  <FilePreview file={f} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                    <p className="truncate text-xs text-neutral-500">{f.path}</p>
                    <p className="text-xs text-neutral-500">
                      Created/modified {formatDate(f.lastModified)}
                    </p>
                    {f.id === oldestId && (
                      <p className="text-xs text-teal-500">
                        Oldest copy — probably the original
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
