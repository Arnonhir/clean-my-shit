"use client";

// Reads a newline-delimited JSON response body (one JSON object per line),
// calling onEvent for each one as it arrives. Used for scan/delete progress
// streams, where we want to show updates as they happen rather than
// waiting for the whole operation to finish before hearing anything.
export async function streamNdjson<T = unknown>(
  url: string,
  body: unknown | undefined,
  onEvent: (event: T) => void
): Promise<void> {
  // No body -> GET (a plain read, like listing installed software).
  // A body (even `{}`) -> POST with that body as JSON (scan/delete).
  const res = await fetch(
    url,
    body === undefined
      ? { method: "GET" }
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );

  if (!res.body) {
    // Some environments don't support streaming responses - fall back to
    // reading the whole thing at once (still correct, just not incremental).
    const text = await res.text();
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed) onEvent(JSON.parse(trimmed));
    }
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
  const remainder = buffer.trim();
  if (remainder) onEvent(JSON.parse(remainder));
}
