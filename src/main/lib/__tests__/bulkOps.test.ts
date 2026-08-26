import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  bulkDeleteClassAnnotations,
  bulkMergeClasses,
  bulkRemapClasses
} from '../bulkOps';
import { parseDataYaml } from '../../../shared/yamlParser';

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cl-bulk-'));
  await fs.mkdir(path.join(tempRoot, 'images'));
  await fs.mkdir(path.join(tempRoot, 'labels'));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

async function writeYaml(classes: string[]): Promise<void> {
  const yaml = `nc: ${classes.length}\nnames:\n${classes
    .map((c) => `  - ${c}`)
    .join('\n')}\n`;
  await fs.writeFile(path.join(tempRoot, 'data.yaml'), yaml, 'utf8');
}

async function writeLabel(name: string, lines: string[]): Promise<void> {
  await fs.writeFile(path.join(tempRoot, 'labels', name), lines.join('\n') + '\n', 'utf8');
}

async function readLabel(name: string): Promise<string> {
  return fs.readFile(path.join(tempRoot, 'labels', name), 'utf8');
}

describe('bulkDeleteClassAnnotations', () => {
  it('removes every line of the target class and shifts the following ids', async () => {
    const classes = ['person', 'helmet', 'vest', 'gloves'];
    await writeYaml(classes);
    await writeLabel('a.txt', [
      '0 0.5 0.5 0.2 0.2',
      '1 0.4 0.4 0.1 0.1',
      '2 0.3 0.3 0.1 0.1'
    ]);
    await writeLabel('b.txt', [
      '1 0.2 0.2 0.1 0.1',
      '1 0.6 0.6 0.1 0.1',
      '3 0.7 0.7 0.1 0.1'
    ]);
    await writeLabel('c.txt', ['0 0.1 0.1 0.05 0.05']);

    const result = await bulkDeleteClassAnnotations(tempRoot, classes, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.removedAnnotations).toBe(3);
    expect(result.affectedFiles).toBe(2); // a e b modificati, c invariato

    const a = await readLabel('a.txt');
    expect(a.trim().split('\n')).toEqual([
      '0 0.500000 0.500000 0.200000 0.200000',
      '1 0.300000 0.300000 0.100000 0.100000' // ex-2 → 1
    ]);
    const b = await readLabel('b.txt');
    expect(b.trim().split('\n')).toEqual([
      '2 0.700000 0.700000 0.100000 0.100000' // ex-3 → 2
    ]);
    // c.txt had neither the target class nor any id to shift, so the file is
    // left byte-identical instead of being reserialized.
    const c = await readLabel('c.txt');
    expect(c.trim()).toBe('0 0.1 0.1 0.05 0.05');

    const yaml = await fs.readFile(path.join(tempRoot, 'data.yaml'), 'utf8');
    const reparsed = parseDataYaml(yaml);
    expect(reparsed.names).toEqual(['person', 'vest', 'gloves']);
  });
});

describe('bulkMergeClasses', () => {
  it('reassigns classId from -> to and compacts the following ids in names', async () => {
    const classes = ['person', 'worker', 'vest', 'gloves'];
    // Merging worker(1) into person(0) turns every box 1 into 0, and shifts
    // indexes 2 and 3 down to 1 and 2.
    await writeYaml(classes);
    await writeLabel('a.txt', [
      '0 0.1 0.1 0.1 0.1',
      '1 0.2 0.2 0.1 0.1',
      '2 0.3 0.3 0.1 0.1',
      '3 0.4 0.4 0.1 0.1'
    ]);

    const result = await bulkMergeClasses(tempRoot, classes, 1, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.remappedAnnotations).toBe(1); // only the boxes of class 1 are counted
    expect(result.affectedFiles).toBe(1);

    const a = await readLabel('a.txt');
    expect(a.trim().split('\n')).toEqual([
      '0 0.100000 0.100000 0.100000 0.100000',
      '0 0.200000 0.200000 0.100000 0.100000', // ex-1 → 0
      '1 0.300000 0.300000 0.100000 0.100000', // ex-2 → 1 (shift)
      '2 0.400000 0.400000 0.100000 0.100000' // ex-3 → 2 (shift)
    ]);

    const yaml = await fs.readFile(path.join(tempRoot, 'data.yaml'), 'utf8');
    const reparsed = parseDataYaml(yaml);
    expect(reparsed.names).toEqual(['person', 'vest', 'gloves']);
  });
});

describe('bulkMergeClasses, rename-collision scenario', () => {
  it('collapses helmet_blue into helmet and compacts the ids (rename to merge flow)', async () => {
    // The user already renamed helmet_red to helmet; renaming helmet_blue to
    // helmet now hits an existing name, so the renderer offers a merge instead.
    // That is equivalent to bulkMergeClasses(from=helmet_blue(1), to=helmet(0)).
    const classes = ['helmet', 'helmet_blue', 'car'];
    await writeYaml(classes);
    await writeLabel('img1.txt', [
      '0 0.10 0.10 0.10 0.10', // helmet
      '1 0.20 0.20 0.10 0.10', // helmet_blue, becomes helmet
      '1 0.30 0.30 0.10 0.10', // helmet_blue, becomes helmet
      '2 0.40 0.40 0.10 0.10' // car (id 2 becomes 1 after compaction)
    ]);
    await writeLabel('img2.txt', [
      '2 0.50 0.50 0.10 0.10' // car only: id 2 shifts to 1
    ]);

    const result = await bulkMergeClasses(tempRoot, classes, 1, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.remappedAnnotations).toBe(2); // the two helmet_blue boxes
    expect(result.affectedFiles).toBe(2);

    const img1 = await readLabel('img1.txt');
    expect(img1.trim().split('\n')).toEqual([
      '0 0.100000 0.100000 0.100000 0.100000', // helmet, unchanged
      '0 0.200000 0.200000 0.100000 0.100000', // was helmet_blue
      '0 0.300000 0.300000 0.100000 0.100000', // was helmet_blue
      '1 0.400000 0.400000 0.100000 0.100000' // car, shifted from 2 to 1
    ]);
    const img2 = await readLabel('img2.txt');
    expect(img2.trim()).toBe('1 0.500000 0.500000 0.100000 0.100000');

    const yaml = await fs.readFile(path.join(tempRoot, 'data.yaml'), 'utf8');
    const reparsed = parseDataYaml(yaml);
    expect(reparsed.names).toEqual(['helmet', 'car']);
  });
});

describe('bulkRemapClasses', () => {
  it('applies several remaps in one atomic batch', async () => {
    const classes = ['a', 'b', 'c'];
    await writeYaml(classes);
    await writeLabel('img.txt', [
      '0 0.5 0.5 0.1 0.1',
      '1 0.5 0.5 0.1 0.1',
      '2 0.5 0.5 0.1 0.1'
    ]);
    // Mapping: 0→2, 1→0, 2→1 (rotazione)
    const result = await bulkRemapClasses(tempRoot, classes, [
      { from: 0, to: 2 },
      { from: 1, to: 0 },
      { from: 2, to: 1 }
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.remappedAnnotations).toBe(3);
    expect(result.affectedFiles).toBe(1);

    const out = await readLabel('img.txt');
    expect(out.trim().split('\n')).toEqual([
      '2 0.500000 0.500000 0.100000 0.100000',
      '0 0.500000 0.500000 0.100000 0.100000',
      '1 0.500000 0.500000 0.100000 0.100000'
    ]);
    // names is unchanged: only the class_id values are shuffled.
    const yaml = await fs.readFile(path.join(tempRoot, 'data.yaml'), 'utf8');
    const reparsed = parseDataYaml(yaml);
    expect(reparsed.names).toEqual(['a', 'b', 'c']);
  });

  it('creates a backup folder with the modified files before applying', async () => {
    const classes = ['a', 'b'];
    await writeYaml(classes);
    await writeLabel('one.txt', ['0 0.5 0.5 0.1 0.1']);
    const result = await bulkRemapClasses(tempRoot, classes, [{ from: 0, to: 1 }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const backupOriginal = await fs.readFile(
      path.join(result.backupPath, 'labels', 'one.txt'),
      'utf8'
    );
    // The backup must be byte-identical to the original, not reformatted by
    // the serializer.
    expect(backupOriginal.trim()).toBe('0 0.5 0.5 0.1 0.1');
    const backupYaml = await fs.readFile(path.join(result.backupPath, 'data.yaml'), 'utf8');
    expect(backupYaml).toContain('a');
    expect(backupYaml).toContain('b');
  });
});
