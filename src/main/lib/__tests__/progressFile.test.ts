import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  loadProgressFile,
  progressFilePath,
  validateProgressShape,
  PROGRESS_SCHEMA_VERSION
} from '../progressFile';

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cl-progress-'));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe('progressFile', () => {
  it('creates a default file when none exists', async () => {
    const result = await loadProgressFile(tempRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.createdNew).toBe(true);
    expect(result.progress.schema_version).toBe(PROGRESS_SCHEMA_VERSION);
    expect(result.progress.completed_images).toEqual({});
    expect(result.progress.custom_classes_added).toEqual([]);
    expect(result.progress.operations_log).toEqual([]);
    // The file has been written to disk.
    const onDisk = await fs.readFile(progressFilePath(tempRoot), 'utf8');
    expect(onDisk).toContain('"schema_version"');
  });

  it('renames a corrupted file and creates a new one on an invalid schema_version', async () => {
    const filePath = progressFilePath(tempRoot);
    await fs.writeFile(
      filePath,
      JSON.stringify({ schema_version: '999.0', other: true }),
      'utf8'
    );
    const result = await loadProgressFile(tempRoot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    if (!('recoveredFromBroken' in result)) {
      throw new Error('Atteso recovery dal file corrotto');
    }
    expect(result.recoveredFromBroken).toBe(true);
    const brokenExists = await fileExists(result.brokenPath);
    expect(brokenExists).toBe(true);
    expect(result.progress.schema_version).toBe(PROGRESS_SCHEMA_VERSION);
  });

  it('validateProgressShape reports missing fields', () => {
    const r1 = validateProgressShape({ schema_version: '1.0' });
    expect(r1.ok).toBe(false);
    const r2 = validateProgressShape({ schema_version: '2.0', dataset_root_name: 'x' });
    expect(r2.ok).toBe(false);
  });
});

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
