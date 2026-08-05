"use client";

import { useMemo, useState } from "react";
import { formatBytes } from "@/lib/format";
import { useLanguage } from "@/lib/useLanguage";
import type {
  EmptyFolder,
  FolderAggregate,
  ScannedFile,
  ScanResults,
} from "@/lib/types";
import type { SelectionMap } from "@/lib/selection";
import FileListSection from "@/components/FileListSection";
import FolderAggregateSection from "@/components/FolderAggregateSection";
import DuplicateSection from "@/components/DuplicateSection";
import EmptyFolderSection from "@/components/EmptyFolderSection";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import FolderBrowser from "@/components/FolderBrowser";

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
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("duplicates");
  const [selected, setSelected] = useState<SelectionMap>(new Map());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lastDeleteSummary, setLastDeleteSummary] = useState<string | null>(
    null
  );

  async function handleScan(absPath: string) {
    setError(null);
    setLastDeleteSummary(null);
    setResults(null);
    setSelected(new Map());
    setScanning(true);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: absPath }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed");
      setResults(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
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

  async function handleConfirmDelete() {
    setDeleting(true);
    const items = [...selected.entries()].map(([id, s]) => ({
      id,
      absPath: s.absPath,
      recursive: s.recursive,
    }));

    const res = await fetch("/api/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const outcome: {
      succeeded: { id: string }[];
      failed: { item: { id: string }; error: string }[];
    } = await res.json();

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

    let summary = t("deleteSummaryDone", {
      count: outcome.succeeded.length,
      size: formatBytes(freedBytes),
    });
    if (outcome.failed.length > 0) {
      summary += " " + t("deleteSummaryFailed", { count: outcome.failed.length });
    }
    setLastDeleteSummary(summary);

    setDeleting(false);
    setConfirming(false);
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

      <FolderBrowser onScan={handleScan} t={t} />

      {scanning && (
        <p className="mt-4 text-sm text-neutral-400">{t("scanning")}</p>
      )}

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
