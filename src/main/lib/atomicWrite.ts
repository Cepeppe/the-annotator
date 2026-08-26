import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Strips a leading UTF-8 BOM. Node reads it back as U+FEFF, which makes
 * `JSON.parse` throw; several editors add one when a file is edited by hand.
 */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeFileAtomic(
  targetPath: string,
  content: string | Buffer
): Promise<void> {
  await ensureDir(path.dirname(targetPath));
  const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.${nextTmpSeq()}.tmp`;
  const handle = await fs.open(tmpPath, 'w');
  try {
    try {
      await handle.writeFile(content);
      try {
        await handle.sync();
      } catch {
        // fsync is not supported on every filesystem (network shares, for one).
        // Durability here is best-effort, so a failure is not fatal.
      }
    } finally {
      await handle.close();
    }
    await fs.rename(tmpPath, targetPath);
  } catch (err) {
    // Covers a failed write (ENOSPC) as well as a failed rename (the target is
    // locked): either way the half-written temp file must not be left behind
    // in labels/, where the next scan would find it.
    try {
      await fs.unlink(tmpPath);
    } catch {
      // Cleanup of the temp file is best-effort.
    }
    throw err;
  }
}

// Two writes to the same path in the same millisecond would otherwise pick the
// same temp name and clobber each other.
let tmpSeq = 0;
function nextTmpSeq(): number {
  tmpSeq = (tmpSeq + 1) % 1_000_000;
  return tmpSeq;
}
