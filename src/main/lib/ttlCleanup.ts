import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface TtlCleanupOptions {
  rootPath: string;
  ttlMs: number;
  /**
   * When provided, derives the timestamp from the folder name
   * (`YYYY-MM-DD-HHMMSS[-suffix]`). Returning null falls back to `mtimeMs`.
   */
  parseTimestamp?: (entryName: string) => Date | null;
  /**
   * When true the cleanup never throws: failures to read the root or to remove
   * a single entry are swallowed.
   */
  silent?: boolean;
}

export interface TtlCleanupResult {
  removed: number;
  freedBytes: number;
  errors: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_TTL_DAYS = 30;
export const DEFAULT_TTL_MS = DEFAULT_TTL_DAYS * DAY_MS;

const TIMESTAMP_DIR_RE = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})(?:-.*)?$/;

/**
 * Extracts the timestamp from a folder name shaped as
 *   YYYY-MM-DD-HHMMSS[-<suffix>]
 * for example `2026-04-24-153012` or `2026-04-24-153012-delete_class`.
 * Returns null when the name does not match.
 */
export function parseDirTimestamp(entryName: string): Date | null {
  const m = entryName.match(TIMESTAMP_DIR_RE);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  // Read as UTC, to stay consistent with the ISO strings in progress.json.
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        total += await dirSize(full);
      } else {
        const stat = await fs.stat(full);
        total += stat.size;
      }
    } catch {
      // Skip entries we cannot stat.
    }
  }
  return total;
}

/**
 * Removes every first-level subfolder of `rootPath` older than `ttlMs`. The age
 * comes from `parseTimestamp` when provided, otherwise from the filesystem
 * `mtimeMs`.
 *
 * Best-effort: failures to remove a single entry are counted, not propagated.
 * A failing `readdir` on the root returns an empty result, because the trash or
 * backup folder simply may not exist yet.
 */
export async function ttlCleanup(opts: TtlCleanupOptions): Promise<TtlCleanupResult> {
  const result: TtlCleanupResult = { removed: 0, freedBytes: 0, errors: 0 };
  const { rootPath, ttlMs, parseTimestamp } = opts;

  let entries: string[];
  try {
    entries = await fs.readdir(rootPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || opts.silent) return result;
    throw err;
  }

  const now = Date.now();
  for (const entry of entries) {
    const full = path.join(rootPath, entry);
    let ageMs: number | null = null;

    if (parseTimestamp) {
      const ts = parseTimestamp(entry);
      if (ts) ageMs = now - ts.getTime();
    }
    if (ageMs === null) {
      try {
        const stat = await fs.stat(full);
        ageMs = now - stat.mtimeMs;
      } catch {
        result.errors += 1;
        continue;
      }
    }

    if (ageMs <= ttlMs) continue;

    let freed = 0;
    try {
      const stat = await fs.stat(full);
      if (stat.isDirectory()) {
        freed = await dirSize(full);
      } else {
        freed = stat.size;
      }
    } catch {
      // Size unknown: try to remove it anyway.
    }

    try {
      await fs.rm(full, { recursive: true, force: true });
      result.removed += 1;
      result.freedBytes += freed;
    } catch {
      result.errors += 1;
    }
  }

  return result;
}
