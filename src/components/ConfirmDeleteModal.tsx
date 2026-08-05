"use client";

import { useState } from "react";
import { formatBytes } from "@/lib/format";
import type { TranslationKey } from "@/lib/i18n";
import ProgressBar from "./ProgressBar";

export default function ConfirmDeleteModal({
  count,
  totalBytes,
  onCancel,
  onConfirm,
  deleting,
  progress,
  t,
}: {
  count: number;
  totalBytes: number;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
  progress?: { done: number; total: number; etaSeconds?: number } | null;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  const [understood, setUnderstood] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl bg-neutral-900 border border-neutral-700 p-5">
        <h2 className="text-lg font-semibold text-red-400">
          {t("confirmTitle", { count })}
        </h2>
        <p className="mt-2 text-sm text-neutral-300">
          {t("confirmFreedLine", { size: formatBytes(totalBytes) })}
        </p>

        {deleting && progress ? (
          <ProgressBar
            label={t("deletingProgress")}
            done={progress.done}
            total={progress.total}
            etaSeconds={progress.etaSeconds}
            t={t}
          />
        ) : (
          <>
            <p className="mt-3 rounded-md bg-red-950/50 border border-red-900 p-3 text-sm text-red-300">
              {t("confirmWarning")}
            </p>
            <label className="mt-3 flex items-start gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-red-500"
              />
              {t("confirmCheckbox")}
            </label>
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="rounded-md px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            {t("confirmCancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={!understood || deleting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting ? t("confirmDeletingBtn") : t("confirmDeleteBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
