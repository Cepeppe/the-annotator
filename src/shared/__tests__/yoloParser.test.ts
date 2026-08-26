import { describe, it, expect } from 'vitest';
import { parseYoloTxt, serializeYoloTxt } from '../yoloParser';

describe('parseYoloTxt', () => {
  it('parses a valid YOLO line', () => {
    const { bboxes, warnings } = parseYoloTxt('0 0.5 0.5 0.2 0.3\n');
    expect(warnings).toHaveLength(0);
    expect(bboxes).toHaveLength(1);
    expect(bboxes[0]).toEqual({
      classId: 0,
      xCenter: 0.5,
      yCenter: 0.5,
      width: 0.2,
      height: 0.3
    });
  });

  it('tolerates mixed line endings and repeated spaces, skips blank lines', () => {
    const content = '0 0.1  0.1 0.1 0.1\r\n\r\n1   0.2 0.2   0.2 0.2\n';
    const { bboxes, warnings } = parseYoloTxt(content);
    expect(warnings).toHaveLength(0);
    expect(bboxes).toHaveLength(2);
    expect(bboxes[1]?.classId).toBe(1);
  });

  it('discards malformed lines but keeps parsing the rest', () => {
    const content = '0 0.5 0.5 0.2 0.3\nrubbish\n2 0.4 0.4 0.1 0.1\n';
    const { bboxes, warnings } = parseYoloTxt(content);
    expect(bboxes).toHaveLength(2);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('rejects coordinates outside the 0-1 range beyond the tolerance', () => {
    const content = '0 1.5 0.5 0.2 0.3\n';
    const { bboxes, warnings } = parseYoloTxt(content);
    expect(bboxes).toHaveLength(0);
    expect(warnings.length).toBe(1);
  });

  it('round-trip serialize/parse mantiene i valori a 6 decimali', () => {
    const source = [
      { classId: 0, xCenter: 0.5, yCenter: 0.5, width: 0.25, height: 0.4 },
      { classId: 3, xCenter: 0.12345, yCenter: 0.98765, width: 0.1, height: 0.1 }
    ];
    const text = serializeYoloTxt(source);
    const { bboxes } = parseYoloTxt(text);
    expect(bboxes).toHaveLength(2);
    expect(bboxes[0]?.classId).toBe(0);
    expect(bboxes[1]?.classId).toBe(3);
    expect(bboxes[1]?.xCenter).toBeCloseTo(0.12345, 5);
  });

  it('serializeYoloTxt produce file vuoto se nessuna bbox', () => {
    expect(serializeYoloTxt([])).toBe('');
  });

  it('serializeYoloTxt usa line endings \\n e separatore singolo, 6 decimali esatti', () => {
    const text = serializeYoloTxt([
      { classId: 7, xCenter: 1 / 3, yCenter: 0.5, width: 0.25, height: 0.4 }
    ]);
    expect(text).toBe('7 0.333333 0.500000 0.250000 0.400000\n');
    expect(text.includes('\r')).toBe(false);
  });

  it('serializeYoloTxt preserves the insertion order', () => {
    const source = [
      { classId: 5, xCenter: 0.1, yCenter: 0.1, width: 0.05, height: 0.05 },
      { classId: 1, xCenter: 0.9, yCenter: 0.9, width: 0.05, height: 0.05 },
      { classId: 3, xCenter: 0.5, yCenter: 0.5, width: 0.05, height: 0.05 }
    ];
    const lines = serializeYoloTxt(source).trim().split('\n');
    expect(lines.map((l) => l.split(' ')[0])).toEqual(['5', '1', '3']);
  });
});
