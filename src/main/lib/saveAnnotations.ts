import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { BBoxYolo, SaveAnnotationsResult } from '../../shared/types';
import { serializeYoloTxt } from '../../shared/yoloParser';
import { labelFilenameForImage } from './datasetScanner';
import { mt } from './appLocale';

const RETRY_BACKOFFS_MS = [100, 300, 1000];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function writeWithRetry(targetPath: string, content: string): Promise<void> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= RETRY_BACKOFFS_MS.length; attempt++) {
    try {
      await ensureDir(path.dirname(targetPath));
      await fs.writeFile(targetPath, content, { encoding: 'utf8' });
      return;
    } catch (err) {
      lastError = err as Error;
      if (attempt < RETRY_BACKOFFS_MS.length) {
        const wait = RETRY_BACKOFFS_MS[attempt] ?? 1000;
        await delay(wait);
      }
    }
  }
  throw lastError ?? new Error('Unknown write error');
}

function recoveryPathFor(imageFilename: string): string {
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
  const dir = path.join(os.tmpdir(), 'custom_labeler_recovery');
  return path.join(dir, `${ts}_${labelFilenameForImage(imageFilename)}`);
}

export async function saveAnnotations(
  datasetRoot: string,
  imageFilename: string,
  bboxes: BBoxYolo[]
): Promise<SaveAnnotationsResult> {
  const labelPath = path.join(datasetRoot, 'labels', labelFilenameForImage(imageFilename));
  const content = serializeYoloTxt(bboxes);

  try {
    await writeWithRetry(labelPath, content);
    return { ok: true, savedAt: new Date().toISOString() };
  } catch (primaryErr) {
    const recoveryPath = recoveryPathFor(imageFilename);
    try {
      await ensureDir(path.dirname(recoveryPath));
      await fs.writeFile(recoveryPath, content, { encoding: 'utf8' });
      return {
        ok: false,
        reason: 'io_error',
        details: friendlyMessage(primaryErr as Error, imageFilename),
        recoveredTo: recoveryPath
      };
    } catch {
      return {
        ok: false,
        reason: 'io_error',
        details: friendlyMessage(primaryErr as Error, imageFilename)
      };
    }
  }
}

/** Maps an errno to a message the annotator can act on. */
function friendlyMessage(err: Error, imageFilename: string): string {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === 'EACCES' || code === 'EPERM') {
    return mt('fs.save.permissionDenied', { filename: imageFilename });
  }
  if (code === 'EBUSY' || code === 'ELOCKED') {
    return mt('fs.save.fileLocked', { filename: imageFilename });
  }
  if (code === 'ENOSPC') {
    return mt('fs.save.diskFull', { filename: imageFilename });
  }
  return mt('fs.save.generic', { filename: imageFilename, message: err.message });
}
