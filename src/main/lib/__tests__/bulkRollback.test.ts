import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The rollback path only runs when a write fails part-way through a batch, so
// every test here drives writeFileAtomic through a spy. The module is mocked
// with its real implementation as the default, and individual tests make one
// specific call throw.
vi.mock('../atomicWrite', async () => {
  const actual = await vi.importActual<typeof import('../atomicWrite')>('../atomicWrite');
  return {
    ...actual,
    writeFileAtomic: vi.fn(actual.writeFileAtomic)
  };
});

const { writeFileAtomic } = await import('../atomicWrite');
const {
  bulkDeleteClassAnnotations,
  bulkRemapClasses,
  bulkReorderClasses,
  createBackup,
  cleanupOldBackups
} = await import('../bulkOps');
const { parseDataYaml } = await import('../../../shared/yamlParser');

const writeSpy = vi.mocked(writeFileAtomic);

let tempRoot: string;

beforeEach(async () => {
  writeSpy.mockClear();
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cl-rollback-'));
  await fs.mkdir(path.join(tempRoot, 'images'));
  await fs.mkdir(path.join(tempRoot, 'labels'));
});

afterEach(async () => {
  writeSpy.mockReset();
  const actual = await vi.importActual<typeof import('../atomicWrite')>('../atomicWrite');
  writeSpy.mockImplementation(actual.writeFileAtomic);
  await fs.rm(tempRoot, { recursive: true, force: true });
});

async function writeYaml(classes: string[]): Promise<void> {
  const yaml = `nc: ${classes.length}\nnames:\n${classes.map((c) => `  - ${c}`).join('\n')}\n`;
  await fs.writeFile(path.join(tempRoot, 'data.yaml'), yaml, 'utf8');
}

async function writeLabel(name: string, lines: string[]): Promise<void> {
  await fs.writeFile(path.join(tempRoot, 'labels', name), lines.join('\n') + '\n', 'utf8');
}

async function readLabel(name: string): Promise<string> {
  return fs.readFile(path.join(tempRoot, 'labels', name), 'utf8');
}

async function readYamlNames(): Promise<string[]> {
  const yaml = await fs.readFile(path.join(tempRoot, 'data.yaml'), 'utf8');
  return parseDataYaml(yaml).names;
}

/** Makes the Nth (1-based) writeFileAtomic call throw, letting the rest work. */
function failOnCall(n: number, code = 'EPERM'): void {
  let seen = 0;
  const real = writeSpy.getMockImplementation();
  writeSpy.mockImplementation(async (target, content) => {
    seen += 1;
    if (seen === n) {
      const err: NodeJS.ErrnoException = new Error(`simulated ${code} on ${target}`);
      err.code = code;
      throw err;
    }
    return real?.(target, content);
  });
}

describe('bulk rollback: a failed write puts every label file back', () => {
  it('restores the files already rewritten when one write fails', async () => {
    const classes = ['a', 'b', 'c'];
    await writeYaml(classes);
    const originals: Record<string, string> = {};
    for (let i = 0; i < 6; i++) {
      const name = `img${i}.txt`;
      const lines = ['0 0.1 0.1 0.1 0.1', '1 0.2 0.2 0.1 0.1', '2 0.3 0.3 0.1 0.1'];
      await writeLabel(name, lines);
      originals[name] = await readLabel(name);
    }

    failOnCall(3);
    const res = await bulkDeleteClassAnnotations(tempRoot, classes, 1);

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.rolledBack).toBe(true);

    // Every file is byte-identical to what it was before the operation.
    for (const [name, content] of Object.entries(originals)) {
      expect(await readLabel(name)).toBe(content);
    }
    // data.yaml is never reached when the labels fail, so it still lists all 3.
    expect(await readYamlNames()).toEqual(['a', 'b', 'c']);
  });

  it('restores data.yaml too when the yaml write is the step that fails', async () => {
    const classes = ['a', 'b', 'c'];
    await writeYaml(classes);
    await writeLabel('one.txt', ['0 0.1 0.1 0.1 0.1', '1 0.2 0.2 0.1 0.1']);
    const original = await readLabel('one.txt');

    // Call 1 is the label file; call 2 is data.yaml (through saveDataYaml).
    failOnCall(2);
    const res = await bulkDeleteClassAnnotations(tempRoot, classes, 1);

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.rolledBack).toBe(true);
    expect(await readLabel('one.txt')).toBe(original);
    expect(await readYamlNames()).toEqual(['a', 'b', 'c']);
  });

  it('reports rolledBack=false when a restore cannot be performed', async () => {
    const classes = ['a', 'b'];
    await writeYaml(classes);
    await writeLabel('one.txt', ['0 0.1 0.1 0.1 0.1']);
    await writeLabel('two.txt', ['0 0.2 0.2 0.1 0.1']);

    // Fail the second apply write and then every restore attempt too.
    let seen = 0;
    const real = writeSpy.getMockImplementation();
    writeSpy.mockImplementation(async (target, content) => {
      seen += 1;
      if (seen >= 2) {
        const err: NodeJS.ErrnoException = new Error('simulated EPERM');
        err.code = 'EPERM';
        throw err;
      }
      return real?.(target, content);
    });

    const res = await bulkRemapClasses(tempRoot, classes, [{ from: 0, to: 1 }]);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.rolledBack).toBe(false);
  });
});

describe('bulk rollback: cancelling', () => {
  it('rolls the already-written files back when the user cancels mid-apply', async () => {
    const classes = ['a', 'b'];
    await writeYaml(classes);
    const originals: Record<string, string> = {};
    for (let i = 0; i < 40; i++) {
      const name = `img${i}.txt`;
      await writeLabel(name, ['0 0.1 0.1 0.1 0.1']);
      originals[name] = await readLabel(name);
    }

    let cancelled = false;
    const res = await bulkRemapClasses(tempRoot, classes, [{ from: 0, to: 1 }], {
      onPhase: (phase) => {
        if (phase === 'applying') cancelled = true;
      },
      isCancelled: () => cancelled
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.rolledBack).toBe(true);
    for (const [name, content] of Object.entries(originals)) {
      expect(await readLabel(name)).toBe(content);
    }
  });

  it('reports rolledBack=true when it is cancelled before anything is written', async () => {
    const classes = ['a', 'b'];
    await writeYaml(classes);
    await writeLabel('one.txt', ['0 0.1 0.1 0.1 0.1']);
    const original = await readLabel('one.txt');

    const res = await bulkRemapClasses(tempRoot, classes, [{ from: 0, to: 1 }], {
      isCancelled: () => true
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.rolledBack).toBe(true);
    expect(await readLabel('one.txt')).toBe(original);
  });
});

describe('createBackup', () => {
  it('reports the files it could not copy instead of silently skipping them', async () => {
    await writeYaml(['a']);
    await writeLabel('present.txt', ['0 0.1 0.1 0.1 0.1']);
    // A directory where a file is expected: readFile fails with EISDIR.
    await fs.mkdir(path.join(tempRoot, 'labels', 'weird.txt'));

    const outcome = await createBackup(tempRoot, 'test', [
      path.join('labels', 'present.txt'),
      path.join('labels', 'weird.txt'),
      path.join('labels', 'absent.txt')
    ]);

    expect(outcome.backedUp).toEqual([path.join('labels', 'present.txt')]);
    expect(outcome.unreadable).toEqual([path.join('labels', 'weird.txt')]);
    expect(outcome.yamlBackedUp).toBe(true);
  });

  it('gives two backups started in the same second separate folders', async () => {
    await writeYaml(['a']);
    await writeLabel('one.txt', ['0 0.1 0.1 0.1 0.1']);
    const rel = [path.join('labels', 'one.txt')];
    const first = await createBackup(tempRoot, 'reorder_classes', rel);
    const second = await createBackup(tempRoot, 'reorder_classes', rel);
    expect(first.backupPath).not.toBe(second.backupPath);
  });

  it('names the folder so the 30-day cleanup can read its age off the name', async () => {
    await writeYaml(['a']);
    await writeLabel('one.txt', ['0 0.1 0.1 0.1 0.1']);
    const { backupPath } = await createBackup(tempRoot, 'delete_class', [
      path.join('labels', 'one.txt')
    ]);
    const { parseDirTimestamp } = await import('../ttlCleanup');
    const parsed = parseDirTimestamp(path.basename(backupPath));
    expect(parsed).not.toBeNull();
    // Within a minute of now, so it is the operation timestamp and not a
    // fallback value.
    expect(Math.abs(Date.now() - (parsed as Date).getTime())).toBeLessThan(60_000);
  });

  it('lets an old backup folder be reclaimed by the TTL cleanup', async () => {
    const backupRoot = path.join(tempRoot, '.annotation-progress-cache', 'backup');
    await fs.mkdir(backupRoot, { recursive: true });
    // A folder named as createBackup names them, dated 40 days ago.
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const pad = (n: number): string => String(n).padStart(2, '0');
    const name =
      `${old.getUTCFullYear()}-${pad(old.getUTCMonth() + 1)}-${pad(old.getUTCDate())}-` +
      `${pad(old.getUTCHours())}${pad(old.getUTCMinutes())}${pad(old.getUTCSeconds())}` +
      `-delete_class`;
    await fs.mkdir(path.join(backupRoot, name));
    // A fresh mtime, so only the name can tell the cleanup that it is old.
    await cleanupOldBackups(tempRoot);
    await expect(fs.access(path.join(backupRoot, name))).rejects.toThrow();
  });
});

/**
 * Makes the backup copy of `labelName` fail while leaving the scan pass alone.
 * The scan reads the .txt with an explicit 'utf8' encoding, the backup reads it
 * as a Buffer with no second argument, so the two passes can be told apart.
 * Returns a restore function.
 */
function breakBackupReadOf(labelName: string): () => void {
  const realReadFile = fs.readFile.bind(fs);
  const spy = vi.spyOn(fs, 'readFile');
  spy.mockImplementation(((file: unknown, ...rest: unknown[]) => {
    const isTarget =
      typeof file === 'string' && file.endsWith(path.join('labels', labelName));
    if (isTarget && rest.length === 0) {
      const err: NodeJS.ErrnoException = new Error('simulated EACCES');
      err.code = 'EACCES';
      return Promise.reject(err);
    }
    return (realReadFile as (...a: unknown[]) => unknown)(file, ...rest);
  }) as never);
  return () => spy.mockRestore();
}

describe('an incomplete backup stops the operation before anything is written', () => {
  it('aborts, untouched, when a label file cannot be copied into the backup', async () => {
    const classes = ['a', 'b'];
    await writeYaml(classes);
    await writeLabel('one.txt', ['0 0.1 0.1 0.1 0.1']);
    await writeLabel('two.txt', ['0 0.2 0.2 0.1 0.1']);
    const originals = {
      'one.txt': await readLabel('one.txt'),
      'two.txt': await readLabel('two.txt')
    };

    const restore = breakBackupReadOf('two.txt');
    let res;
    try {
      res = await bulkRemapClasses(tempRoot, classes, [{ from: 0, to: 1 }]);
    } finally {
      restore();
    }

    expect(res.ok).toBe(false);
    if (res.ok) return;
    // Nothing was written, so "rolled back" is the honest answer.
    expect(res.rolledBack).toBe(true);
    expect(res.reason).toContain('backup');
    // The point of aborting early: no file was touched, so there is nothing
    // that a rollback would have had to put back without a copy to do it from.
    expect(writeSpy).not.toHaveBeenCalled();
    for (const [name, content] of Object.entries(originals)) {
      expect(await readLabel(name)).toBe(content);
    }
  });
});

describe('bulkReorderClasses with duplicate class names', () => {
  it('remaps by position, not by looking the name up in the new list', async () => {
    // A data.yaml written by another tool that repeats a name. Moving the
    // second "car" (id 2) to the front must shift ids 0 and 1 down by one; a
    // name-based mapping would resolve both "car" entries to the same index.
    const classes = ['person', 'car', 'car', 'truck'];
    await writeYaml(classes);
    await writeLabel('a.txt', [
      '0 0.1 0.1 0.1 0.1',
      '1 0.2 0.2 0.1 0.1',
      '2 0.3 0.3 0.1 0.1',
      '3 0.4 0.4 0.1 0.1'
    ]);

    const res = await bulkReorderClasses(tempRoot, classes, 2, 0);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // 2 -> 0, 0 -> 1, 1 -> 2, 3 unchanged.
    expect((await readLabel('a.txt')).trim().split('\n')).toEqual([
      '1 0.100000 0.100000 0.100000 0.100000',
      '2 0.200000 0.200000 0.100000 0.100000',
      '0 0.300000 0.300000 0.100000 0.100000',
      '3 0.400000 0.400000 0.100000 0.100000'
    ]);
    expect(await readYamlNames()).toEqual(['car', 'person', 'car', 'truck']);
  });
});
