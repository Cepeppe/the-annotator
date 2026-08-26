import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { OutOfRangeAnnotation, ScanDatasetStatsResult } from '../../shared/types';

const SCAN_CONCURRENCY = 16;

export async function scanDatasetStats(
  datasetRoot: string,
  classes: string[]
): Promise<ScanDatasetStatsResult> {
  const labelsDir = path.join(datasetRoot, 'labels');
  const imagesDir = path.join(datasetRoot, 'images');

  const [labelFiles, imageCount] = await Promise.all([
    listTxtFiles(labelsDir),
    countImages(imagesDir)
  ]);

  const perClassCounts: Record<number, number> = {};
  const outOfRange: OutOfRangeAnnotation[] = [];
  let totalAnnotations = 0;

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < labelFiles.length) {
      const idx = cursor++;
      const file = labelFiles[idx];
      if (!file) return;
      const fullPath = path.join(labelsDir, file);
      let content: string;
      try {
        content = await fs.readFile(fullPath, 'utf8');
      } catch {
        continue;
      }
      const lines = content.split(/\r?\n/);
      lines.forEach((rawLine, lineIdx) => {
        const line = rawLine.trim();
        if (line.length === 0) return;
        const tokens = line.split(/\s+/);
        if (tokens.length !== 5) return;
        const idStr = tokens[0]!;
        const id = Number.parseInt(idStr, 10);
        if (!Number.isFinite(id) || id < 0 || !Number.isInteger(id)) return;
        totalAnnotations += 1;
        perClassCounts[id] = (perClassCounts[id] ?? 0) + 1;
        if (id >= classes.length) {
          outOfRange.push({ filename: imageNameForLabel(file), classId: id, lineNo: lineIdx + 1 });
        }
      });
    }
  }

  const workers: Promise<void>[] = [];
  const workerCount = Math.min(SCAN_CONCURRENCY, Math.max(1, labelFiles.length));
  for (let i = 0; i < workerCount; i++) workers.push(worker());
  await Promise.all(workers);

  return {
    totalImages: imageCount,
    totalAnnotations,
    perClassCounts,
    outOfRangeAnnotations: outOfRange
  };
}

async function listTxtFiles(labelsDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(labelsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.txt'))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

async function countImages(imagesDir: string): Promise<number> {
  try {
    const entries = await fs.readdir(imagesDir, { withFileTypes: true });
    let n = 0;
    for (const e of entries) {
      if (!e.isFile()) continue;
      const ext = path.extname(e.name).toLowerCase();
      if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') n += 1;
    }
    return n;
  } catch {
    return 0;
  }
}

function imageNameForLabel(labelFilename: string): string {
  return labelFilename.replace(/\.txt$/i, '');
}
