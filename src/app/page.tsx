"use client";

import { useMemo, useRef, useState } from "react";
import { formatBytes } from "@/lib/format";
import { useLanguage } from "@/lib/useLanguage";
import { streamNdjson } from "@/lib/streamNdjson";
import { computeEta, type EtaTracker } from "@/lib/eta";
import { computeReclaimableBytes, computeShittiness } from "@/lib/shittiness";
import type {
  EmptyFolder,
  FolderAggregate,
  ScannedFile,
  ScanProgress,
  ScanResults,
} from "@/lib/types";
import type { DeleteOutcome } from "@/lib/deletion";
import type { SelectionMap } from "@/lib/selection";
import type { TranslationKey } from "@/lib/i18n";
import FileListSection from "@/components/FileListSection";
import FolderAggregateSection from "@/components/FolderAggregateSection";
import DuplicateSection from "@/components/DuplicateSection";
import EmptyFolderSection from "@/components/EmptyFolderSection";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import FolderBrowser from "@/components/FolderBrowser";
import ShittinessScale from "@/components/ShittinessScale";
import ProgressBar from "@/components/ProgressBar";
import FolderSizeBars from "@/components/FolderSizeBars";
import FolderSunburst from "@/components/FolderSunburst";
import SoftwarePanel from "@/components/SoftwarePanel";
import MemorialPanel from "@/components/MemorialPanel";
import FeedbackButton from "@/components/FeedbackButton";
import UpdateButton from "@/components/UpdateButton";

type TabId =
  | "old"
  | "duplicates"
  | "big"
  | "games"
  | "cache"
  | "installers"
  | "newInstallers"
  | "documents"
  | "empty"
  | "devjunk";

type ScanEvent =
  | { type: "progress"; progress: ScanProgress }
  | { type: "done"; results: ScanResults }
  | { type: "error"; error: string };

type DeleteEvent =
  | { type: "progress"; done: number; total: number }
  | { type: "done"; outcome: DeleteOutcome };

const PHASE_LABEL_KEYS: Record<ScanProgress["phase"], TranslationKey> = {
  counting: "counting",
  walking: "walking",
  hashing: "hashing",
  done: "hashing",
};

const TAB_LABEL_KEYS: Record<TabId, TranslationKey> = {
  old: "tabOld",
  duplicates: "tabDuplicates",
  big: "tabBig",
  games: "tabGames",
  cache: "tabCache",
  installers: "tabInstallers",
  newInstallers: "tabNewInstallers",
  documents: "tabDocuments",
  empty: "tabEmpty",
  devjunk: "tabDevJunk",
};

const TIER_LABEL_KEYS: Record<0 | 1 | 2 | 3 | 4, TranslationKey> = {
  0: "shittyTier0Label",
  1: "shittyTier1Label",
  2: "shittyTier2Label",
  3: "shittyTier3Label",
  4: "shittyTier4Label",
};

export default function Home() {
  const { lang, setLang, t, dir } = useLanguage();
  const [mode, setMode] = useState<"files" | "software" | "memorial">("software");
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<
    (ScanProgress & { etaSeconds?: number }) | null
  >(null);
  const [results, setResults] = useState<ScanResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("duplicates");
  const [selected, setSelected] = useState<SelectionMap>(new Map());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<
    { done: number; total: number; etaSeconds?: number } | null
  >(null);
  const [lastDeleteSummary, setLastDeleteSummary] = useState<{
    deletedCount: number;
    deletedBytes: number;
    failedCount: number;
    categoryLabelKey: TranslationKey;
    categoryRemainingCount: number;
    categoryRemainingBytes: number;
    folderRemainingBytes: number;
    folderRemainingFiles: number;
    folderRemainingReclaimableBytes: number;
    shittinessBefore: number;
    shittinessAfter: number;
    shittinessTierBefore: 0 | 1 | 2 | 3 | 4;
    shittinessTierAfter: 0 | 1 | 2 | 3 | 4;
    hadFailures: boolean;
  } | null>(null);
  const scanEtaRef = useRef<EtaTracker | null>(null);
  const deleteEtaRef = useRef<EtaTracker | null>(null);

  // Browsing to a different folder makes the currently-shown results stale
  // (they're for whatever was last scanned, not wherever you're looking
  // now) - clear them out so it's obvious a new pick is needed.
  function handleNavigate() {
    setResults(null);
    setSelected(new Map());
    setError(null);
    setLastDeleteSummary(null);
  }

  async function handleScan(absPath: string) {
    setError(null);
    setLastDeleteSummary(null);
    setResults(null);
    setSelected(new Map());
    setScanning(true);
    setScanProgress(null);
    scanEtaRef.current = null;
    try {
      await streamNdjson<ScanEvent>("/api/scan", { path: absPath }, (event) => {
        if (event.type === "progress") {
          const p = event.progress;
          const etaSeconds = computeEta(scanEtaRef, p.phase, p.filesScanned, p.total);
          setScanProgress({ ...p, etaSeconds });
        } else if (event.type === "done") {
          setResults(event.results);
        } else if (event.type === "error") {
          setError(event.error);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
      setScanProgress(null);
    }
  }

  // Lets Drive Analysis's "Scan this folder" links drop the user straight
  // into a real file-cleanup scan of that folder, instead of just pointing
  // them at it and making them switch modes and browse there themselves.
  function handleScanFromSoftware(absPath: string) {
    setMode("files");
    handleScan(absPath);
  }

  // Selections are per-category — switching tabs drops whatever was picked
  // in the previous one, so a delete can only ever touch what's currently
  // on screen.
  function handleTabChange(next: TabId) {
    setTab(next);
    setSelected(new Map());
  }

  function toggleFile(id: string, f: ScannedFile) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, { absPath: f.absPath, recursive: false, size: f.size });
      return next;
    });
  }

  function toggleFolder(id: string, f: FolderAggregate | EmptyFolder) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else
        next.set(id, {
          absPath: f.absPath,
          recursive: true,
          size: "size" in f ? f.size : 0,
        });
      return next;
    });
  }

  const selectedCount = selected.size;
  const selectedBytes = useMemo(
    () => [...selected.values()].reduce((sum, s) => sum + s.size, 0),
    [selected]
  );

  // Every selectable item in a tab, as {id, absPath, recursive, size}. For
  // duplicates, the recommended "keep" copy (oldest per group) is left out -
  // selecting all shouldn't delete every copy including the original.
  function getCategoryItems(r: ScanResults, category: TabId) {
    const fileItem = (f: ScannedFile) => ({
      id: f.id,
      absPath: f.absPath,
      recursive: false,
      size: f.size,
    });
    const folderItem = (f: FolderAggregate | EmptyFolder) => ({
      id: f.id,
      absPath: f.absPath,
      recursive: true,
      size: "size" in f ? f.size : 0,
    });
    switch (category) {
      case "duplicates":
        return r.duplicates.flatMap((g) =>
          g.files.filter((f) => f.id !== g.recommendedKeepId).map(fileItem)
        );
      case "old":
        return r.oldFiles.map(fileItem);
      case "big":
        return r.bigFiles.map(fileItem);
      case "cache":
        return r.cacheTemp.map(fileItem);
      case "installers":
        return r.installers.map(fileItem);
      case "newInstallers":
        return r.newInstallers.map(fileItem);
      case "documents":
        return r.unusedDocuments.map(fileItem);
      case "games":
        return r.unplayedGames.map(folderItem);
      case "empty":
        return r.emptyFolders.map(folderItem);
      case "devjunk":
        return r.devJunk.map(folderItem);
      default:
        return [];
    }
  }

  const categoryItems = useMemo(
    () => (results ? getCategoryItems(results, tab) : []),
    [results, tab]
  );

  const allCategorySelected =
    categoryItems.length > 0 && categoryItems.every((i) => selected.has(i.id));

  function toggleSelectAllCategory() {
    setSelected((prev) => {
      const next = new Map(prev);
      if (allCategorySelected) {
        for (const i of categoryItems) next.delete(i.id);
      } else {
        for (const i of categoryItems) {
          next.set(i.id, { absPath: i.absPath, recursive: i.recursive, size: i.size });
        }
      }
      return next;
    });
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteProgress({ done: 0, total: selected.size });
    deleteEtaRef.current = null;
    const items = [...selected.entries()].map(([id, s]) => ({
      id,
      absPath: s.absPath,
      recursive: s.recursive,
    }));

    // An object wrapper, not a bare `let` — TS's control-flow narrowing
    // doesn't track mutations made inside a nested closure, and treats a
    // plain `let outcome = null; ...closure mutates it...; if (!outcome)`
    // as if outcome could only ever be null after the closure runs.
    const outcomeBox: { current: DeleteOutcome | null } = { current: null };
    await streamNdjson<DeleteEvent>("/api/delete", { items }, (event) => {
      if (event.type === "progress") {
        const etaSeconds = computeEta(deleteEtaRef, "deleting", event.done, event.total);
        setDeleteProgress({ done: event.done, total: event.total, etaSeconds });
      } else if (event.type === "done") {
        outcomeBox.current = event.outcome;
      }
    });

    const outcome = outcomeBox.current;
    if (!outcome) {
      setDeleting(false);
      setDeleteProgress(null);
      return;
    }

    const deletedIds = new Set(outcome.succeeded.map((i) => i.id));
    const freedBytes = items
      .filter((i) => deletedIds.has(i.id))
      .reduce((sum, i) => {
        const s = selected.get(i.id);
        return sum + (s ? s.size : 0);
      }, 0);

    const shittinessBefore = results ? computeShittiness(results) : null;
    const freedFiles = results ? countDeletedFiles(results, tab, deletedIds) : deletedIds.size;
    const updatedResults = results ? removeDeleted(results, deletedIds) : null;
    setResults(updatedResults);
    setSelected((prev) => {
      const next = new Map(prev);
      for (const id of deletedIds) next.delete(id);
      return next;
    });

    if (updatedResults && shittinessBefore) {
      const remainingCategoryItems = getCategoryItems(updatedResults, tab);
      // updatedResults.totalBytes/totalFiles are left as the original scan
      // reported them - the per-subfolder breakdown used elsewhere (the
      // "what's using the space" chart) isn't recomputed post-delete either,
      // and shrinking one without the other would put them out of sync
      // (percentages over 100%). These two adjusted numbers are for the
      // summary banner only, not written back into shared state.
      const folderRemainingBytes = updatedResults.totalBytes - freedBytes;
      const folderRemainingFiles = updatedResults.totalFiles - freedFiles;
      const shittinessAfter = computeShittiness({
        ...updatedResults,
        totalBytes: folderRemainingBytes,
      });
      setLastDeleteSummary({
        deletedCount: outcome.succeeded.length,
        deletedBytes: freedBytes,
        failedCount: outcome.failed.length,
        categoryLabelKey: TAB_LABEL_KEYS[tab],
        categoryRemainingCount: remainingCategoryItems.length,
        categoryRemainingBytes: remainingCategoryItems.reduce((s, i) => s + i.size, 0),
        folderRemainingBytes,
        folderRemainingFiles,
        folderRemainingReclaimableBytes: computeReclaimableBytes(updatedResults),
        shittinessBefore: shittinessBefore.score,
        shittinessAfter: shittinessAfter.score,
        shittinessTierBefore: shittinessBefore.tier,
        shittinessTierAfter: shittinessAfter.tier,
        hadFailures: outcome.failed.length > 0,
      });
    }

    setDeleting(false);
    setDeleteProgress(null);
    setConfirming(false);
  }

  return (
    <main dir={dir} className="mx-auto w-full max-w-7xl px-4 py-10 pb-28">
      <FeedbackButton t={t} />
      <UpdateButton t={t} />
      <div className="flex items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-128.png" alt="" className="h-11 w-11 shrink-0" />
          <div>
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">Clean My Sh*t</h1>
            <p className="text-xs text-neutral-400">{t("tagline")}</p>
          </div>
        </div>
        <button
          onClick={() => setLang(lang === "en" ? "he" : "en")}
          className="shrink-0 rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-900"
        >
          🌐 {t("langToggle")}
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setMode("software")}
          className={`rounded-full px-3 py-1.5 text-sm ${mode === "software" ? "bg-teal-600 text-white" : "bg-neutral-900 text-neutral-400 hover:text-neutral-200"}`}
        >
          {t("modeSoftware")}
        </button>
        <button
          onClick={() => setMode("files")}
          className={`rounded-full px-3 py-1.5 text-sm ${mode === "files" ? "bg-teal-600 text-white" : "bg-neutral-900 text-neutral-400 hover:text-neutral-200"}`}
        >
          {t("modeFiles")}
        </button>
        <button
          onClick={() => setMode("memorial")}
          className={`rounded-full px-3 py-1.5 text-sm ${mode === "memorial" ? "bg-rose-600 text-white" : "bg-neutral-900 text-neutral-400 hover:text-neutral-200"}`}
        >
          {t("modeMemorial")}
        </button>
      </div>

      {mode === "software" && <SoftwarePanel t={t} onScanFolder={handleScanFromSoftware} />}

      {mode === "memorial" && <MemorialPanel />}

      {mode === "files" && (
      <>
      <FolderBrowser onScan={handleScan} onNavigate={handleNavigate} t={t} />

      {scanning && (
        <ProgressBar
          label={t(PHASE_LABEL_KEYS[scanProgress?.phase ?? "counting"])}
          done={scanProgress?.filesScanned ?? 0}
          total={scanProgress?.total}
          etaSeconds={scanProgress?.etaSeconds}
          detail={scanProgress?.currentPath}
          t={t}
        />
      )}

      {error && (
        <p className="mt-4 rounded-md bg-red-950/50 border border-red-900 p-3 text-sm text-red-300">
          {t("errorPrefix")} {error}
        </p>
      )}

      {lastDeleteSummary && (
        <div
          className={`mt-4 space-y-1 rounded-md border p-3 text-sm ${
            lastDeleteSummary.hadFailures
              ? "border-amber-900 bg-amber-950/40 text-amber-200"
              : "border-teal-900 bg-teal-950/50 text-teal-300"
          }`}
        >
          <p>
            {lastDeleteSummary.hadFailures ? "⚠️" : "✅"}{" "}
            {t("deleteSummaryDone", {
              count: lastDeleteSummary.deletedCount,
              size: formatBytes(lastDeleteSummary.deletedBytes),
              category: t(lastDeleteSummary.categoryLabelKey),
            })}
            {lastDeleteSummary.hadFailures &&
              " " + t("deleteSummaryFailed", { count: lastDeleteSummary.failedCount })}
          </p>
          <p className="text-xs opacity-80">
            {lastDeleteSummary.categoryRemainingCount > 0
              ? t("deleteSummaryCategoryRemaining", {
                  count: lastDeleteSummary.categoryRemainingCount,
                  size: formatBytes(lastDeleteSummary.categoryRemainingBytes),
                })
              : t("deleteSummaryCategoryClear")}
          </p>
          <p className="text-xs opacity-80">
            {t("deleteSummaryFolderTotal", {
              size: formatBytes(lastDeleteSummary.folderRemainingBytes),
              files: lastDeleteSummary.folderRemainingFiles.toLocaleString(),
            })}
          </p>
          <p className="text-xs opacity-80">
            {lastDeleteSummary.folderRemainingReclaimableBytes > 0
              ? t("deleteSummaryFolderRemaining", {
                  size: formatBytes(lastDeleteSummary.folderRemainingReclaimableBytes),
                })
              : t("deleteSummaryFolderClear")}
          </p>
          <p className="text-xs opacity-80">
            {lastDeleteSummary.shittinessAfter < lastDeleteSummary.shittinessBefore
              ? t("deleteSummaryShittinessImproved", {
                  before: lastDeleteSummary.shittinessBefore,
                  after: lastDeleteSummary.shittinessAfter,
                  beforeTier: t(TIER_LABEL_KEYS[lastDeleteSummary.shittinessTierBefore]),
                  afterTier: t(TIER_LABEL_KEYS[lastDeleteSummary.shittinessTierAfter]),
                })
              : t("deleteSummaryShittinessUnchanged", {
                  score: lastDeleteSummary.shittinessAfter,
                  tier: t(TIER_LABEL_KEYS[lastDeleteSummary.shittinessTierAfter]),
                })}
          </p>
        </div>
      )}

      {results && (
        <div className="mt-8">
          <p className="text-sm text-neutral-400">
            {t("scannedSummary", {
              root: results.rootName,
              files: results.totalFiles.toLocaleString(),
              size: formatBytes(results.totalBytes),
            })}
          </p>

          <ShittinessScale results={results} t={t} />

          <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-neutral-200">{t("folderSizesTitle")}</p>
              <p className="shrink-0 text-xs text-neutral-400">{t("folderSizesClickHint")}</p>
            </div>
            <div className="mt-3 flex flex-col items-start gap-5 sm:flex-row">
              <div className="mx-auto w-full max-w-[300px] shrink-0 sm:mx-0">
                <FolderSunburst entries={results.folderSizes} onScan={handleScan} t={t} />
              </div>
              <FolderSizeBars
                entries={results.folderSizes}
                totalBytes={results.totalBytes}
                onScan={handleScan}
                t={t}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-b border-neutral-800 pb-3">
            <TabButton id="duplicates" tab={tab} setTab={handleTabChange} icon="👯" label={t("tabDuplicates")} count={results.duplicates.length} />
            <TabButton id="old" tab={tab} setTab={handleTabChange} icon="⏳" label={t("tabOld")} count={results.oldFiles.length} />
            <TabButton id="big" tab={tab} setTab={handleTabChange} icon="🐘" label={t("tabBig")} count={results.bigFiles.length} />
            <TabButton id="games" tab={tab} setTab={handleTabChange} icon="🎮" label={t("tabGames")} count={results.unplayedGames.length} />
            <TabButton id="cache" tab={tab} setTab={handleTabChange} icon="🗑️" label={t("tabCache")} count={results.cacheTemp.length} />
            <TabButton id="installers" tab={tab} setTab={handleTabChange} icon="📦" label={t("tabInstallers")} count={results.installers.length} />
            <TabButton id="newInstallers" tab={tab} setTab={handleTabChange} icon="📥" label={t("tabNewInstallers")} count={results.newInstallers.length} />
            <TabButton id="documents" tab={tab} setTab={handleTabChange} icon="📄" label={t("tabDocuments")} count={results.unusedDocuments.length} />
            <TabButton id="empty" tab={tab} setTab={handleTabChange} icon="📭" label={t("tabEmpty")} count={results.emptyFolders.length} />
            <TabButton id="devjunk" tab={tab} setTab={handleTabChange} icon="🛠️" label={t("tabDevJunk")} count={results.devJunk.length} />
          </div>

          {categoryItems.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={toggleSelectAllCategory}
                className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-900"
              >
                {allCategorySelected ? t("deselectAllCategory") : t("selectAllCategory")}
              </button>
              {tab === "duplicates" && (
                <p className="text-xs text-neutral-500">{t("selectAllDuplicatesNote")}</p>
              )}
            </div>
          )}

          <div className="mt-4">
            {tab === "duplicates" && (
              <DuplicateSection groups={results.duplicates} selected={selected} onToggle={toggleFile} t={t} />
            )}
            {tab === "old" && (
              <FileListSection files={results.oldFiles} selected={selected} onToggle={toggleFile} emptyMessage={t("emptyOld")} dateLabel={t("dateLastTouched")} t={t} />
            )}
            {tab === "big" && (
              <FileListSection files={results.bigFiles} selected={selected} onToggle={toggleFile} emptyMessage={t("emptyBig")} dateLabel={t("dateLastTouched")} t={t} />
            )}
            {tab === "games" && (
              <FolderAggregateSection folders={results.unplayedGames} selected={selected} onToggle={toggleFolder} emptyMessage={t("emptyGames")} dateLabel={t("dateLastPlayed")} />
            )}
            {tab === "cache" && (
              <FileListSection files={results.cacheTemp} selected={selected} onToggle={toggleFile} emptyMessage={t("emptyCache")} dateLabel={t("dateLastTouched")} t={t} />
            )}
            {tab === "installers" && (
              <FileListSection files={results.installers} selected={selected} onToggle={toggleFile} emptyMessage={t("emptyInstallers")} dateLabel={t("dateDownloaded")} t={t} />
            )}
            {tab === "newInstallers" && (
              <FileListSection files={results.newInstallers} selected={selected} onToggle={toggleFile} emptyMessage={t("emptyNewInstallers")} dateLabel={t("dateDownloaded")} t={t} />
            )}
            {tab === "documents" && (
              <FileListSection files={results.unusedDocuments} selected={selected} onToggle={toggleFile} emptyMessage={t("emptyDocuments")} dateLabel={t("dateLastTouched")} t={t} />
            )}
            {tab === "empty" && (
              <EmptyFolderSection folders={results.emptyFolders} selected={selected} onToggle={toggleFolder} emptyMessage={t("emptyEmptyFolders")} />
            )}
            {tab === "devjunk" && (
              <FolderAggregateSection folders={results.devJunk} selected={selected} onToggle={toggleFolder} emptyMessage={t("emptyDevJunk")} dateLabel={t("dateLastBuilt")} />
            )}
          </div>
        </div>
      )}

      {selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur px-4 py-3">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <p className="text-sm">
              {t("selectionBar", {
                count: selectedCount,
                size: formatBytes(selectedBytes),
              })}
            </p>
            <button
              onClick={() => setConfirming(true)}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
            >
              {t("deleteSelected")}
            </button>
          </div>
        </div>
      )}
      </>
      )}

      {confirming && (
        <ConfirmDeleteModal
          count={selectedCount}
          totalBytes={selectedBytes}
          deleting={deleting}
          progress={deleteProgress}
          onCancel={() => setConfirming(false)}
          onConfirm={handleConfirmDelete}
          t={t}
        />
      )}
    </main>
  );
}

function TabButton({
  id,
  tab,
  setTab,
  icon,
  label,
  count,
}: {
  id: TabId;
  tab: TabId;
  setTab: (t: TabId) => void;
  icon: string;
  label: string;
  count: number;
}) {
  const active = tab === id;
  return (
    <button
      onClick={() => setTab(id)}
      className={`rounded-full px-3 py-1.5 text-sm ${
        active
          ? "bg-teal-600 text-white"
          : "bg-neutral-900 text-neutral-400 hover:text-neutral-200"
      }`}
    >
      <span aria-hidden>{icon}</span> {label} <span className="opacity-70">({count})</span>
    </button>
  );
}

// Folder-aggregate categories (games, dev junk) delete a whole tree per
// selected id, not one file each — their fileCount is what actually leaves
// disk. Empty-folder deletes remove zero files by definition. Every other
// category is one file per id.
function countDeletedFiles(r: ScanResults, category: TabId, deletedIds: Set<string>): number {
  switch (category) {
    case "games":
      return r.unplayedGames
        .filter((f) => deletedIds.has(f.id))
        .reduce((s, f) => s + f.fileCount, 0);
    case "devjunk":
      return r.devJunk
        .filter((f) => deletedIds.has(f.id))
        .reduce((s, f) => s + f.fileCount, 0);
    case "empty":
      return 0;
    default:
      return deletedIds.size;
  }
}

function removeDeleted(results: ScanResults, deletedIds: Set<string>): ScanResults {
  return {
    ...results,
    oldFiles: results.oldFiles.filter((f) => !deletedIds.has(f.id)),
    bigFiles: results.bigFiles.filter((f) => !deletedIds.has(f.id)),
    cacheTemp: results.cacheTemp.filter((f) => !deletedIds.has(f.id)),
    installers: results.installers.filter((f) => !deletedIds.has(f.id)),
    newInstallers: results.newInstallers.filter((f) => !deletedIds.has(f.id)),
    unusedDocuments: results.unusedDocuments.filter((f) => !deletedIds.has(f.id)),
    emptyFolders: results.emptyFolders.filter((f) => !deletedIds.has(f.id)),
    devJunk: results.devJunk.filter((f) => !deletedIds.has(f.id)),
    unplayedGames: results.unplayedGames.filter((f) => !deletedIds.has(f.id)),
    duplicates: results.duplicates
      .map((g) => ({
        ...g,
        files: g.files.filter((f) => !deletedIds.has(f.id)),
      }))
      .filter((g) => g.files.length > 1),
  };
}
