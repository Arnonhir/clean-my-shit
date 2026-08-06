"use client";

import { useState } from "react";
import { formatBytes } from "@/lib/format";
import type { TranslationKey } from "@/lib/i18n";
import type { FolderSizeEntry } from "@/lib/types";

// Dark-mode categorical palette (this app is always dark) - fixed order,
// never cycled/reassigned by rank. Capped to 7 real slots; "Other"/loose
// buckets get a neutral gray instead of an 8th hue, since they aren't a
// real identity to color-code.
const CATEGORICAL_COLORS = [
  "#3987e5", // blue
  "#d95926", // orange
  "#199e70", // aqua
  "#c98500", // yellow
  "#d55181", // magenta
  "#008300", // green
  "#9085e9", // violet
];
const NEUTRAL_COLOR = "#6b7280";

function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function arcPath(cx: number, cy: number, innerR: number, outerR: number, start: number, end: number) {
  const startOuter = polarToCartesian(cx, cy, outerR, start);
  const endOuter = polarToCartesian(cx, cy, outerR, end);
  const startInner = polarToCartesian(cx, cy, innerR, end);
  const endInner = polarToCartesian(cx, cy, innerR, start);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    "Z",
  ].join(" ");
}

interface Slice {
  entry: FolderSizeEntry;
  rawStart: number;
  rawEnd: number;
}

// Lays entries out around [startAngle, startAngle + sweep), each getting an
// angular span proportional to its own size relative to the group's total -
// not the whole chart's total, so a ring-2 group exactly fills its parent's
// wedge regardless of how big that parent is.
function computeSlices(entries: FolderSizeEntry[], startAngle: number, sweep: number): Slice[] {
  const total = entries.reduce((s, e) => s + e.size, 0);
  let angle = startAngle;
  return entries.map((entry) => {
    const span = total > 0 ? (entry.size / total) * sweep : 0;
    const slice = { entry, rawStart: angle, rawEnd: angle + span };
    angle += span;
    return slice;
  });
}

const GAP_RAD = 0.007; // ~0.4deg - a visual gap between wedges, not a border

function withGap(slice: Slice) {
  const span = slice.rawEnd - slice.rawStart;
  const gap = Math.min(GAP_RAD, span * 0.25);
  return { start: slice.rawStart + gap / 2, end: slice.rawEnd - gap / 2 };
}

const MIN_LABEL_SPAN = 0.24; // ~14deg - below this, the wedge is too thin for text to fit

function labelFor(entry: FolderSizeEntry, t: (key: TranslationKey, vars?: Record<string, string | number>) => string) {
  if (entry.isLoose) return t("folderSizesLooseLabel");
  if (entry.isOther) return t("folderSizesOtherLabel");
  return entry.name;
}

export default function FolderSunburst({
  entries,
  onScan,
  t,
}: {
  entries: FolderSizeEntry[];
  onScan: (absPath: string) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  const [hovered, setHovered] = useState<FolderSizeEntry | null>(null);

  if (entries.length === 0) return null;

  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  const r0 = 34; // hollow center hole
  const r1 = 96; // ring 1 (top-level folders) outer edge
  const r2 = 146; // ring 2 (their subfolders) outer edge
  const START_ANGLE = -Math.PI / 2; // 12 o'clock
  const SWEEP = Math.PI * 2;

  const ring1 = computeSlices(entries, START_ANGLE, SWEEP);

  const ring2: { slice: Slice; color: string; parentColor: string }[] = [];
  ring1.forEach((parentSlice, i) => {
    const children = parentSlice.entry.children ?? [];
    if (children.length === 0) return;
    const parentColor =
      parentSlice.entry.isOther || parentSlice.entry.isLoose
        ? NEUTRAL_COLOR
        : CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length];
    const childSlices = computeSlices(children, parentSlice.rawStart, parentSlice.rawEnd - parentSlice.rawStart);
    childSlices.forEach((cs) => {
      const color =
        cs.entry.isOther || cs.entry.isLoose ? lighten(NEUTRAL_COLOR, 0.3) : lighten(parentColor, 0.35);
      ring2.push({ slice: cs, color, parentColor });
    });
  });

  const displayed = hovered;
  const totalForPct = entries.reduce((s, e) => s + e.size, 0);

  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[300px]">
        {ring1.map((slice, i) => {
          const { start, end } = withGap(slice);
          const color =
            slice.entry.isOther || slice.entry.isLoose
              ? NEUTRAL_COLOR
              : CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length];
          const clickable = !!slice.entry.absPath;
          const midAngle = (start + end) / 2;
          const span = end - start;
          const label = labelFor(slice.entry, t);

          return (
            <g
              key={slice.entry.isLoose ? "\0loose" : slice.entry.isOther ? "\0other" : slice.entry.absPath}
              onMouseEnter={() => setHovered(slice.entry)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => clickable && onScan(slice.entry.absPath)}
              className={clickable ? "cursor-pointer" : ""}
            >
              <path d={arcPath(cx, cy, r0, r1, start, end)} fill={color} />
              {span > MIN_LABEL_SPAN && (
                <text
                  x={polarToCartesian(cx, cy, (r0 + r1) / 2, midAngle).x}
                  y={polarToCartesian(cx, cy, (r0 + r1) / 2, midAngle).y}
                  fill="#ffffff"
                  fontSize={11}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none"
                >
                  {label.length > 14 ? label.slice(0, 13) + "…" : label}
                </text>
              )}
            </g>
          );
        })}

        {ring2.map(({ slice, color }) => {
          const { start, end } = withGap(slice);
          const clickable = !!slice.entry.absPath;
          const span = end - start;
          return (
            <g
              key={
                (slice.entry.isLoose ? "\0loose" : slice.entry.isOther ? "\0other" : slice.entry.absPath) +
                start
              }
              onMouseEnter={() => setHovered(slice.entry)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => clickable && onScan(slice.entry.absPath)}
              className={clickable ? "cursor-pointer" : ""}
            >
              <path d={arcPath(cx, cy, r1 + 2, r2, start, end)} fill={color} />
              {span > MIN_LABEL_SPAN * 1.4 && (
                <text
                  x={polarToCartesian(cx, cy, (r1 + 2 + r2) / 2, (start + end) / 2).x}
                  y={polarToCartesian(cx, cy, (r1 + 2 + r2) / 2, (start + end) / 2).y}
                  fill="#ffffff"
                  fontSize={9}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none"
                >
                  {labelFor(slice.entry, t).slice(0, 10)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Center readout: whatever's currently hovered, or a neutral prompt */}
      <div
        className="pointer-events-none absolute flex flex-col items-center justify-center text-center"
        style={{ width: r0 * 2 - 8, height: r0 * 2 - 8, top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
      >
        {displayed ? (
          <>
            <p className="text-[10px] font-medium leading-tight text-neutral-100">
              {labelFor(displayed, t).slice(0, 16)}
            </p>
            <p className="text-[9px] text-neutral-400">{formatBytes(displayed.size)}</p>
            <p className="text-[9px] text-neutral-500">
              {t("folderSizesPctOfTotal", {
                pct: totalForPct > 0 ? Math.round((displayed.size / totalForPct) * 100) : 0,
              })}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
