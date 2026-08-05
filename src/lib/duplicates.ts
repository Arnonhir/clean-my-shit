import { FULL_HASH_CAP_BYTES, QUICK_HASH_CHUNK_BYTES } from "./patterns";
import type { DuplicateGroup, ScannedFile, ScanProgress } from "./types";

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Fast fingerprint: first + last chunk of the file, so files that only differ
// near the end (common in videos with identical headers) don't false-match.
async function quickFingerprint(file: ScannedFile): Promise<string> {
  const blob = await file.handle.getFile();
  if (blob.size <= QUICK_HASH_CHUNK_BYTES * 2) {
    return sha256Hex(await blob.arrayBuffer());
  }
  const head = await blob.slice(0, QUICK_HASH_CHUNK_BYTES).arrayBuffer();
  const tail = await blob
    .slice(blob.size - QUICK_HASH_CHUNK_BYTES, blob.size)
    .arrayBuffer();
  const combined = new Uint8Array(head.byteLength + tail.byteLength);
  combined.set(new Uint8Array(head), 0);
  combined.set(new Uint8Array(tail), head.byteLength);
  return sha256Hex(combined.buffer);
}

async function fullHash(file: ScannedFile): Promise<string> {
  const blob = await file.handle.getFile();
  return sha256Hex(await blob.arrayBuffer());
}

export async function findDuplicates(
  files: ScannedFile[],
  onProgress: (p: Partial<ScanProgress>) => void
): Promise<DuplicateGroup[]> {
  // Only files that share an exact size can possibly be duplicates.
  const bySize = new Map<number, ScannedFile[]>();
  for (const f of files) {
    if (f.size === 0) continue; // empty files aren't interesting duplicates
    const bucket = bySize.get(f.size);
    if (bucket) bucket.push(f);
    else bySize.set(f.size, [f]);
  }

  const candidates = [...bySize.values()].filter((group) => group.length > 1);
  const groups: DuplicateGroup[] = [];
  let processed = 0;
  const total = candidates.reduce((n, g) => n + g.length, 0);

  for (const group of candidates) {
    const byFingerprint = new Map<string, ScannedFile[]>();
    for (const f of group) {
      const fp = await quickFingerprint(f);
      const bucket = byFingerprint.get(fp);
      if (bucket) bucket.push(f);
      else byFingerprint.set(fp, [f]);

      processed++;
      if (processed % 10 === 0) {
        onProgress({ phase: "hashing", filesScanned: processed });
      }
    }

    for (const fpGroup of byFingerprint.values()) {
      if (fpGroup.length < 2) continue;

      const size = fpGroup[0].size;
      if (size <= FULL_HASH_CAP_BYTES) {
        // Verify with a full content hash — cheap enough at this size, and
        // deletion is irreversible so it's worth being certain.
        const byFullHash = new Map<string, ScannedFile[]>();
        for (const f of fpGroup) {
          const h = await fullHash(f);
          const bucket = byFullHash.get(h);
          if (bucket) bucket.push(f);
          else byFullHash.set(h, [f]);
        }
        for (const confirmed of byFullHash.values()) {
          if (confirmed.length > 1) {
            groups.push({
              id: confirmed.map((f) => f.id).join("|"),
              size,
              verified: true,
              files: confirmed.sort((a, b) => a.lastModified - b.lastModified),
            });
          }
        }
      } else {
        // Too large to fully re-read comfortably — same size + matching
        // head/tail is very likely a duplicate, but flag as unverified.
        groups.push({
          id: fpGroup.map((f) => f.id).join("|"),
          size,
          verified: false,
          files: fpGroup.sort((a, b) => a.lastModified - b.lastModified),
        });
      }
    }
  }

  return groups.sort((a, b) => b.size * b.files.length - a.size * a.files.length);
}
