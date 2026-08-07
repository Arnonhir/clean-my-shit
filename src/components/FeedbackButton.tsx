"use client";

import { useState } from "react";
import type { TranslationKey } from "@/lib/i18n";

type Status = "idle" | "sending" | "sent" | "error";

export default function FeedbackButton({
  t,
}: {
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setOpen(true);
    setStatus("idle");
    setError(null);
    setScreenshot(null);
    if (window.cleanMyShit?.isElectron) {
      const shot = await window.cleanMyShit.captureScreenshot();
      setScreenshot(shot);
    }
  }

  function handleClose() {
    setOpen(false);
    setMessage("");
  }

  async function handleSend() {
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, screenshot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setStatus("sent");
      setMessage("");
      setTimeout(handleClose, 1200);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="fixed bottom-6 end-6 z-50 flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 shadow-lg shadow-black/40 hover:bg-neutral-800"
      >
        💬 {t("feedbackButton")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-neutral-800 bg-neutral-950 p-5">
            <h2 className="text-base font-semibold text-neutral-100">{t("feedbackTitle")}</h2>
            <p className="mt-1 text-xs text-neutral-400">{t("feedbackTagline")}</p>

            {screenshot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={screenshot}
                alt=""
                className="mt-3 max-h-40 w-full rounded-md border border-neutral-800 object-contain"
              />
            ) : (
              <p className="mt-3 text-xs text-neutral-500">{t("feedbackScreenshotUnavailable")}</p>
            )}

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("feedbackPlaceholder")}
              rows={4}
              autoFocus
              className="mt-3 w-full resize-none rounded-md border border-neutral-700 bg-neutral-900 p-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />

            {status === "error" && error && (
              <p className="mt-2 text-xs text-red-400">{t("feedbackError", { error })}</p>
            )}
            {status === "sent" && (
              <p className="mt-2 text-xs text-teal-400">{t("feedbackSent")}</p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={handleClose}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
              >
                {t("feedbackCancel")}
              </button>
              <button
                onClick={handleSend}
                disabled={!message.trim() || status === "sending" || status === "sent"}
                className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
              >
                {status === "sending" ? t("feedbackSending") : t("feedbackSend")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
