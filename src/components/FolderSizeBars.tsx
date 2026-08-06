"use client";

import { formatBytes } from "@/lib/format";
import type { TranslationKey } from "@/lib/i18n";
import type { FolderSizeEntry } from "@/lib/types";

export default function FolderSizeBars({
  entries,
  totalBytes,
  onScan,
  t,
}: {
  entries: FolderSizeEntry[];
  totalBytes: number;
  onScan: (absPath: string) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  if (entries.length === 0) return null;

  const maxSize = Math.max(...entries.map((e) => e.size));

  return (
    <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-neutral-200">{t("folderSizesTitle")}</p>
        <p className="shrink-0 text-xs text-neutral-400">{t("folderSizesClickHint")}</p>
      </div>

      <ul className="mt-3 space-y-2.5">
        {entries.map((entry) => {
          const label = entry.isLoose
            ? t("folderSizesLooseLabel")
            : entry.isOther
              ? t("folderSizesOtherLabel")
              : entry.name;
          const pct = totalBytes > 0 ? Math.round((entry.size / totalBytes) * 100) : 0;
          const barPct = maxSize > 0 ? (entry.size / maxSize) * 100 : 0;
          const clickable = !!entry.absPath;

          return (
            <li key={entry.isLoose ? "\0loose" : entry.isOther ? "\0other" : entry.absPath}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onScan(entry.absPath)}
                className={`w-full text-left ${clickable ? "cursor-pointer group" : "cursor-default"}`}
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span
                    className={`truncate font-medium ${clickable ? "text-neutral-200 group-hover:text-teal-400" : "text-neutral-400"}`}
                    title={label}
                  >
                    {!entry.isLoose && !entry.isOther && "📁 "}
                    {label}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {formatBytes(entry.size)} · {t("folderSizesPctOfTotal", { pct })}
                  </span>
                </div>
                <div className="mt-1 h-4 w-full overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className={`h-full rounded-full ${clickable ? "bg-teal-500" : "bg-neutral-600"}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
