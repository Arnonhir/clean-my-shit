"use client";

import { useEffect, useRef, useState } from "react";
import { formatBytes, formatDate } from "@/lib/format";
import { streamNdjson } from "@/lib/streamNdjson";
import { computeEta, type EtaTracker } from "@/lib/eta";
import type { TranslationKey } from "@/lib/i18n";
import type { InstalledApp, SoftwareAnalysis, SoftwareProgress } from "@/lib/types";
import ProgressBar from "./ProgressBar";
import DriveSpaceBar from "./DriveSpaceBar";

type SoftwareEvent =
  | { type: "progress"; progress: SoftwareProgress }
  | { type: "done"; results: SoftwareAnalysis }
  | { type: "error"; error: string };

const REC_ORDER: Record<InstalledApp["recommendation"], number> = { remove: 0, review: 1, keep: 2 };
const REC_STYLE: Record<InstalledApp["recommendation"], string> = {
  remove: "bg-red-500 text-neutral-950",
  review: "bg-amber-400 text-neutral-950",
  keep: "bg-neutral-700 text-neutral-200",
};
const REC_LABEL_KEY: Record<InstalledApp["recommendation"], TranslationKey> = {
  remove: "softwareRecRemove",
  review: "softwareRecReview",
  keep: "softwareRecKeep",
};
const PHASE_LABEL_KEY: Record<SoftwareProgress["phase"], TranslationKey> = {
  listing: "softwareListing",
  measuring: "softwareMeasuring",
  done: "softwareMeasuring",
};

function openInFolder(absPath: string) {
  fetch("/api/reveal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ absPath }),
  });
}

function openUninstallSettings() {
  fetch("/api/open-settings", { method: "POST" });
}

export default function SoftwarePanel({
  t,
}: {
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<(SoftwareProgress & { etaSeconds?: number }) | null>(null);
  const [results, setResults] = useState<SoftwareAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const etaRef = useRef<EtaTracker | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function load() {
      setLoading(true);
      setError(null);
      setProgress(null);
      etaRef.current = null;
      try {
        await streamNdjson<SoftwareEvent>("/api/installed-software", undefined, (event) => {
          if (event.type === "progress") {
            const p = event.progress;
            const etaSeconds = computeEta(etaRef, p.phase, p.done, p.total);
            setProgress({ ...p, etaSeconds });
          } else if (event.type === "done") {
            setResults(event.results);
          } else if (event.type === "error") {
            setError(event.error);
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="mt-4">
      <p className="text-sm text-neutral-400">{t("softwareTagline")}</p>

      {loading && (
        <ProgressBar
          label={t(PHASE_LABEL_KEY[progress?.phase ?? "listing"], { name: progress?.currentName ?? "" })}
          done={progress?.done ?? 0}
          total={progress?.total}
          etaSeconds={progress?.etaSeconds}
          t={t}
        />
      )}

      {error && (
        <p className="mt-4 rounded-md bg-red-950/50 border border-red-900 p-3 text-sm text-red-300">
          {t("errorPrefix")} {error}
        </p>
      )}

      {results && (
        <div className="mt-6 space-y-6">
          {results.drives.length > 0 && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <p className="text-sm font-medium text-neutral-200">{t("driveUsageTitle")}</p>
              <div className="mt-3 space-y-3">
                {results.drives.map((d) => (
                  <DriveSpaceBar key={d.name} drive={d} t={t} />
                ))}
              </div>
            </div>
          )}

          <SoftwareSummary apps={results.apps} t={t} />

          {results.apps.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-400">{t("softwareEmpty")}</p>
          ) : (
            <ul className="divide-y divide-neutral-800">
              {[...results.apps]
                .sort((a, b) => REC_ORDER[a.recommendation] - REC_ORDER[b.recommendation] || b.size - a.size)
                .map((app) => (
                  <li key={app.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="break-all text-sm font-medium text-neutral-100" title={app.name}>
                          {app.name}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${REC_STYLE[app.recommendation]}`}
                        >
                          {t(REC_LABEL_KEY[app.recommendation])}
                        </span>
                      </div>
                      <p className="break-all text-xs text-neutral-400">
                        {app.publisher ? `${app.publisher} · ` : ""}
                        {formatBytes(app.size)}
                        {app.lastModified ? ` · ${t("softwareLastTouched", { date: formatDate(app.lastModified) })}` : ""}
                        {app.installDate ? ` · ${t("softwareInstalled", { date: app.installDate })}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        title={t("showInFolder")}
                        onClick={() => openInFolder(app.absPath)}
                        className="rounded-md p-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white"
                      >
                        📂
                      </button>
                      <button
                        type="button"
                        onClick={openUninstallSettings}
                        className="rounded-md border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
                      >
                        {t("softwareOpenSettings")}
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          )}

          {results.orphanedRegistryCount > 0 && (
            <p className="text-xs text-neutral-500">
              {t("softwareOrphanedNote", { count: results.orphanedRegistryCount })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SoftwareSummary({
  apps,
  t,
}: {
  apps: InstalledApp[];
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  const removable = apps.filter((a) => a.recommendation === "remove");
  if (removable.length === 0) {
    return (
      <p className="rounded-md bg-teal-950/50 border border-teal-900 p-3 text-sm text-teal-300">
        {t("softwareSummaryNone")}
      </p>
    );
  }
  const totalSize = removable.reduce((s, a) => s + a.size, 0);
  return (
    <p className="rounded-md bg-amber-950/40 border border-amber-900 p-3 text-sm text-amber-200">
      {t("softwareSummaryRemove", { size: formatBytes(totalSize), count: removable.length })}
    </p>
  );
}
