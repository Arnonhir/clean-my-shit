"use client";

import { formatDuration } from "@/lib/format";
import type { TranslationKey } from "@/lib/i18n";

export default function ProgressBar({
  label,
  done,
  total,
  etaSeconds,
  detail,
  t,
}: {
  label: string;
  done: number;
  total?: number;
  etaSeconds?: number;
  detail?: string;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  const pct = total && total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null;

  return (
    <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-neutral-200">{label}</p>
        {pct !== null && <p className="shrink-0 text-sm text-neutral-300">{pct}%</p>}
      </div>

      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-800">
        {pct !== null ? (
          <div
            className="h-full rounded-full bg-teal-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-teal-500/60" />
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-neutral-400">
        <p className="min-w-0 flex-1 truncate">
          {total
            ? t("progressCountOfTotal", { done: done.toLocaleString(), total: total.toLocaleString() })
            : t("progressFoundSoFar", { count: done.toLocaleString() })}
          {detail ? ` · ${detail}` : ""}
        </p>
        <p className="shrink-0">
          {etaSeconds !== undefined
            ? t("progressEtaLeft", { time: formatDuration(etaSeconds) })
            : total
              ? t("progressEtaCalculating")
              : ""}
        </p>
      </div>
    </div>
  );
}
