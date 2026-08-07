"use client";

import { useEffect, useRef, useState } from "react";
import { formatBytes, formatDate } from "@/lib/format";
import { streamNdjson } from "@/lib/streamNdjson";
import { computeEta, type EtaTracker } from "@/lib/eta";
import type { TranslationKey } from "@/lib/i18n";
import type { DriveSpaceInfo, InstalledApp, SoftwareAnalysis, SoftwareProgress } from "@/lib/types";
import ProgressBar from "./ProgressBar";
import DriveSpaceBar from "./DriveSpaceBar";
import UserDataSection from "./UserDataSection";

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
const SOURCE_LABEL_KEY: Record<InstalledApp["source"], TranslationKey> = {
  registry: "softwareSourceRegistry",
  appx: "softwareSourceAppx",
  gameFolder: "softwareSourceGameFolder",
};
const SOURCE_ICON: Record<InstalledApp["source"], string> = {
  registry: "📋",
  appx: "🏪",
  gameFolder: "🎮",
};

// The reason a "remove"/"review" recommendation fired - "keep" doesn't need
// justifying. Maps (recommendation, trigger) to the sentence explaining it.
function reasonKeyFor(app: InstalledApp): TranslationKey | null {
  if (app.recommendation === "remove") return "softwareReasonRemove";
  if (app.recommendation === "review") {
    if (app.recommendationTrigger === "sizeAndStale") return "softwareReasonReviewBoth";
    if (app.recommendationTrigger === "size") return "softwareReasonReviewSize";
    if (app.recommendationTrigger === "staleness") return "softwareReasonReviewStale";
  }
  return null;
}

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
  onScanFolder,
}: {
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  onScanFolder: (absPath: string) => void;
}) {
  const [drives, setDrives] = useState<DriveSpaceInfo[] | null>(null);
  const [drivesError, setDrivesError] = useState<string | null>(null);
  const [selectedDrive, setSelectedDrive] = useState<DriveSpaceInfo | null>(null);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<(SoftwareProgress & { etaSeconds?: number }) | null>(null);
  const [results, setResults] = useState<SoftwareAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const etaRef = useRef<EtaTracker | null>(null);

  useEffect(() => {
    fetch("/api/drives")
      .then((res) => res.json())
      .then((data) => setDrives(data.drives))
      .catch((err) => setDrivesError(err instanceof Error ? err.message : String(err)));
  }, []);

  async function analyzeDrive(drive: DriveSpaceInfo) {
    setSelectedDrive(drive);
    setResults(null);
    setError(null);
    setProgress(null);
    etaRef.current = null;
    setLoading(true);
    try {
      const driveLetter = drive.name.replace(/[\\/]+$/, "");
      await streamNdjson<SoftwareEvent>(
        `/api/installed-software?drive=${encodeURIComponent(driveLetter)}`,
        undefined,
        (event) => {
          if (event.type === "progress") {
            const p = event.progress;
            const etaSeconds = computeEta(etaRef, p.phase, p.done, p.total);
            setProgress({ ...p, etaSeconds });
          } else if (event.type === "done") {
            setResults(event.results);
          } else if (event.type === "error") {
            setError(event.error);
          }
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  function changeDrive() {
    setSelectedDrive(null);
    setResults(null);
    setError(null);
  }

  return (
    <div className="mt-4">
      <h2 className="text-base font-semibold text-neutral-100">{t("softwareTitle")}</h2>
      <p className="mt-1 text-sm text-neutral-400">{t("softwareTagline")}</p>

      {drivesError && (
        <p className="mt-4 rounded-md bg-red-950/50 border border-red-900 p-3 text-sm text-red-300">
          {t("errorPrefix")} {drivesError}
        </p>
      )}

      {!selectedDrive && (
        <div className="mt-6">
          <p className="text-sm font-medium text-neutral-200">{t("softwareChooseDrive")}</p>
          <div className="mt-3 space-y-2">
            {(drives ?? []).map((d) => (
              <button
                key={d.name}
                onClick={() => analyzeDrive(d)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-left hover:border-teal-700 hover:bg-neutral-900"
              >
                <DriveSpaceBar drive={d} t={t} />
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedDrive && (
        <div className="mt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex flex-1 items-center justify-between gap-2">
              <div className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                <DriveSpaceBar drive={selectedDrive} t={t} />
              </div>
              <button
                onClick={changeDrive}
                className="shrink-0 rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-900"
              >
                {t("softwareChangeDrive")}
              </button>
            </div>
            <CriteriaTable t={t} />
          </div>

          <div className="mt-4">
            <UserDataSection drive={selectedDrive.name.replace(/[\\/]+$/, "")} onScanFolder={onScanFolder} t={t} />
          </div>

          {loading && (
            <div className="mt-4">
              <ProgressBar
                label={t(PHASE_LABEL_KEY[progress?.phase ?? "listing"], { name: progress?.currentName ?? "" })}
                done={progress?.done ?? 0}
                total={progress?.total}
                etaSeconds={progress?.etaSeconds}
                t={t}
              />
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-md bg-red-950/50 border border-red-900 p-3 text-sm text-red-300">
              {t("errorPrefix")} {error}
            </p>
          )}

          {results && (
            <div className="mt-6 space-y-6">
              <SoftwareSummary apps={results.apps} t={t} />

              {results.apps.length === 0 ? (
                <p className="py-6 text-center text-sm text-neutral-400">{t("softwareEmpty")}</p>
              ) : (
                <ul className="divide-y divide-neutral-800">
                  {[...results.apps]
                    .sort((a, b) => REC_ORDER[a.recommendation] - REC_ORDER[b.recommendation] || b.size - a.size)
                    .map((app) => {
                      const reasonKey = reasonKeyFor(app);
                      return (
                        <li key={app.id} className="flex items-center gap-3 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="shrink-0 text-xs"
                                title={t(SOURCE_LABEL_KEY[app.source])}
                              >
                                {SOURCE_ICON[app.source]}
                              </span>
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
                            {reasonKey && (
                              <p className="mt-0.5 text-xs text-neutral-500">{t(reasonKey)}</p>
                            )}
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
                      );
                    })}
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
      )}
    </div>
  );
}

function CriteriaTable({
  t,
}: {
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className="shrink-0 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/50">
      <p className="border-b border-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300">
        {t("softwareCriteriaTitle")}
      </p>
      <table className="text-xs">
        <thead>
          <tr className="text-neutral-500">
            <th className="px-3 py-1 text-left font-normal"> </th>
            <th className="px-3 py-1 text-left font-normal">{t("softwareCriteriaSize")}</th>
            <th className="px-3 py-1 text-left font-normal">{t("softwareCriteriaTime")}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-neutral-800">
            <td className="px-3 py-1 font-medium text-red-400">{t("softwareRecRemove")}</td>
            <td className="px-3 py-1 text-neutral-300">{t("softwareCriteriaRemoveSize")}</td>
            <td className="px-3 py-1 text-neutral-300">{t("softwareCriteriaRemoveTime")}</td>
          </tr>
          <tr className="border-t border-neutral-800">
            <td className="px-3 py-1 font-medium text-amber-400">{t("softwareRecReview")}</td>
            <td className="px-3 py-1 text-neutral-300">{t("softwareCriteriaReviewSize")}</td>
            <td className="px-3 py-1 text-neutral-300">{t("softwareCriteriaReviewTime")}</td>
          </tr>
          <tr className="border-t border-neutral-800">
            <td className="px-3 py-1 font-medium text-neutral-400">{t("softwareRecKeep")}</td>
            <td className="px-3 py-1 text-neutral-500">{t("softwareCriteriaKeepSize")}</td>
            <td className="px-3 py-1 text-neutral-500">{t("softwareCriteriaKeepTime")}</td>
          </tr>
        </tbody>
      </table>
      <p className="border-t border-neutral-800 px-3 py-1.5 text-[10px] text-neutral-500">
        {t("softwareRecRemove")}: {t("softwareCriteriaRemoveNote")} · {t("softwareRecReview")}:{" "}
        {t("softwareCriteriaReviewNote")}
      </p>
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
