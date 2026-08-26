import { promises as fs } from 'node:fs';
import path from 'node:path';
import { nativeImage } from 'electron';
import { mt } from './appLocale';

const CACHE_DIRNAME = '.annotation-progress-cache';
const THUMBS_SUBDIR = 'thumbnails';
const THUMB_SIZE = 256;
const THUMB_QUALITY = 80;

function thumbPath(datasetRoot: string, imageFilename: string): string {
  const safeName = imageFilename.replace(/[\\/]/g, '_');
  return path.join(datasetRoot, CACHE_DIRNAME, THUMBS_SUBDIR, `${safeName}.jpg`);
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readAsDataUrl(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

export async function getOrCreateThumbnail(
  datasetRoot: string,
  imageFilename: string
): Promise<{ ok: true; dataUrl: string } | { ok: false; reason: string }> {
  const cached = thumbPath(datasetRoot, imageFilename);
  try {
    await fs.access(cached);
    const dataUrl = await readAsDataUrl(cached);
    return { ok: true, dataUrl };
  } catch {
    // Not cached yet: generate it below.
  }

  const sourcePath = path.join(datasetRoot, 'images', imageFilename);
  try {
    const image = nativeImage.createFromPath(sourcePath);
    if (image.isEmpty()) {
      return { ok: false, reason: mt('fs.error.imageUnreadable') };
    }
    const resized = image.resize({ width: THUMB_SIZE });
    const jpegBuf = resized.toJPEG(THUMB_QUALITY);
    await ensureDir(path.dirname(cached));
    await fs.writeFile(cached, jpegBuf);
    return { ok: true, dataUrl: `data:image/jpeg;base64,${jpegBuf.toString('base64')}` };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

export async function getImageAsDataUrl(
  datasetRoot: string,
  imageFilename: string
): Promise<
  | { ok: true; dataUrl: string; width: number; height: number }
  | { ok: false; reason: string }
> {
  const sourcePath = path.join(datasetRoot, 'images', imageFilename);
  try {
    const image = nativeImage.createFromPath(sourcePath);
    if (image.isEmpty()) {
      return { ok: false, reason: mt('fs.error.imageUnreadable') };
    }
    const size = image.getSize();
    const ext = path.extname(imageFilename).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    const buf = await fs.readFile(sourcePath);
    return {
      ok: true,
      dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
      width: size.width,
      height: size.height
    };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}
