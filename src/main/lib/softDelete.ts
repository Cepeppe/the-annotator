import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  DeleteBulkResult,
  DeleteImageFailureReason,
  DeleteImageResult
} from '../../shared/types';
import { parseYoloTxt } from '../../shared/yoloParser';
import { ensureDir } from './atomicWrite';
import { labelFilenameForImage } from './datasetScanner';

export const TRASH_DIRNAME = path.join('.annotation-progress-cache', 'trash');

function timestampDirName(now: Date = new Date()): string {
  // Format: YYYY-MM-DD-HHMMSS (UTC), understood by `parseDirTimestamp`.
  const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
  const y = now.getUTCFullYear();
  const mo = pad(now.getUTCMonth() + 1);
  const d = pad(now.getUTCDate());
  const h = pad(now.getUTCHours());
  const mi = pad(now.getUTCMinutes());
  const s = pad(now.getUTCSeconds());
  return `${y}-${mo}-${d}-${h}${mi}${s}`;
}

function classifyError(err: NodeJS.ErrnoException): DeleteImageFailureReason {
  if (err.code === 'EACCES' || err.code === 'EPERM') return 'permission_denied';
  if (err.code === 'EBUSY') return 'file_locked';
  if (err.code === 'ENOENT') return 'image_not_found';
  return 'unknown';
}

async function tryUnlink(p: string): Promise<void> {
  try {
    await fs.unlink(p);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

async function moveFileSafely(src: string, dst: string): Promise<void> {
  await ensureDir(path.dirname(dst));
  try {
    await fs.rename(src, dst);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // The trash always lives inside the dataset root, so a cross-device rename
    // is not expected; handle it anyway for network shares and junctions.
    if (code === 'EXDEV') {
      // Minimal fallback: copy then delete, no elaborate rollback.
      const buf = await fs.readFile(src);
      await fs.writeFile(dst, buf);
      await tryUnlink(src);
      return;
    }
    throw err;
  }
}

async function readAnnotationsCount(labelPath: string): Promise<number> {
  try {
    const txt = await fs.readFile(labelPath, 'utf8');
    const parsed = parseYoloTxt(txt);
    return parsed.bboxes.length;
  } catch {
    return 0;
  }
}

export interface DeleteImageOptions {
  /**
   * Timestamped folder to move the files into. When omitted a fresh
   * `YYYY-MM-DD-HHMMSS` (UTC) folder is created. A bulk delete passes one
   * folder for the whole operation, so everything lands in the same batch.
   */
  trashTimestampDir?: string;
}

export async function softDeleteImage(
  datasetRoot: string,
  imageFilename: string,
  options: DeleteImageOptions = {}
): Promise<DeleteImageResult> {
  if (!imageFilename || imageFilename.includes('/') || imageFilename.includes('\\')) {
    return {
      ok: false,
      filename: imageFilename,
      reason: 'unknown',
      details: 'Invalid file name',
      rolledBack: true
    };
  }

  const labelFilename = labelFilenameForImage(imageFilename);
  const imgSrc = path.join(datasetRoot, 'images', imageFilename);
  const txtSrc = path.join(datasetRoot, 'labels', labelFilename);
  const tsDir = options.trashTimestampDir ?? timestampDirName();
  const trashRoot = path.join(datasetRoot, TRASH_DIRNAME, tsDir);
  const imgDst = path.join(trashRoot, 'images', imageFilename);
  const txtDst = path.join(trashRoot, 'labels', labelFilename);

  // Make sure the image is actually there.
  let imgStatus: 'exists' | 'missing';
  try {
    await fs.access(imgSrc);
    imgStatus = 'exists';
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      imgStatus = 'missing';
    } else {
      return {
        ok: false,
        filename: imageFilename,
        reason: classifyError(err as NodeJS.ErrnoException),
        details: (err as Error).message,
        rolledBack: true
      };
    }
  }

  if (imgStatus === 'missing') {
    return {
      ok: false,
      filename: imageFilename,
      reason: 'image_not_found',
      details: `${imageFilename} is not present in images/.`,
      rolledBack: true
    };
  }

  // Count the annotations before the move, so the number survives even if
  // reading the file after the move were to fail.
  let hadLabel = false;
  let annotationsCount = 0;
  try {
    await fs.access(txtSrc);
    hadLabel = true;
    annotationsCount = await readAnnotationsCount(txtSrc);
  } catch {
    hadLabel = false;
  }

  // Move the image.
  try {
    await moveFileSafely(imgSrc, imgDst);
  } catch (err) {
    return {
      ok: false,
      filename: imageFilename,
      reason: classifyError(err as NodeJS.ErrnoException),
      details: (err as Error).message,
      rolledBack: true
    };
  }

  // Move the .txt if there is one; on failure, roll the image back.
  if (hadLabel) {
    try {
      await moveFileSafely(txtSrc, txtDst);
    } catch (err) {
      let rollbackOk = true;
      try {
        await moveFileSafely(imgDst, imgSrc);
      } catch {
        rollbackOk = false;
      }
      return {
        ok: false,
        filename: imageFilename,
        reason: classifyError(err as NodeJS.ErrnoException),
        details: (err as Error).message,
        rolledBack: rollbackOk
      };
    }
  }

  // Path of the trashed image relative to the dataset root, with forward
  // slashes so it stays readable in the JSON progress file.
  const trashedToRel = path
    .join(TRASH_DIRNAME, tsDir, 'images', imageFilename)
    .replace(/\\/g, '/');

  return {
    ok: true,
    filename: imageFilename,
    hadLabelFile: hadLabel,
    annotationsCount,
    trashedTo: trashedToRel,
    removedFromCompleted: false // the renderer applies this to its own store
  };
}

export async function softDeleteImages(
  datasetRoot: string,
  imageFilenames: string[]
): Promise<DeleteBulkResult> {
  // One timestamped folder for the whole bulk delete keeps the batch together.
  const tsDir = timestampDirName();
  const succeeded: Array<Extract<DeleteImageResult, { ok: true }>> = [];
  const failed: Array<{
    filename: string;
    reason: DeleteImageFailureReason;
    details?: string;
  }> = [];
  let totalAnnotationsRemoved = 0;

  for (const filename of imageFilenames) {
    const res = await softDeleteImage(datasetRoot, filename, { trashTimestampDir: tsDir });
    if (res.ok) {
      succeeded.push(res);
      totalAnnotationsRemoved += res.annotationsCount;
    } else {
      failed.push({
        filename,
        reason: res.reason,
        details: res.details
      });
    }
  }

  return { succeeded, failed, totalAnnotationsRemoved };
}
