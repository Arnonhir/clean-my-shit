const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cleanMyShit", {
  isElectron: true,
  captureScreenshot: () => ipcRenderer.invoke("capture-screenshot"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  quitAndInstall: () => ipcRenderer.invoke("quit-and-install"),
  onUpdateEvent: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("update-event", handler);
    return () => ipcRenderer.removeListener("update-event", handler);
  },
});
