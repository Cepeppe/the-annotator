import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { softDeleteImage, softDeleteImages, TRASH_DIRNAME } from '../softDelete';

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cl-trash-'));
  await fs.mkdir(path.join(tempRoot, 'images'));
  await fs.mkdir(path.join(tempRoot, 'labels'));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

async function writeImage(name: string, content = 'fake-jpeg-bytes'): Promise<void> {
  await fs.writeFile(path.join(tempRoot, 'images', name), content, 'utf8');
}
async function writeLabel(name: string, content: string): Promise<void> {
  await fs.writeFile(path.join(tempRoot, 'labels', name), content, 'utf8');
}
async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

describe('softDeleteImage (singolo)', () => {
  it('moves image and label to the trash, counting the boxes in the .txt', async () => {
    await writeImage('img_001.jpg');
    await writeLabel('img_001.txt', '0 0.5 0.5 0.2 0.2\n1 0.4 0.4 0.1 0.1\n');

    const r = await softDeleteImage(tempRoot, 'img_001.jpg');
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.hadLabelFile).toBe(true);
    expect(r.annotationsCount).toBe(2);
    // I file originali non esistono più
    expect(await exists(path.join(tempRoot, 'images', 'img_001.jpg'))).toBe(false);
    expect(await exists(path.join(tempRoot, 'labels', 'img_001.txt'))).toBe(false);

    // The files sit in the trash, inside the folder reported by trashedTo.
    const trashedAbs = path.join(tempRoot, r.trashedTo);
    expect(await exists(trashedAbs)).toBe(true);
    // The .txt too.
    const trashRoot = path.dirname(path.dirname(trashedAbs));
    expect(await exists(path.join(trashRoot, 'labels', 'img_001.txt'))).toBe(true);
  });

  it('an image with no .txt moves just the image and still succeeds', async () => {
    await writeImage('img_002.png');
    const r = await softDeleteImage(tempRoot, 'img_002.png');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.hadLabelFile).toBe(false);
    expect(r.annotationsCount).toBe(0);
    expect(await exists(path.join(tempRoot, 'images', 'img_002.png'))).toBe(false);
  });

  it('rolls the image back into images/ when moving the .txt fails', async () => {
    await writeImage('img_003.jpg');
    await writeLabel('img_003.txt', '0 0.1 0.1 0.1 0.1\n');

    // Mock fs.rename so the 1st call (moving the image) succeeds, the 2nd
    // (moving the .txt) fails with EBUSY, and the 3rd (rolling the image back)
    // must be the one that moves the file back.
    const realRename = fs.rename.bind(fs);
    let call = 0;
    const spy = vi.spyOn(fs, 'rename').mockImplementation(async (a, b) => {
      call += 1;
      if (call === 2) {
        const err = new Error('EBUSY: resource busy or locked') as NodeJS.ErrnoException;
        err.code = 'EBUSY';
        throw err;
      }
      return realRename(a, b);
    });

    const r = await softDeleteImage(tempRoot, 'img_003.jpg');
    spy.mockRestore();

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('file_locked');
    expect(r.rolledBack).toBe(true);
    expect(await exists(path.join(tempRoot, 'images', 'img_003.jpg'))).toBe(true);
    // The .txt is still in labels/: it was never moved successfully.
    expect(await exists(path.join(tempRoot, 'labels', 'img_003.txt'))).toBe(true);
  });
});

describe('softDeleteImages (bulk)', () => {
  it('aggrega 3 success + 1 fallimento, raggruppa nel medesimo timestamp dir', async () => {
    await writeImage('a.jpg');
    await writeImage('b.jpg');
    await writeImage('c.jpg');
    await writeLabel('a.txt', '0 0.5 0.5 0.1 0.1\n0 0.4 0.4 0.1 0.1\n');
    await writeLabel('b.txt', '0 0.5 0.5 0.1 0.1\n');
    // 'd.jpg' does not exist, so it must come back as a failure.

    const result = await softDeleteImages(tempRoot, ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']);
    expect(result.succeeded).toHaveLength(3);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.filename).toBe('d.jpg');
    expect(result.failed[0]?.reason).toBe('image_not_found');
    expect(result.totalAnnotationsRemoved).toBe(3); // 2 from a + 1 from b + 0 from c

    // a, b and c must all land in the same timestamped folder.
    const trashRootAll = path.join(tempRoot, TRASH_DIRNAME);
    const tsDirs = await fs.readdir(trashRootAll);
    expect(tsDirs).toHaveLength(1);
  });
});
