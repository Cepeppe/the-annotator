import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseDirTimestamp, ttlCleanup } from '../ttlCleanup';

let tempRoot: string;
const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cl-ttl-'));
});
afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

async function mkdirIn(name: string): Promise<string> {
  const p = path.join(tempRoot, name);
  await fs.mkdir(p, { recursive: true });
  await fs.writeFile(path.join(p, 'a.txt'), 'x', 'utf8');
  return p;
}

describe('parseDirTimestamp', () => {
  it('parses valid folder names and ignores the others', () => {
    const a = parseDirTimestamp('2026-04-24-153012');
    expect(a?.toISOString()).toBe('2026-04-24T15:30:12.000Z');
    const b = parseDirTimestamp('2026-04-24-153012-delete_class');
    expect(b?.toISOString()).toBe('2026-04-24T15:30:12.000Z');
    expect(parseDirTimestamp('not-a-timestamp')).toBeNull();
    expect(parseDirTimestamp('20260424-153012')).toBeNull();
  });
});

describe('ttlCleanup', () => {
  it('removes subfolders older than the TTL and keeps recent ones (mtime fallback)', async () => {
    const oldDir = await mkdirIn('foo-old');
    const newDir = await mkdirIn('foo-new');
    // Set the mtime of oldDir to 40 days ago.
    const old = new Date(Date.now() - 40 * DAY);
    await fs.utimes(oldDir, old, old);
    const recent = new Date(Date.now() - 1 * DAY);
    await fs.utimes(newDir, recent, recent);

    const res = await ttlCleanup({
      rootPath: tempRoot,
      ttlMs: 30 * DAY
    });
    expect(res.removed).toBe(1);
    expect(res.freedBytes).toBeGreaterThan(0);
    // foo-old is gone, foo-new is still there.
    const remaining = await fs.readdir(tempRoot);
    expect(remaining).toContain('foo-new');
    expect(remaining).not.toContain('foo-old');
  });

  it('derives the age from parseTimestamp, ignoring mtime when it is available', async () => {
    // The folder name says 40 days ago, but its mtime was just set to now.
    const dir = await mkdirIn('2024-01-01-000000-old_op');
    const veryRecent = new Date();
    await fs.utimes(dir, veryRecent, veryRecent);

    const res = await ttlCleanup({
      rootPath: tempRoot,
      ttlMs: 30 * DAY,
      parseTimestamp: parseDirTimestamp
    });
    // The parser says "very old", so it is cleaned up despite the fresh mtime.
    expect(res.removed).toBe(1);
  });

  it('a missing rootPath in silent mode yields no error and an empty result', async () => {
    const res = await ttlCleanup({
      rootPath: path.join(tempRoot, 'does-not-exist'),
      ttlMs: 30 * DAY,
      silent: true
    });
    expect(res.removed).toBe(0);
    expect(res.freedBytes).toBe(0);
    expect(res.errors).toBe(0);
  });
});
