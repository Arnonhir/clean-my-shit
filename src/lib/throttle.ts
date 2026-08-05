// Wraps a progress callback so it fires at most once per `minIntervalMs`,
// regardless of how often it's called. Scan progress ticks are driven by
// file count (every 25/500 files), which is fine for small folders but on
// a huge drive with millions of files that's tens of thousands of stream
// writes - each one a JSON.stringify + SSE write + client-side JSON.parse.
// Time-based throttling keeps the update rate bounded no matter how large
// the folder is, instead of scaling with file count.
export function throttle<T>(fn: (arg: T) => void, minIntervalMs: number): (arg: T) => void {
  let last = 0;
  return (arg: T) => {
    const now = Date.now();
    if (now - last >= minIntervalMs) {
      last = now;
      fn(arg);
    }
  };
}
