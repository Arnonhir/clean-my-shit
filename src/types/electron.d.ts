export type UpdateEvent =
  | { type: "checking" }
  | { type: "available"; version: string }
  | { type: "not-available" }
  | { type: "downloading"; percent: number }
  | { type: "downloaded"; version: string }
  | { type: "error"; message: string };

interface UpdateActionResult {
  ok: boolean;
  reason?: string;
}

interface CleanMyShitBridge {
  isElectron: true;
  captureScreenshot: () => Promise<string | null>;
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<UpdateActionResult>;
  downloadUpdate: () => Promise<UpdateActionResult>;
  quitAndInstall: () => Promise<void>;
  onUpdateEvent: (callback: (event: UpdateEvent) => void) => () => void;
}

declare global {
  interface Window {
    cleanMyShit?: CleanMyShitBridge;
  }
}

export {};
