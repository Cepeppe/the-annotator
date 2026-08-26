import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { RecentDataset } from '../../shared/types';
import { stripBom, writeFileAtomic } from './atomicWrite';

export const RECENT_DATASETS_FILENAME = 'recent-datasets.json';
export const MAX_RECENT_DATASETS = 5;

interface RecentDatasetsFile {
  datasets: RecentDataset[];
}

function recentDatasetsPath(): string {
  return path.join(app.getPath('userData'), RECENT_DATASETS_FILENAME);
}

function isValidEntry(raw: unknown): raw is RecentDataset {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o['path'] === 'string' &&
    typeof o['name'] === 'string' &&
    typeof o['lastOpenedAt'] === 'string'
  );
}

async function isExistingDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function loadRecentDatasets(): Promise<RecentDataset[]> {
  const filePath = recentDatasetsPath();
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return [];
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripBom(raw));
  } catch {
    return [];
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as RecentDatasetsFile).datasets)
  ) {
    return [];
  }
  const list = (parsed as RecentDatasetsFile).datasets
    .filter(isValidEntry)
    .slice(0, MAX_RECENT_DATASETS);

  // Drop entries whose folder no longer exists (deleted or moved), then persist
  // the cleaned list so the next read does not have to check them again.
  const checks = await Promise.all(list.map((d) => isExistingDirectory(d.path)));
  const existing = list.filter((_, i) => checks[i]);
  if (existing.length !== list.length) {
    try {
      await writeRecentDatasets(existing);
    } catch {
      // Best-effort: if the write fails, the next boot retries.
    }
  }
  return existing;
}

async function writeRecentDatasets(datasets: RecentDataset[]): Promise<void> {
  const content: RecentDatasetsFile = { datasets: datasets.slice(0, MAX_RECENT_DATASETS) };
  await writeFileAtomic(recentDatasetsPath(), JSON.stringify(content, null, 2));
}

export async function addRecentDataset(p: string, name: string): Promise<RecentDataset[]> {
  const existing = await loadRecentDatasets();
  const filtered = existing.filter((d) => d.path !== p);
  const entry: RecentDataset = {
    path: p,
    name,
    lastOpenedAt: new Date().toISOString()
  };
  const next = [entry, ...filtered].slice(0, MAX_RECENT_DATASETS);
  await writeRecentDatasets(next);
  return next;
}

export async function removeRecentDataset(p: string): Promise<RecentDataset[]> {
  const existing = await loadRecentDatasets();
  const next = existing.filter((d) => d.path !== p);
  await writeRecentDatasets(next);
  return next;
}
