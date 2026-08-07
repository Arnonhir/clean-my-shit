const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { autoUpdater } = require("electron-updater");

const PORT = 17321; // an unusual port, to avoid colliding with a dev server on 3000
let serverProcess = null;
let mainWindow = null;

function serverEntryPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "standalone", "server.js")
    : path.join(__dirname, "..", ".next", "standalone", "server.js");
}

function logPath() {
  return path.join(app.getPath("userData"), "server.log");
}

// The Resend API key and feedback destination email are secrets, so they
// never live in a committed file. They're read from .env.local in dev, and
// from a copy after-pack.cjs places next to the standalone server once
// packaged. Missing file just means feedback-sending stays disabled.
function feedbackEnvPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "feedback.env")
    : path.join(__dirname, "..", ".env.local");
}

function loadFeedbackEnv() {
  const env = {};
  try {
    const raw = fs.readFileSync(feedbackEnvPath(), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    // no feedback config bundled - /api/feedback will report itself disabled
  }
  return env;
}

function startServer() {
  const logStream = fs.createWriteStream(logPath(), { flags: "a" });
  logStream.write(`\n--- starting ${new Date().toISOString()} ---\n`);

  // ELECTRON_RUN_AS_NODE makes Electron's own bundled binary behave as a
  // plain Node.js runtime for this one child process - the packaged app
  // needs no separate Node.js install on the end user's machine at all,
  // for either the GUI shell or the server it's showing.
  //
  // stdio must be "pipe", not "inherit": this is a Windows GUI (non-console)
  // executable once packaged, so there's no console handle for a child
  // process to inherit - "inherit" silently produced no server process at
  // all in the packaged build, with no visible error anywhere. Piping and
  // logging to a real file makes failures diagnosable instead of silent.
  serverProcess = spawn(process.execPath, [serverEntryPath()], {
    env: {
      ...process.env,
      ...loadFeedbackEnv(),
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  serverProcess.stdout.on("data", (chunk) => logStream.write(chunk));
  serverProcess.stderr.on("data", (chunk) => logStream.write(chunk));
  serverProcess.on("error", (err) => logStream.write(`spawn error: ${err.stack}\n`));
  serverProcess.on("exit", (code, signal) => {
    logStream.write(`server exited: code=${code} signal=${signal}\n`);
  });
}

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error("Local server did not start in time"));
        else setTimeout(tryOnce, 250);
      });
    };
    tryOnce();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 720,
    minHeight: 600,
    title: "Clean My Sh*t",
    icon: path.join(__dirname, "..", "public", "app-icon-v2.ico"),
    autoHideMenuBar: true,
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  try {
    await waitForServer(`http://127.0.0.1:${PORT}`, 20000);
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
  } catch (err) {
    dialog.showErrorBox(
      "Clean My Sh*t failed to start",
      `The local server didn't respond in time.\n\nDetails: ${err.message}\n\nLog file: ${logPath()}`
    );
  }
}

ipcMain.handle("capture-screenshot", async () => {
  if (!mainWindow) return null;
  const image = await mainWindow.capturePage();
  return `data:image/png;base64,${image.toPNG().toString("base64")}`;
});

// autoUpdater only does anything meaningful in a packaged build (it checks
// GitHub Releases for a newer version than app.getVersion()) - running
// unpacked via `npm run electron` has no update feed to check against.
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function updaterLogPath() {
  return path.join(app.getPath("userData"), "updater.log");
}

function logUpdater(line) {
  try {
    fs.appendFileSync(updaterLogPath(), `${new Date().toISOString()} ${line}\n`);
  } catch {
    // best-effort logging only
  }
}

function sendUpdateEvent(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-event", payload);
  }
}

autoUpdater.on("checking-for-update", () => {
  logUpdater("checking-for-update");
  sendUpdateEvent({ type: "checking" });
});
autoUpdater.on("update-available", (info) => {
  logUpdater(`update-available: ${info.version}`);
  sendUpdateEvent({ type: "available", version: info.version });
});
autoUpdater.on("update-not-available", () => {
  logUpdater("update-not-available");
  sendUpdateEvent({ type: "not-available" });
});
autoUpdater.on("download-progress", (progress) => {
  sendUpdateEvent({ type: "downloading", percent: Math.round(progress.percent) });
});
autoUpdater.on("update-downloaded", (info) => {
  logUpdater(`update-downloaded: ${info.version}`);
  sendUpdateEvent({ type: "downloaded", version: info.version });
});
// electron-updater's HTTP errors put the entire response (headers, cookies,
// the lot) into err.message - fine for the log file, but that's not
// something to render inside a button. Only a short, bounded summary goes
// to the UI; the full detail still lands in updater.log for real debugging.
function shortErrorMessage(err) {
  const raw = err instanceof Error ? err.message : String(err);
  const firstLine = raw.split("\n")[0];
  return firstLine.length > 120 ? `${firstLine.slice(0, 120)}…` : firstLine;
}

autoUpdater.on("error", (err) => {
  logUpdater(`error: ${err && err.stack ? err.stack : err}`);
  sendUpdateEvent({ type: "error", message: shortErrorMessage(err) });
});

ipcMain.handle("check-for-updates", async () => {
  if (!app.isPackaged) return { ok: false, reason: "not-packaged" };
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle("download-update", async () => {
  if (!app.isPackaged) return { ok: false, reason: "not-packaged" };
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle("quit-and-install", () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle("get-app-version", () => app.getVersion());

app.whenReady().then(() => {
  startServer();
  createWindow();

  // A silent background check a few seconds after launch, so someone who
  // never notices or clicks the update button still gets caught up - the
  // explicit button is for people who want to check on demand, not the
  // only way updates happen.
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => logUpdater(`startup check failed: ${err}`));
    }, 5000);
  }
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) serverProcess.kill();
});
