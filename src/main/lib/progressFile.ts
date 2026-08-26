import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  LoadProgressFileResult,
  ProgressFile,
  SaveProgressFileResult
} from '../../shared/types';
import { stripBom, writeFileAtomic } from './atomicWrite';

export const PROGRESS_FILENAME = '.annotation-progress.json';
export const PROGRESS_SCHEMA_VERSION = '1.0' as const;

export function defaultProgressFile(datasetRoot: string): ProgressFile {
  const datasetName = path.basename(datasetRoot.replace(/[\\/]+$/, ''));
  return {
    schema_version: PROGRESS_SCHEMA_VERSION,
    dataset_root_name: datasetName || datasetRoot,
    last_opened_at: new Date().toISOString(),
    last_opened_by: defaultUserName(),
    completed_images: {},
    custom_classes_added: [],
    operations_log: [],
    stats_snapshot: {
      total_images: 0,
      completed: 0,
      pending: 0,
      total_annotations: 0,
      per_class_counts: {}
    }
  };
}

export function defaultUserName(): string {
  try {
    const u = os.userInfo();
    if (u.username && u.username.length > 0) return u.username;
  } catch {
    // os.userInfo() can throw on some platforms (no passwd entry, for example).
  }
  return 'user';
}

export function progressFilePath(datasetRoot: string): string {
  return path.join(datasetRoot, PROGRESS_FILENAME);
}

export function validateProgressShape(
  raw: unknown
): { ok: true; value: ProgressFile } | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'Not a JSON object' };
  const obj = raw as Record<string, unknown>;
  if (obj['schema_version'] !== PROGRESS_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: `Unsupported schema_version: ${String(obj['schema_version'])}`
    };
  }
  if (typeof obj['dataset_root_name'] !== 'string') {
    return { ok: false, reason: 'dataset_root_name is missing or invalid' };
  }
  if (typeof obj['last_opened_at'] !== 'string') {
    return { ok: false, reason: 'last_opened_at is missing' };
  }
  if (typeof obj['last_opened_by'] !== 'string') {
    return { ok: false, reason: 'last_opened_by is missing' };
  }
  if (!obj['completed_images'] || typeof obj['completed_images'] !== 'object') {
    return { ok: false, reason: 'completed_images is missing or invalid' };
  }
  if (!Array.isArray(obj['custom_classes_added'])) {
    return { ok: false, reason: 'custom_classes_added is missing or invalid' };
  }
  if (!Array.isArray(obj['operations_log'])) {
    return { ok: false, reason: 'operations_log is missing or invalid' };
  }
  if (!obj['stats_snapshot'] || typeof obj['stats_snapshot'] !== 'object') {
    return { ok: false, reason: 'stats_snapshot is missing or invalid' };
  }
  return { ok: true, value: raw as ProgressFile };
}

export async function loadProgressFile(datasetRoot: string): Promise<LoadProgressFileResult> {
  const filePath = progressFilePath(datasetRoot);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      const fresh = defaultProgressFile(datasetRoot);
      const saveRes = await saveProgressFile(datasetRoot, fresh);
      if (!saveRes.ok) {
        return { ok: false, reason: saveRes.reason };
      }
      return { ok: true, progress: fresh, createdNew: true };
    }
    return { ok: false, reason: (err as Error).message };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripBom(raw));
  } catch (parseErr) {
    return await rotateBrokenAndCreate(datasetRoot, filePath, (parseErr as Error).message);
  }

  const validated = validateProgressShape(parsed);
  if (!validated.ok) {
    return await rotateBrokenAndCreate(datasetRoot, filePath, validated.reason);
  }

  const progress = validated.value;
  progress.last_opened_at = new Date().toISOString();
  if (!progress.last_opened_by) progress.last_opened_by = defaultUserName();
  return { ok: true, progress, createdNew: false };
}

async function rotateBrokenAndCreate(
  datasetRoot: string,
  filePath: string,
  reason: string
): Promise<LoadProgressFileResult> {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const brokenPath = `${filePath}.broken-${ts}.json`;
  try {
    await fs.rename(filePath, brokenPath);
  } catch {
    // If the rename fails the following save overwrites the file anyway.
  }
  const fresh = defaultProgressFile(datasetRoot);
  const saveRes = await saveProgressFile(datasetRoot, fresh);
  if (!saveRes.ok) {
    return { ok: false, reason: `${reason} (fallback save failed: ${saveRes.reason})` };
  }
  return {
    ok: true,
    progress: fresh,
    createdNew: false,
    recoveredFromBroken: true,
    brokenPath
  };
}

export async function saveProgressFile(
  datasetRoot: string,
  content: ProgressFile
): Promise<SaveProgressFileResult> {
  const filePath = progressFilePath(datasetRoot);
  try {
    const json = JSON.stringify(content, null, 2);
    await writeFileAtomic(filePath, json);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}
