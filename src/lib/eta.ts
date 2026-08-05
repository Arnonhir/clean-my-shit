export interface EtaTracker {
  phaseKey: string;
  startTime: number;
  startDone: number;
}

// Estimates seconds remaining from how fast "done" has moved since the
// current phase started (walking/hashing/deleting are wildly different
// speeds, so the clock resets whenever phaseKey changes rather than
// averaging across all of them). Returns undefined until there's enough
// data to trust - a fresh phase, or too little elapsed time - rather than
// showing a wild guess from a single data point.
export function computeEta(
  tracker: { current: EtaTracker | null },
  phaseKey: string,
  done: number,
  total: number | undefined
): number | undefined {
  const now = Date.now();
  if (!tracker.current || tracker.current.phaseKey !== phaseKey) {
    tracker.current = { phaseKey, startTime: now, startDone: done };
    return undefined;
  }

  const elapsedSeconds = (now - tracker.current.startTime) / 1000;
  const doneDelta = done - tracker.current.startDone;
  if (!total || elapsedSeconds < 1.5 || doneDelta <= 0) return undefined;

  const rate = doneDelta / elapsedSeconds;
  const remaining = total - done;
  if (remaining <= 0 || rate <= 0) return undefined;
  return remaining / rate;
}
