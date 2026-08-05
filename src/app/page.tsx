"use client";

import { useMemo, useState } from "react";
import { scanFolder } from "@/lib/scan";
import { deleteAll, type Deletable } from "@/lib/deletion";
import { formatBytes } from "@/lib/format";
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
      const dirHandle = await window.showDirectoryPicker({
        mode: "readwrite",
      });
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

    setLastDeleteSummary(
      outcome.failed.length > 0
        ? `Deleted ${outcome.succeeded.length} item(s), freed ${formatBytes(
            freedBytes
          )}. ${outcome.failed.length} item(s) failed (maybe already moved or in use).`
        : `Deleted ${outcome.succeeded.length} item(s), freed ${formatBytes(
            freedBytes
          )}.`
    );

    setDeleting(false);
    setConfirming(false);
  }

  if (supported === false) {
    return (
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Clean My Sh*t</h1>
        <p className="mt-4 text-neutral-400">
          This tool needs a desktop browser that supports picking a folder
          directly (Chrome or Edge on Windows, Mac, or Linux). It doesn&apos;t
          work in this browser, or on phones/tablets — that&apos;s intentional,
          since scanning a whole folder only makes sense on a computer.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 pb-28">
      <h1 className="text-2xl font-bold">🧹 Clean My Sh*t</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Pick a folder on your computer. Everything happens right here in your
        browser — nothing is uploaded anywhere.
      </p>

      <button
        onClick={handlePickFolder}
        disabled={scanning}
        className="mt-6 rounded-lg bg-teal-600 px-5 py-2.5 font-medium text-white hover:bg-teal-500 disabled:opacity-50"
      >
        {scanning ? "Scanning…" : "Choose a folder to scan"}
      </button>

      {error && (
        <p className="mt-4 rounded-md bg-red-950/50 border border-red-900 p-3 text-sm text-red-300">
          Something went wrong: {error}
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
            {progress.phase === "walking" && "Looking through your files…"}
            {progress.phase === "hashing" && "Checking for duplicates…"}
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
            Scanned <span className="font-medium">{results.rootName}</span> —{" "}
            {results.totalFiles.toLocaleString()} files,{" "}
            {formatBytes(results.totalBytes)} total.
          </p>

          <div className="mt-4 flex flex-wrap gap-2 border-b border-neutral-800 pb-3">
            <TabButton id="duplicates" tab={tab} setTab={setTab} label="Duplicates" count={results.duplicates.length} />
            <TabButton id="old" tab={tab} setTab={setTab} label="Old & untouched" count={results.oldFiles.length} />
            <TabButton id="big" tab={tab} setTab={setTab} label="Big files" count={results.bigFiles.length} />
            <TabButton id="games" tab={tab} setTab={setTab} label="Unplayed games" count={results.unplayedGames.length} />
            <TabButton id="cache" tab={tab} setTab={setTab} label="Cache & temp" count={results.cacheTemp.length} />
            <TabButton id="installers" tab={tab} setTab={setTab} label="Old installers" count={results.installers.length} />
            <TabButton id="empty" tab={tab} setTab={setTab} label="Empty folders" count={results.emptyFolders.length} />
            <TabButton id="devjunk" tab={tab} setTab={setTab} label="Dev build junk" count={results.devJunk.length} />
          </div>

          <div className="mt-4">
            {tab === "duplicates" && (
              <DuplicateSection groups={results.duplicates} selected={selected} onToggle={toggleFile} />
            )}
            {tab === "old" && (
              <FileListSection files={results.oldFiles} selected={selected} onToggle={toggleFile} emptyMessage="Nothing untouched for a year or more." dateLabel="Last touched" />
            )}
            {tab === "big" && (
              <FileListSection files={results.bigFiles} selected={selected} onToggle={toggleFile} emptyMessage="No unusually large files (over 100 MB) found." dateLabel="Last touched" />
            )}
            {tab === "games" && (
              <FolderAggregateSection folders={results.unplayedGames} selected={selected} onToggle={toggleFolder} emptyMessage="No game install folders detected." dateLabel="Last played (approx.)" />
            )}
            {tab === "cache" && (
              <FileListSection files={results.cacheTemp} selected={selected} onToggle={toggleFile} emptyMessage="No cache or temp junk found." dateLabel="Last touched" />
            )}
            {tab === "installers" && (
              <FileListSection files={results.installers} selected={selected} onToggle={toggleFile} emptyMessage="No leftover installers found in Downloads." dateLabel="Downloaded" />
            )}
            {tab === "empty" && (
              <EmptyFolderSection folders={results.emptyFolders} selected={selected} onToggle={toggleFolder} />
            )}
            {tab === "devjunk" && (
              <FolderAggregateSection folders={results.devJunk} selected={selected} onToggle={toggleFolder} emptyMessage="No dev build folders (node_modules, dist, etc.) found." dateLabel="Last built" />
            )}
          </div>
        </div>
      )}

      {selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <p className="text-sm">
              <span className="font-semibold">{selectedCount}</span> selected ·{" "}
              <span className="font-semibold">{formatBytes(selectedBytes)}</span> to free up
            </p>
            <button
              onClick={() => setConfirming(true)}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
            >
              Delete selected
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
