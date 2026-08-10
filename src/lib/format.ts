import type { Lang } from "./i18n";

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const value = bytes / Math.pow(1024, i);
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

// Locale is tied to the app's own language toggle, not the OS/browser
// default - letting it fall back to the system locale meant a Hebrew-
// configured Windows install would render a Hebrew month name (e.g.
// "15 במרץ 2026") inside an English-language row. Mixing an RTL date
// string into an LTR sentence (or vice versa) hands the browser's bidi
// algorithm two conflicting directions to reconcile, which is what
// produced the scrambled "15 3.4 · 2026 במרץ MB" the date and size
// collapsed into - not a formatting bug in the numbers themselves.
function localeFor(lang: Lang): string {
  return lang === "he" ? "he-IL" : "en-US";
}

export function formatDate(ms: number, lang: Lang = "en"): string {
  return new Date(ms).toLocaleDateString(localeFor(lang), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(ms: number, lang: Lang = "en"): string {
  return new Date(ms).toLocaleString(localeFor(lang), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function daysAgo(ms: number): number {
  return Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
}

// "45s", "3m 20s", "2h 5m" — used for scan/delete ETAs, so always rounds
// up to avoid promising less time than something will actually take.
export function formatDuration(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return `${s}s`;
  const minutes = Math.floor(s / 60);
  const remSeconds = s % 60;
  if (minutes < 60) return remSeconds > 0 ? `${minutes}m ${remSeconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}
