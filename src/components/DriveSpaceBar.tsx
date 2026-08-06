"use client";

import { formatBytes } from "@/lib/format";
import type { TranslationKey } from "@/lib/i18n";
import type { DriveSpaceInfo } from "@/lib/types";

export default function DriveSpaceBar({
  drive,
  t,
}: {
  drive: DriveSpaceInfo;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  const usedPct = drive.totalBytes > 0 ? Math.min(100, (drive.usedBytes / drive.totalBytes) * 100) : 0;
  const low = usedPct > 90;

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-neutral-200">{drive.name}</span>
        <span className="text-xs text-neutral-400">
          {t("driveUsed", { used: formatBytes(drive.usedBytes) })} ·{" "}
          {t("driveFree", { free: formatBytes(drive.freeBytes) })}
        </span>
      </div>
      <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-neutral-800">
        <div
          className={`h-full rounded-full ${low ? "bg-red-500" : "bg-teal-500"}`}
          style={{ width: `${usedPct}%` }}
        />
      </div>
    </div>
  );
}
