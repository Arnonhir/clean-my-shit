import { promises as fs } from "node:fs";
import * as path from "node:path";

// Valve's KeyValue ("VDF") format: quoted key/value pairs, `{...}` for
// nesting, no arrays, no commas. Minimal recursive-descent parser - good
// enough for the two files this needs to read (appmanifest_*.acf and
// localconfig.vdf), not a general-purpose VDF library.
type VdfNode = { [key: string]: string | VdfNode };

function parseVdf(text: string): VdfNode {
  let i = 0;
  const len = text.length;

  function skipWs() {
    while (i < len && /\s/.test(text[i])) i++;
  }
  function readString(): string {
    i++; // opening quote
    let out = "";
    while (i < len && text[i] !== '"') {
      if (text[i] === "\\" && i + 1 < len) {
        out += text[i + 1];
        i += 2;
      } else {
        out += text[i++];
      }
    }
    i++; // closing quote
    return out;
  }
  function readObject(): VdfNode {
    i++; // opening brace
    const obj: VdfNode = {};
    while (i < len) {
      skipWs();
      if (i >= len) break;
      if (text[i] === "}") {
        i++;
        break;
      }
      if (text[i] !== '"') {
        i++;
        continue;
      }
      const key = readString();
      skipWs();
      if (text[i] === "{") obj[key] = readObject();
      else if (text[i] === '"') obj[key] = readString();
    }
    return obj;
  }

  const root: VdfNode = {};
  while (i < len) {
    skipWs();
    if (i >= len) break;
    if (text[i] !== '"') {
      i++;
      continue;
    }
    const key = readString();
    skipWs();
    if (text[i] === "{") root[key] = readObject();
    else if (text[i] === '"') root[key] = readString();
  }
  return root;
}

function asObject(v: string | VdfNode | undefined): VdfNode | null {
  return v && typeof v === "object" ? v : null;
}

// Every Steam library folder's steamapps directory (the parent of "common")
// holds one appmanifest_<appid>.acf per installed game, which is the only
// place that maps a folder name back to its real Steam AppID.
export async function readAppManifests(steamappsDir: string): Promise<Map<string, string>> {
  const installDirToAppId = new Map<string, string>();
  let entries;
  try {
    entries = await fs.readdir(steamappsDir, { withFileTypes: true });
  } catch {
    return installDirToAppId;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !/^appmanifest_\d+\.acf$/i.test(entry.name)) continue;
    try {
      const text = await fs.readFile(path.join(steamappsDir, entry.name), "utf8");
      const state = asObject(parseVdf(text)["AppState"]);
      const installDir = state?.["installdir"];
      const appId = state?.["appid"];
      if (typeof installDir === "string" && typeof appId === "string") {
        installDirToAppId.set(installDir.toLowerCase(), appId);
      }
    } catch {
      // unreadable/corrupt manifest - just skip it
    }
  }
  return installDirToAppId;
}

const STEAM_CLIENT_SUBPATHS = ["Program Files (x86)\\Steam", "Program Files\\Steam", "Steam"];

// LastPlayed lives with the Steam *client* install, inside each local
// account's userdata - not with individual library folders. The client is
// very often on C: even when the library being analyzed is on another
// drive, so this searches every drive on the system regardless of which
// one is currently being analyzed.
export async function readSteamLastPlayed(driveLetters: string[]): Promise<Map<string, number>> {
  const appIdToLastPlayedMs = new Map<string, number>();

  for (const drive of driveLetters) {
    for (const sub of STEAM_CLIENT_SUBPATHS) {
      const userdataDir = path.join(`${drive}\\`, sub, "userdata");
      let accountDirs;
      try {
        accountDirs = await fs.readdir(userdataDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const acct of accountDirs) {
        if (!acct.isDirectory()) continue;
        const configPath = path.join(userdataDir, acct.name, "config", "localconfig.vdf");
        let text: string;
        try {
          text = await fs.readFile(configPath, "utf8");
        } catch {
          continue;
        }
        try {
          const root = parseVdf(text);
          const store = asObject(root["UserLocalConfigStore"]) ?? asObject(root["UserRoamingConfigStore"]);
          const software = asObject(store?.["Software"]);
          const valve = asObject(software?.["Valve"]);
          const steam = asObject(valve?.["Steam"]);
          const apps = asObject(steam?.["apps"]);
          if (!apps) continue;
          for (const [appId, node] of Object.entries(apps)) {
            const nodeObj = asObject(node);
            const raw = nodeObj?.["LastPlayed"] ?? nodeObj?.["lastplayed"];
            if (typeof raw !== "string") continue;
            const seconds = Number(raw);
            if (!Number.isFinite(seconds) || seconds <= 0) continue;
            const ms = seconds * 1000;
            const existing = appIdToLastPlayedMs.get(appId);
            if (!existing || ms > existing) appIdToLastPlayedMs.set(appId, ms);
          }
        } catch {
          // malformed localconfig.vdf - skip this account
        }
      }
    }
  }

  return appIdToLastPlayedMs;
}
