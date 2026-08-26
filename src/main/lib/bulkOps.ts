import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { BulkOpKind, BulkOpResult } from '../../shared/types';
import { parseYoloTxt, serializeYoloTxt } from '../../shared/yoloParser';
import { ensureDir, writeFileAtomic } from './atomicWrite';
import { saveDataYaml, dataYamlPath } from './saveDataYaml';
import { DEFAULT_TTL_MS, parseDirTimestamp, ttlCleanup } from './ttlCleanup';
import { mt } from './appLocale';

const APPLY_CONCURRENCY = 16;
const BACKUP_DIRNAME = path.join('.annotation-progress-cache', 'backup');

export interface BulkOpHooks {
  onPhase?: (phase: 'scanning' | 'backup' | 'applying' | 'rollback' | 'done') => void;
  onProgress?: (current: number, total: number) => void;
  isCancelled?: () => boolean;
}

interface AffectedFile {
  filename: string;
  outputContent: string;
  removedAnnotations: number;
  remappedAnnotations: number;
}

type RemapFn = (classId: number) =>
  | { kind: 'keep' }
  | { kind: 'replace'; to: number; remapped: boolean }
  | { kind: 'drop' };

export async function bulkDeleteClassAnnotations(
  datasetRoot: string,
  classes: string[],
  classId: number,
  hooks: BulkOpHooks = {}
): Promise<BulkOpResult> {
  const className = classes[classId];
  if (className === undefined) {
    return { ok: false, reason: `Invalid class index: ${classId}`, rolledBack: false };
  }
  const remap: RemapFn = (cid) => {
    if (cid === classId) return { kind: 'drop' };
    if (cid > classId) return { kind: 'replace', to: cid - 1, remapped: false };
    return { kind: 'keep' };
  };
  const newClasses = classes.filter((_, idx) => idx !== classId);
  return runBulkOp(datasetRoot, classes, newClasses, remap, 'delete_class', hooks);
}

export async function bulkMergeClasses(
  datasetRoot: string,
  classes: string[],
  fromClassId: number,
  toClassId: number,
  hooks: BulkOpHooks = {}
): Promise<BulkOpResult> {
  if (fromClassId === toClassId) {
    return {
      ok: false,
      reason: 'Source and target class are the same',
      rolledBack: false
    };
  }
  if (classes[fromClassId] === undefined || classes[toClassId] === undefined) {
    return {
      ok: false,
      reason: `Invalid class indexes: from=${fromClassId} to=${toClassId}`,
      rolledBack: false
    };
  }
  const finalTarget = toClassId > fromClassId ? toClassId - 1 : toClassId;
  const remap: RemapFn = (cid) => {
    if (cid === fromClassId) return { kind: 'replace', to: finalTarget, remapped: true };
    if (cid > fromClassId) return { kind: 'replace', to: cid - 1, remapped: false };
    return { kind: 'keep' };
  };
  const newClasses = classes.filter((_, idx) => idx !== fromClassId);
  return runBulkOp(datasetRoot, classes, newClasses, remap, 'merge_classes', hooks);
}

/**
 * Reorders the classes by moving the entry at `fromIndex` to `toIndex` in
 * data.yaml and remapping every class_id in the .txt files accordingly.
 * Atomic: a backup is taken first and restored if anything fails.
 *
 * Example: classes=['a','b','c'], fromIndex=2, toIndex=0
 *   newClasses = ['c','a','b']
 *   mapping (old class_id -> new): 0->1, 1->2, 2->0
 *
 * The common case (move one row up or down) is a swap of two adjacent indexes.
 */
export async function bulkReorderClasses(
  datasetRoot: string,
  classes: string[],
  fromIndex: number,
  toIndex: number,
  hooks: BulkOpHooks = {}
): Promise<BulkOpResult> {
  if (
    fromIndex < 0 ||
    fromIndex >= classes.length ||
    toIndex < 0 ||
    toIndex >= classes.length
  ) {
    return { ok: false, reason: 'Reorder indexes out of range', rolledBack: false };
  }
  if (fromIndex === toIndex) {
    return { ok: false, reason: 'fromIndex === toIndex (no-op)', rolledBack: false };
  }
  // Build newClasses by moving the entry.
  const newClasses = [...classes];
  const [moved] = newClasses.splice(fromIndex, 1);
  if (moved === undefined) {
    return { ok: false, reason: 'Invalid fromIndex', rolledBack: false };
  }
  newClasses.splice(toIndex, 0, moved);
  // Build the old_id -> new_id map by comparing the two lists: the new
  // class_id of an entry is its index in newClasses. This assumes class names
  // are unique, which addClass and rename already guarantee.
  const oldToNew = new Map<number, number>();
  for (let oldId = 0; oldId < classes.length; oldId++) {
    const name = classes[oldId];
    if (name === undefined) continue;
    const newId = newClasses.indexOf(name);
    if (newId === -1 || newId === oldId) continue;
    oldToNew.set(oldId, newId);
  }
  if (oldToNew.size === 0) {
    return { ok: false, reason: 'No class_id actually changes', rolledBack: false };
  }
  const remap: RemapFn = (cid) => {
    const to = oldToNew.get(cid);
    if (to === undefined) return { kind: 'keep' };
    return { kind: 'replace', to, remapped: true };
  };
  return runBulkOp(datasetRoot, classes, newClasses, remap, 'reorder_classes', hooks);
}

export async function bulkRemapClasses(
  datasetRoot: string,
  classes: string[],
  mapping: Array<{ from: number; to: number }>,
  hooks: BulkOpHooks = {}
): Promise<BulkOpResult> {
  if (mapping.length === 0) {
    return { ok: false, reason: 'No mapping row provided', rolledBack: false };
  }
  const map = new Map<number, number>();
  for (const { from, to } of mapping) {
    if (classes[from] === undefined || classes[to] === undefined) {
      return {
        ok: false,
        reason: `Invalid mapping: ${from} -> ${to}`,
        rolledBack: false
      };
    }
    map.set(from, to);
  }
  const remap: RemapFn = (cid) => {
    const to = map.get(cid);
    if (to === undefined || to === cid) return { kind: 'keep' };
    return { kind: 'replace', to, remapped: true };
  };
  return runBulkOp(datasetRoot, classes, classes, remap, 'remap_classes', hooks);
}

async function runBulkOp(
  datasetRoot: string,
  oldClasses: string[],
  newClasses: string[],
  remap: RemapFn,
  kind: BulkOpKind,
  hooks: BulkOpHooks
): Promise<BulkOpResult> {
  const labelsDir = path.join(datasetRoot, 'labels');
  hooks.onPhase?.('scanning');

  let labelFiles: string[];
  try {
    labelFiles = await listTxtFiles(labelsDir);
  } catch (err) {
    return {
      ok: false,
      reason: `Reading the labels/ folder failed: ${(err as Error).message}`,
      rolledBack: false
    };
  }

  const affected: AffectedFile[] = [];
  let scanned = 0;
  for (const file of labelFiles) {
    if (hooks.isCancelled?.()) {
      return { ok: false, reason: mt('bulkOp.cancelled'), rolledBack: false };
    }
    scanned += 1;
    if (scanned % 200 === 0) hooks.onProgress?.(scanned, labelFiles.length);
    const fullPath = path.join(labelsDir, file);
    let content: string;
    try {
      content = await fs.readFile(fullPath, 'utf8');
    } catch {
      continue;
    }
    const transformed = transformContent(content, remap);
    if (transformed.changed) {
      affected.push({
        filename: file,
        outputContent: transformed.output,
        removedAnnotations: transformed.removed,
        remappedAnnotations: transformed.remapped
      });
    }
  }

  hooks.onPhase?.('backup');
  let backupPath: string;
  try {
    backupPath = await createBackup(
      datasetRoot,
      kind,
      affected.map((a) => path.join('labels', a.filename))
    );
  } catch (err) {
    return {
      ok: false,
      reason: `Creating the backup failed: ${(err as Error).message}`,
      rolledBack: false
    };
  }

  hooks.onPhase?.('applying');
  const written: string[] = [];
  let applied = 0;
  let totalRemoved = 0;
  let totalRemapped = 0;

  let cursor = 0;
  let aborted: Error | null = null;
  async function worker(): Promise<void> {
    while (cursor < affected.length && !aborted && !hooks.isCancelled?.()) {
      const idx = cursor++;
      const item = affected[idx];
      if (!item) return;
      const targetPath = path.join(labelsDir, item.filename);
      try {
        await writeFileAtomic(targetPath, item.outputContent);
        written.push(item.filename);
        applied += 1;
        totalRemoved += item.removedAnnotations;
        totalRemapped += item.remappedAnnotations;
        if (applied % 50 === 0 || applied === affected.length) {
          hooks.onProgress?.(applied, affected.length);
        }
      } catch (err) {
        aborted = err as Error;
        return;
      }
    }
  }

  const workers: Promise<void>[] = [];
  const wc = Math.min(APPLY_CONCURRENCY, Math.max(1, affected.length));
  for (let i = 0; i < wc; i++) workers.push(worker());
  await Promise.all(workers);

  if (hooks.isCancelled?.() && !aborted) {
    aborted = new Error(mt('bulkOp.cancelled'));
  }

  if (aborted) {
    hooks.onPhase?.('rollback');
    const rollbackOk = await restoreFromBackup(datasetRoot, backupPath, written);
    return {
      ok: false,
      reason: aborted.message,
      rolledBack: rollbackOk
    };
  }

  if (newClasses !== oldClasses || newClasses.length !== oldClasses.length) {
    const yamlRes = await saveDataYaml(datasetRoot, newClasses);
    if (!yamlRes.ok) {
      hooks.onPhase?.('rollback');
      const rollbackOk = await restoreFromBackup(datasetRoot, backupPath, written);
      return {
        ok: false,
        reason: `Updating data.yaml failed: ${yamlRes.reason}`,
        rolledBack: rollbackOk
      };
    }
  }

  hooks.onPhase?.('done');
  hooks.onProgress?.(affected.length, affected.length);

  return {
    ok: true,
    affectedFiles: affected.length,
    removedAnnotations: totalRemoved,
    remappedAnnotations: totalRemapped,
    backupPath
  };
}

function transformContent(
  content: string,
  remap: RemapFn
): { output: string; changed: boolean; removed: number; remapped: number } {
  const parsed = parseYoloTxt(content);
  let removed = 0;
  let remapped = 0;
  let changed = false;
  const next = [];
  for (const bbox of parsed.bboxes) {
    const action = remap(bbox.classId);
    if (action.kind === 'drop') {
      removed += 1;
      changed = true;
      continue;
    }
    if (action.kind === 'replace') {
      if (action.remapped) remapped += 1;
      changed = true;
      next.push({ ...bbox, classId: action.to });
      continue;
    }
    next.push(bbox);
  }
  if (!changed) return { output: content, changed: false, removed: 0, remapped: 0 };
  return { output: serializeYoloTxt(next), changed: true, removed, remapped };
}

async function listTxtFiles(labelsDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(labelsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.txt'))
      .map((e) => e.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

export async function createBackup(
  datasetRoot: string,
  label: string,
  files: string[]
): Promise<string> {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeLabel = label.replace(/[^a-z0-9_-]/gi, '_');
  const backupDir = path.join(datasetRoot, BACKUP_DIRNAME, `${ts}-${safeLabel}`);
  await ensureDir(backupDir);

  const yamlSrc = dataYamlPath(datasetRoot);
  try {
    const yamlContent = await fs.readFile(yamlSrc);
    await fs.writeFile(path.join(backupDir, 'data.yaml'), yamlContent);
  } catch {
    // A dataset with no data.yaml is odd but not a reason to abort the backup.
  }

  for (const rel of files) {
    const src = path.join(datasetRoot, rel);
    const dst = path.join(backupDir, rel);
    await ensureDir(path.dirname(dst));
    try {
      const buf = await fs.readFile(src);
      await fs.writeFile(dst, buf);
    } catch {
      // The file may not exist yet: nothing to back up.
    }
  }

  return backupDir;
}

async function restoreFromBackup(
  datasetRoot: string,
  backupPath: string,
  writtenLabelFiles: string[]
): Promise<boolean> {
  let allOk = true;
  for (const file of writtenLabelFiles) {
    const src = path.join(backupPath, 'labels', file);
    const dst = path.join(datasetRoot, 'labels', file);
    try {
      const buf = await fs.readFile(src);
      await writeFileAtomic(dst, buf);
    } catch {
      allOk = false;
    }
  }
  return allOk;
}

export async function cleanupOldBackups(datasetRoot: string): Promise<void> {
  await ttlCleanup({
    rootPath: path.join(datasetRoot, BACKUP_DIRNAME),
    ttlMs: DEFAULT_TTL_MS,
    parseTimestamp: parseDirTimestamp,
    silent: true
  });
}
