"use client";

import { useEffect, useState } from "react";
import type { TranslationKey } from "@/lib/i18n";

interface BrowseFolder {
  name: string;
  absPath: string;
}

interface QuickLink {
  label: string;
  absPath: string;
}

interface BrowseResponse {
  path: string;
  parent: string | null;
  folders: BrowseFolder[];
  quickLinks: QuickLink[];
  error?: string;
}

export default function FolderBrowser({
  onScan,
  t,
}: {
  onScan: (absPath: string) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [pathInput, setPathInput] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(targetPath?: string) {
    setLoading(true);
    const url = targetPath ? `/api/browse?path=${encodeURIComponent(targetPath)}` : "/api/browse";
    const res = await fetch(url);
    const json: BrowseResponse = await res.json();
    setData(json);
    setPathInput(json.path);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mt-4 rounded-lg border border-neutral-800 p-4">
      <div className="flex flex-wrap gap-2">
        {data?.quickLinks.map((q) => (
          <button
            key={q.absPath}
            onClick={() => load(q.absPath)}
            className="rounded-full bg-neutral-900 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
          >
            {q.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(pathInput);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm"
          spellCheck={false}
        />
        <button
          type="submit"
          className="shrink-0 rounded-md bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
        >
          {t("browseGo")}
        </button>
      </form>

      {loading && <p className="mt-3 text-sm text-neutral-500">{t("browseLoading")}</p>}

      {!loading && data?.error && (
        <p className="mt-3 rounded-md bg-red-950/50 border border-red-900 p-2 text-sm text-red-300">
          {data.error}
        </p>
      )}

      {!loading && data && !data.error && (
        <>
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => onScan(data.path)}
              className="rounded-md bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-500"
            >
              {t("browseScanThis")}
            </button>
          </div>

          <ul className="mt-3 max-h-72 overflow-y-auto divide-y divide-neutral-800">
            {data.parent && (
              <li>
                <button
                  onClick={() => load(data.parent!)}
                  className="w-full py-1.5 text-left text-sm text-neutral-400 hover:text-neutral-200"
                >
                  .. ({t("browseUp")})
                </button>
              </li>
            )}
            {data.folders.map((f) => (
              <li key={f.absPath}>
                <button
                  onClick={() => load(f.absPath)}
                  className="w-full py-1.5 text-left text-sm hover:text-teal-400"
                >
                  📁 {f.name}
                </button>
              </li>
            ))}
            {data.folders.length === 0 && !data.parent && (
              <li className="py-1.5 text-sm text-neutral-500">{t("browseEmpty")}</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
