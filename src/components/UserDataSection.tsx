"use client";

import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/format";
import { streamNdjson } from "@/lib/streamNdjson";
import type { TranslationKey } from "@/lib/i18n";
import type { UserDataAnalysis, UserDataProgress } from "@/lib/types";
import ProgressBar from "./ProgressBar";

type UserDataEvent =
  | { type: "progress"; progress: UserDataProgress }
  | { type: "done"; results: UserDataAnalysis }
  | { type: "error"; error: string };

const TIER_EMOJI = ["🧼", "🙂", "💩", "💩", "💩"] as const;
const TIER_LABEL_KEY: TranslationKey[] = [
  "shittyTier0Label",
  "shittyTier1Label",
  "shittyTier2Label",
  "shittyTier3Label",
  "shittyTier4Label",
];
const TIER_COLOR = ["#34d399", "#a3e635", "#facc15", "#fb923c", "#f87171"] as const;

export default function UserDataSection({
  drive,
  onScanFolder,
  t,
}: {
  drive: string;
  onScanFolder: (absPath: string) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<UserDataProgress | null>(null);
  const [results, setResults] = useState<UserDataAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function analyze() {
      setLoading(true);
      setError(null);
      setResults(null);
      setProgress(null);
      try {
        await streamNdjson<UserDataEvent>(`/api/user-data?drive=${encodeURIComponent(drive)}`, undefined, (event) => {
          if (cancelled) return;
          if (event.type === "progress") setProgress(event.progress);
          else if (event.type === "done") setResults(event.results);
          else if (event.type === "error") setError(event.error);
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setProgress(null);
        }
      }
    }

    analyze();
    return () => {
      cancelled = true;
    };
  }, [drive]);

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <p className="text-sm font-medium text-neutral-200">{t("userDataTitle")}</p>
      <p className="mt-1 text-xs text-neutral-400">{t("userDataTagline")}</p>

      {loading && (
        <div className="mt-3">
          <ProgressBar
            label={t("userDataScanning", { name: progress?.currentName ?? "" })}
            done={progress?.done ?? 0}
            total={progress?.total}
            t={t}
          />
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-md bg-red-950/50 border border-red-900 p-3 text-sm text-red-300">
          {t("errorPrefix")} {error}
        </p>
      )}

      {results && (
        <div className="mt-4 space-y-3">
          {results.folders.length === 0 ? (
            <p className="text-sm text-neutral-400">{t("userDataEmpty")}</p>
          ) : (
            <>
              <p
                className={`rounded-md border p-3 text-sm ${
                  results.totalReclaimableBytes > 0
                    ? "border-amber-900 bg-amber-950/40 text-amber-200"
                    : "border-teal-900 bg-teal-950/50 text-teal-300"
                }`}
              >
                {results.totalReclaimableBytes > 0
                  ? t("userDataTotalReclaimable", { size: formatBytes(results.totalReclaimableBytes) })
                  : t("userDataNoneReclaimable")}
              </p>
              <ul className="divide-y divide-neutral-800">
                {results.folders.map((f) => (
                  <li key={f.absPath} className="flex items-center gap-3 py-3">
                    <span style={{ fontSize: 28 }} aria-hidden>
                      {TIER_EMOJI[f.shittinessTier]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-neutral-100">{f.label}</p>
                        <span
                          className="text-xs font-semibold"
                          style={{ color: TIER_COLOR[f.shittinessTier] }}
                        >
                          {t(TIER_LABEL_KEY[f.shittinessTier])}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400">
                        {formatBytes(f.totalBytes)}
                        {f.reclaimableBytes > 0
                          ? ` · ${t("userDataReclaimable", { size: formatBytes(f.reclaimableBytes) })}`
                          : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => onScanFolder(f.absPath)}
                      className="shrink-0 rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
                    >
                      {t("userDataScanFolder")}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
