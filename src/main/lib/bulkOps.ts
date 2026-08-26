import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { BulkOpKind, BulkOpResult } from '../../shared/types';
import { parseYoloTxt, serializeYoloTxt } from '../../shared/yoloParser';
import { reorderClasses, reorderIdMapping } from '../../shared/classOps';
import { ensureDir, writeFileAtomic } from './atomicWrite';
import { saveDataYaml, dataYamlPath } from './saveDataYaml';
import { DEFAULT_TTL_MS, parseDirTimestamp, ttlCleanup } from './ttlCleanup';
import { mt } from './appLocale';

const APPLY_CONCURRENCY = 16;
const BACKUP_DIRNAME = path.join('.annotation-progress-cache', 'backup');
const BACKUP_YAML_NAME = 'data.yaml';

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
  const newClasses = reorderClasses(classes, fromIndex, toIndex);
  if (newClasses === null) {
    return { ok: false, reason: 'Invalid fromIndex', rolledBack: false };
  }
  const oldToNew = reorderIdMapping(classes.length, fromIndex, toIndex);
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
  // bulkRemapClasses passes the very same array for both, because it only
  // shuffles class ids and leaves names alone.
  const rewritesYaml = newClasses !== oldClasses || newClasses.length !== oldClasses.length;
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
      return { ok: false, reason: mt('bulkOp.cancelled'), rolledBack: true };
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
  let backup: BackupOutcome;
  try {
    backup = await createBackup(
      datasetRoot,
      kind,
      affected.map((a) => path.join('labels', a.filename))
    );
  } catch (err) {
    return {
      ok: false,
      reason: `Creating the backup failed: ${(err as Error).message}`,
      rolledBack: true
    };
  }

  // Nothing has been touched yet, so an incomplete backup simply means the
  // operation does not start: applying it would leave behind files that a
  // rollback has no copy to put back.
  if (backup.unreadable.length > 0) {
    return {
      ok: false,
      reason:
        `Creating the backup failed: ${backup.unreadable.length} file(s) could not be copied ` +
        `(${backup.unreadable.slice(0, 3).join(', ')}). No file has been modified.`,
      rolledBack: true
    };
  }
  if (rewritesYaml && !backup.yamlBackedUp) {
    return {
      ok: false,
      reason:
        'Creating the backup failed: data.yaml could not be read. No file has been modified.',
      rolledBack: true
    };
  }
  if (hooks.isCancelled?.()) {
    return { ok: false, reason: mt('bulkOp.cancelled'), rolledBack: true };
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
      // Recorded before the write rather than after it: a write that throws
      // part-way through still has to be a rollback candidate, because
      // writeFileAtomic cannot promise the target was left untouched on every
      // filesystem. Restoring a file that was never modified is harmless.
      written.push(item.filename);
      try {
        await writeFileAtomic(targetPath, item.outputContent);
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
    const rollbackOk = await restoreFromBackup(datasetRoot, backup, written, rewritesYaml);
    return {
      ok: false,
      reason: (aborted as Error).message,
      rolledBack: rollbackOk
    };
  }

  if (rewritesYaml) {
    const yamlRes = await saveDataYaml(datasetRoot, newClasses);
    if (!yamlRes.ok) {
      hooks.onPhase?.('rollback');
      const rollbackOk = await restoreFromBackup(datasetRoot, backup, written, rewritesYaml);
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
    backupPath: backup.backupPath
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

export interface BackupOutcome {
  backupPath: string;
  /** Relative paths whose pre-operation content is stored in the backup. */
  backedUp: string[];
  /**
   * Relative paths that were asked for and could not be copied. A file that
   * simply does not exist yet is in neither list: there is nothing to put back,
   * and a rollback deletes it instead.
   */
  unreadable: string[];
  /** False when the dataset has no readable data.yaml. */
  yamlBackedUp: boolean;
}

/**
 * Folder name for a backup: `YYYY-MM-DD-HHMMSS` in UTC, the shape
 * `parseDirTimestamp` understands, so the 30-day cleanup reads the age off the
 * name. The previous `toISOString()`-derived name kept the `T` separator, no
 * longer matched that pattern, and silently fell back to the folder mtime.
 */
function backupTimestamp(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}-` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  );
}

/**
 * Creates `<root>/.annotation-progress-cache/backup/<ts>-<label>[-n]/`. Two
 * operations started within the same second get distinct folders, so the second
 * one cannot overwrite the copies the first is still relying on for a rollback.
 */
async function createBackupDir(datasetRoot: string, label: string): Promise<string> {
  const ts = backupTimestamp();
  const safeLabel = label.replace(/[^a-z0-9_-]/gi, '_');
  const parent = path.join(datasetRoot, BACKUP_DIRNAME);
  await ensureDir(parent);
  for (let attempt = 1; attempt <= 100; attempt++) {
    const name = attempt === 1 ? `${ts}-${safeLabel}` : `${ts}-${safeLabel}-${attempt}`;
    const dir = path.join(parent, name);
    try {
      await fs.mkdir(dir);
      return dir;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
  }
  throw new Error('Could not allocate a backup folder');
}

export async function createBackup(
  datasetRoot: string,
  label: string,
  files: string[]
): Promise<BackupOutcome> {
  const backupDir = await createBackupDir(datasetRoot, label);
  const backedUp: string[] = [];
  const unreadable: string[] = [];

  let yamlBackedUp = false;
  try {
    const yamlContent = await fs.readFile(dataYamlPath(datasetRoot));
    await fs.writeFile(path.join(backupDir, BACKUP_YAML_NAME), yamlContent);
    yamlBackedUp = true;
  } catch {
    // A dataset with no data.yaml is odd but not a reason to abort the backup:
    // the caller decides whether the operation it is about to run needs one.
  }

  for (const rel of files) {
    const src = path.join(datasetRoot, rel);
    const dst = path.join(backupDir, rel);
    try {
      const buf = await fs.readFile(src);
      await ensureDir(path.dirname(dst));
      await fs.writeFile(dst, buf);
      backedUp.push(rel);
    } catch (err) {
      // ENOENT is benign: there is no earlier content to put back. Anything
      // else (locked, unreadable, disk full) leaves the backup incomplete, and
      // the caller must not start writing.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') unreadable.push(rel);
    }
  }

  return { backupPath: backupDir, backedUp, unreadable, yamlBackedUp };
}

/**
 * Undoes an interrupted operation: every label file that was written goes back
 * to its backed-up content, and one that had no earlier content (it did not
 * exist when the backup was taken) is removed again. data.yaml is restored too
 * when the operation was going to rewrite it.
 *
 * Returns false when any single file could not be put back, which is what the
 * "not rolled back" warning in the UI is based on.
 */
async function restoreFromBackup(
  datasetRoot: string,
  backup: BackupOutcome,
  writtenLabelFiles: string[],
  restoreYaml: boolean
): Promise<boolean> {
  let allOk = true;
  const backedUp = new Set(backup.backedUp);

  for (const file of writtenLabelFiles) {
    const rel = path.join('labels', file);
    const dst = path.join(datasetRoot, 'labels', file);
    if (!backedUp.has(rel)) {
      // The file did not exist before the operation, so putting it back means
      // removing it again.
      try {
        await fs.unlink(dst);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') allOk = false;
      }
      continue;
    }
    try {
      const buf = await fs.readFile(path.join(backup.backupPath, rel));
      await writeFileAtomic(dst, buf);
    } catch {
      allOk = false;
    }
  }

  if (restoreYaml && backup.yamlBackedUp) {
    try {
      const buf = await fs.readFile(path.join(backup.backupPath, BACKUP_YAML_NAME));
      await writeFileAtomic(dataYamlPath(datasetRoot), buf);
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
