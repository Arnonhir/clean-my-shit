"use client";

import { useMemo, useState } from "react";
import { scanFolder } from "@/lib/scan";
import { deleteAll, type Deletable } from "@/lib/deletion";
import { formatBytes } from "@/lib/format";
import { useLanguage } from "@/lib/useLanguage";
import type {
  EmptyFolder,
  FolderAggregate,
  ScannedFile,
  ScanProgress,
  ScanResults,
} from "@/lib/types";
import type { SelectionMap } from "@/lib/selection";
import FileListSection from "@/components/FileListSection";
import FolderAggregateSection from "@/components/FolderAggregateSection";
import DuplicateSection from "@/components/DuplicateSection";
import EmptyFolderSection from "@/components/EmptyFolderSection";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";

type TabId =
  | "old"
  | "duplicates"
  | "big"
  | "games"
  | "cache"
  | "installers"
  | "empty"
  | "devjunk";

export default function Home() {
  const { lang, setLang, t, dir } = useLanguage();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [results, setResults] = useState<ScanResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("duplicates");
  const [selected, setSelected] = useState<SelectionMap>(new Map());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lastDeleteSummary, setLastDeleteSummary] = useState<string | null>(
    null
  );

  useState(() => {
    if (typeof window !== "undefined") {
      setSupported("showDirectoryPicker" in window);
    }
  });

  async function handlePickFolder() {
    setError(null);
    setLastDeleteSummary(null);
    try {
      // Read-only at first — some folders (Downloads, Desktop, Documents)
      // can't be opened at all if we ask for write access up front. We ask
      // for write access later, only for the specific files being deleted.
      const dirHandle = await window.showDirectoryPicker();
      setResults(null);
      setSelected(new Map());
      setScanning(true);
      setProgress({
        filesScanned: 0,
        foldersScanned: 0,
        currentPath: "",
        phase: "walking",
      });
      const scanResults = await scanFolder(dirHandle, (p) =>
        setProgress((prev) => ({ ...(prev as ScanProgress), ...p }))
      );
      setResults(scanResults);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // user closed the picker — not an error
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setScanning(false);
    }
  }

  function toggleFile(id: string, f: ScannedFile) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else
        next.set(id, {
          name: f.name,
          parentHandle: f.parentHandle,
          recursive: false,
          size: f.size,
        });
      return next;
    });
  }

  function toggleFolder(id: string, f: FolderAggregate | EmptyFolder) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else
        next.set(id, {
          name: f.name,
          parentHandle: f.parentHandle,
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

  async function handleConfirmDelete() {
    setDeleting(true);
    const items: (Deletable & { id: string })[] = [...selected.entries()].map(
      ([id, s]) => ({
        id,
        name: s.name,
        parentHandle: s.parentHandle,
        recursive: s.recursive,
      })
    );
    const outcome = await deleteAll(items);
    const deletedIds = new Set(outcome.succeeded.map((i) => i.id));

    const freedBytes = items
      .filter((i) => deletedIds.has(i.id))
      .reduce((sum, i) => {
        const s = selected.get(i.id);
        return sum + (s ? s.size : 0);
      }, 0);

    setResults((prev) => (prev ? removeDeleted(prev, deletedIds) : prev));
    setSelected((prev) => {
      const next = new Map(prev);
      for (const id of deletedIds) next.delete(id);
      return next;
    });

    const blockedCount = outcome.failed.filter((f) => f.blocked).length;
    const otherFailedCount = outcome.failed.length - blockedCount;

    let summary = t("deleteSummaryDone", {
      count: outcome.succeeded.length,
      size: formatBytes(freedBytes),
    });
    if (blockedCount > 0) {
      summary += " " + t("deleteSummaryBlocked", { count: blockedCount });
    }
    if (otherFailedCount > 0) {
      summary += " " + t("deleteSummaryFailed", { count: otherFailedCount });
    }
    setLastDeleteSummary(summary);

    setDeleting(false);
    setConfirming(false);
  }

  if (supported === false) {
    return (
      <main dir={dir} className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">{t("unsupportedTitle")}</h1>
        <p className="mt-4 text-neutral-400">{t("unsupportedBody")}</p>
      </main>
    );
  }

  return (
    <main dir={dir} className="mx-auto max-w-3xl px-4 py-10 pb-28">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">🚽 Clean My Sh*t</h1>
        <button
          onClick={() => setLang(lang === "en" ? "he" : "en")}
          className="shrink-0 rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-900"
        >
          🌐 {t("langToggle")}
        </button>
      </div>
      <p className="mt-1 text-sm text-neutral-400">{t("tagline")}</p>

      <button
        onClick={handlePickFolder}
        disabled={scanning}
        className="mt-6 rounded-lg bg-teal-600 px-5 py-2.5 font-medium text-white hover:bg-teal-500 disabled:opacity-50"
      >
        {scanning ? t("scanning") : t("chooseFolder")}
      </button>

      {error && (
        <p className="mt-4 rounded-md bg-red-950/50 border border-red-900 p-3 text-sm text-red-300">
          {t("errorPrefix")} {error}
        </p>
      )}

      {lastDeleteSummary && (
        <p className="mt-4 rounded-md bg-teal-950/50 border border-teal-900 p-3 text-sm text-teal-300">
          ✅ {lastDeleteSummary}
        </p>
      )}

      {scanning && progress && (
        <div className="mt-6 text-sm text-neutral-400">
          <p>
            {progress.phase === "walking" && t("walking")}
            {progress.phase === "hashing" && t("hashing")}
          </p>
          <p className="truncate text-xs text-neutral-600">
            {progress.foldersScanned.toLocaleString()} folders,{" "}
            {progress.filesScanned.toLocaleString()} files scanned so far
            {progress.currentPath ? ` · ${progress.currentPath}` : ""}
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

          <div className="mt-4 flex flex-wrap gap-2 border-b border-neutral-800 pb-3">
            <TabButton id="duplicates" tab={tab} setTab={setTab} label={t("tabDuplicates")} count={results.duplicates.length} />
            <TabButton id="old" tab={tab} setTab={setTab} label={t("tabOld")} count={results.oldFiles.length} />
            <TabButton id="big" tab={tab} setTab={setTab} label={t("tabBig")} count={results.bigFiles.length} />
            <TabButton id="games" tab={tab} setTab={setTab} label={t("tabGames")} count={results.unplayedGames.length} />
            <TabButton id="cache" tab={tab} setTab={setTab} label={t("tabCache")} count={results.cacheTemp.length} />
            <TabButton id="installers" tab={tab} setTab={setTab} label={t("tabInstallers")} count={results.installers.length} />
            <TabButton id="empty" tab={tab} setTab={setTab} label={t("tabEmpty")} count={results.emptyFolders.length} />
            <TabButton id="devjunk" tab={tab} setTab={setTab} label={t("tabDevJunk")} count={results.devJunk.length} />
          </div>

          <div className="mt-4">
            {tab === "duplicates" && (
              <DuplicateSection groups={results.duplicates} selected={selected} onToggle={toggleFile} t={t} />
            )}
            {tab === "old" && (
              <FileListSection files={results.oldFiles} selected={selected} onToggle={toggleFile} emptyMessage={t("emptyOld")} dateLabel={t("dateLastTouched")} />
            )}
            {tab === "big" && (
              <FileListSection files={results.bigFiles} selected={selected} onToggle={toggleFile} emptyMessage={t("emptyBig")} dateLabel={t("dateLastTouched")} />
            )}
            {tab === "games" && (
              <FolderAggregateSection folders={results.unplayedGames} selected={selected} onToggle={toggleFolder} emptyMessage={t("emptyGames")} dateLabel={t("dateLastPlayed")} />
            )}
            {tab === "cache" && (
              <FileListSection files={results.cacheTemp} selected={selected} onToggle={toggleFile} emptyMessage={t("emptyCache")} dateLabel={t("dateLastTouched")} />
            )}
            {tab === "installers" && (
              <FileListSection files={results.installers} selected={selected} onToggle={toggleFile} emptyMessage={t("emptyInstallers")} dateLabel={t("dateDownloaded")} />
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
          <div className="mx-auto flex max-w-3xl items-center justify-between">
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

      {confirming && (
        <ConfirmDeleteModal
          count={selectedCount}
          totalBytes={selectedBytes}
          deleting={deleting}
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
  label,
  count,
}: {
  id: TabId;
  tab: TabId;
  setTab: (t: TabId) => void;
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
      {label} <span className="opacity-70">({count})</span>
    </button>
  );
}

function removeDeleted(results: ScanResults, deletedIds: Set<string>): ScanResults {
  return {
    ...results,
    oldFiles: results.oldFiles.filter((f) => !deletedIds.has(f.id)),
    bigFiles: results.bigFiles.filter((f) => !deletedIds.has(f.id)),
    cacheTemp: results.cacheTemp.filter((f) => !deletedIds.has(f.id)),
    installers: results.installers.filter((f) => !deletedIds.has(f.id)),
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
