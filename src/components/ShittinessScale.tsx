"use client";

import type { TranslationKey } from "@/lib/i18n";
import type { ScanResults } from "@/lib/types";
import { computeShittiness } from "@/lib/shittiness";

const TIER_META = [
  { emoji: "🧼", labelKey: "shittyTier0Label", descKey: "shittyTier0Desc", color: "#34d399" },
  { emoji: "🙂", labelKey: "shittyTier1Label", descKey: "shittyTier1Desc", color: "#a3e635" },
  { emoji: "💩", labelKey: "shittyTier2Label", descKey: "shittyTier2Desc", color: "#facc15" },
  { emoji: "💩", labelKey: "shittyTier3Label", descKey: "shittyTier3Desc", color: "#fb923c" },
  { emoji: "💩", labelKey: "shittyTier4Label", descKey: "shittyTier4Desc", color: "#f87171" },
] satisfies { emoji: string; labelKey: TranslationKey; descKey: TranslationKey; color: string }[];

export default function ShittinessScale({
  results,
  t,
}: {
  results: ScanResults;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  const { score, tier } = computeShittiness(results);
  const meta = TIER_META[tier];
  // 28px when squeaky clean, up to ~130px for a certified disaster.
  const emojiSize = 28 + Math.round((score / 100) * 102);

  return (
    <div className="mt-4 flex items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-neutral-200">{t("shittyScaleTitle")}</p>
          <p className="shrink-0 text-sm font-medium text-neutral-300">{score}/100</p>
        </div>
        <div
          className="relative mt-2 h-2.5 rounded-full"
          style={{
            background: "linear-gradient(to right, #34d399, #a3e635, #facc15, #fb923c, #f87171)",
          }}
        >
          <div
            className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `${score}%`, background: meta.color }}
          />
        </div>
        <p className="mt-2 text-sm font-semibold" style={{ color: meta.color }}>
          {t(meta.labelKey)}
        </p>
        <p className="text-xs text-neutral-300">{t(meta.descKey)}</p>
      </div>
      <div className="flex w-24 shrink-0 items-center justify-center overflow-hidden">
        <span style={{ fontSize: emojiSize, lineHeight: 1 }} aria-hidden>
          {meta.emoji}
        </span>
      </div>
    </div>
  );
}
