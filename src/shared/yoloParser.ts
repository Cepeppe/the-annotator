import type { BBoxYolo } from './types';
import { clamp01, isWithinTolerance } from './bboxMath';

export interface ParseYoloResult {
  bboxes: BBoxYolo[];
  /** Diagnostics for skipped lines, in English: they are developer-facing. */
  warnings: string[];
}

export function parseYoloTxt(content: string): ParseYoloResult {
  const warnings: string[] = [];
  const bboxes: BBoxYolo[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (line.length === 0) return;

    const tokens = line.split(/\s+/);
    if (tokens.length !== 5) {
      warnings.push(`Line ${idx + 1}: expected 5 values, found ${tokens.length}`);
      return;
    }

    const [classIdStr, xcStr, ycStr, wStr, hStr] = tokens as [string, string, string, string, string];
    const classId = Number.parseInt(classIdStr, 10);
    const xCenter = Number.parseFloat(xcStr);
    const yCenter = Number.parseFloat(ycStr);
    const width = Number.parseFloat(wStr);
    const height = Number.parseFloat(hStr);

    if (!Number.isFinite(classId) || classId < 0 || !Number.isInteger(classId)) {
      warnings.push(`Line ${idx + 1}: invalid class id (${classIdStr})`);
      return;
    }

    const coords = [xCenter, yCenter, width, height];
    if (coords.some((v) => !Number.isFinite(v))) {
      warnings.push(`Line ${idx + 1}: non-numeric coordinates`);
      return;
    }

    if (!coords.every(isWithinTolerance)) {
      warnings.push(`Line ${idx + 1}: coordinates outside the 0-1 range`);
      return;
    }

    if (width <= 0 || height <= 0) {
      warnings.push(`Line ${idx + 1}: width or height is not positive`);
      return;
    }

    bboxes.push({
      classId,
      xCenter: clamp01(xCenter),
      yCenter: clamp01(yCenter),
      width: clamp01(width),
      height: clamp01(height)
    });
  });

  return { bboxes, warnings };
}

export function serializeYoloTxt(bboxes: BBoxYolo[]): string {
  if (bboxes.length === 0) return '';
  const lines = bboxes.map((b) => {
    const parts = [
      b.classId.toString(),
      b.xCenter.toFixed(6),
      b.yCenter.toFixed(6),
      b.width.toFixed(6),
      b.height.toFixed(6)
    ];
    return parts.join(' ');
  });
  return lines.join('\n') + '\n';
}
