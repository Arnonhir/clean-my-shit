import { execFile } from "node:child_process";
import { NextResponse } from "next/server";

// Opens Windows' own "Apps & Features" settings page. Deliberately not
// running the registry UninstallString ourselves - that string's format
// varies a lot (MSI GUIDs, InstallShield silent flags, custom uninstallers)
// and getting it wrong risks a broken half-uninstall. Handing off to
// Windows' own proper, battle-tested uninstall flow is the safe choice;
// this app's job is the analysis and recommendation, not reimplementing
// what Windows already does correctly.
export async function POST() {
  execFile("explorer.exe", ["ms-settings:appsfeatures"], () => {});
  return NextResponse.json({ ok: true });
}
