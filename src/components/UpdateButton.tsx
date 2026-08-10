"use client";

import { useEffect, useState } from "react";
import type { TranslationKey } from "@/lib/i18n";
import type { UpdateEvent } from "@/types/electron";

type UpdateState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "available"; version: string }
  | { phase: "not-available" }
  | { phase: "downloading"; percent: number }
  | { phase: "downloaded"; version: string }
  | { phase: "error"; message: string };

export default function UpdateButton({
  t,
}: {
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  const [isElectron] = useState(() => typeof window !== "undefined" && !!window.cleanMyShit?.isElectron);
  const [version, setVersion] = useState<string | null>(null);
  const [state, setState] = useState<UpdateState>({ phase: "idle" });

  useEffect(() => {
    if (!isElectron || !window.cleanMyShit) return;
    window.cleanMyShit.getAppVersion().then(setVersion);

    return window.cleanMyShit.onUpdateEvent((event: UpdateEvent) => {
      if (event.type === "checking") setState({ phase: "checking" });
      else if (event.type === "available") {
        // Main process has autoDownload on, so the download already starts
        // on its own - this is purely a UI state update, not a trigger.
        setState({ phase: "available", version: event.version });
      } else if (event.type === "not-available") {
        setState({ phase: "not-available" });
        setTimeout(() => setState((s) => (s.phase === "not-available" ? { phase: "idle" } : s)), 4000);
      } else if (event.type === "downloading") {
        setState({ phase: "downloading", percent: event.percent });
      } else if (event.type === "downloaded") {
        setState({ phase: "downloaded", version: event.version });
      } else if (event.type === "error") {
        setState({ phase: "error", message: event.message });
      }
    });
  }, [isElectron]);

  if (!isElectron) return null;

  function handleClick() {
    if (state.phase === "downloaded") {
      window.cleanMyShit?.quitAndInstall();
      return;
    }
    setState({ phase: "checking" });
    window.cleanMyShit?.checkForUpdates();
  }

  const label = (() => {
    switch (state.phase) {
      case "checking":
        return t("updateChecking");
      case "available":
        return t("updateAvailable", { version: state.version });
      case "not-available":
        return t("updateNotAvailable");
      case "downloading":
        return t("updateDownloading", { percent: state.percent });
      case "downloaded":
        return t("updateRestartButton");
      case "error":
        return t("updateError", { message: state.message });
      default:
        return version ? t("updateCheckButton") + ` (v${version})` : t("updateCheckButton");
    }
  })();

  const busy = state.phase === "checking" || state.phase === "available" || state.phase === "downloading";

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      title={label}
      className="fixed bottom-20 start-6 z-50 flex max-w-xs items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 shadow-lg shadow-black/40 hover:bg-neutral-800 disabled:opacity-70"
    >
      <span className="shrink-0">{state.phase === "downloaded" ? "🚀" : "🔄"}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
