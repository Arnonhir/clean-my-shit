"use client";

import { formatBytes, formatDate } from "@/lib/format";
import type { DuplicateGroup, ScannedFile } from "@/lib/types";
import type { SelectionMap } from "@/lib/selection";
import type { TranslationKey } from "@/lib/i18n";
import FilePreview from "./FilePreview";

export default function DuplicateSection({
  groups,
  selected,
  onToggle,
  t,
}: {
  groups: DuplicateGroup[];
  selected: SelectionMap;
  onToggle: (id: string, file: ScannedFile) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-neutral-500 text-sm py-6 text-center">
        {t("noDuplicates")}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.id} className="rounded-lg border border-neutral-800 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-xs text-neutral-400">
              {group.changed
                ? t("duplicateVersions", { count: group.files.length })
                : t("duplicateCopies", {
                    count: group.files.length,
                    size: formatBytes(group.size),
                  })}
            </p>
            {group.changed && (
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-neutral-950">
                {t("duplicateChangedBadge")}
              </span>
            )}
            {!group.verified && (
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-neutral-950">
                {t("duplicateUnverified")}
              </span>
            )}
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
                  <p className="break-all text-sm font-medium" title={f.name}>{f.name}</p>
                  <p className="break-all text-xs text-neutral-500" title={f.path}>{f.path}</p>
                  <p className="text-xs text-neutral-500">
                    {t("duplicateCreated", { date: formatDate(f.lastModified) })} · {formatBytes(f.size)}
                  </p>
                  {f.id === group.recommendedKeepId && (
                    <p className="text-xs text-teal-500">
                      {group.changed ? t("duplicateKeepLatest") : t("duplicateOldest")}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
