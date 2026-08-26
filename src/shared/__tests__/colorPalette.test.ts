import { describe, it, expect } from 'vitest';
import { classNameToColor } from '../colorPalette';

describe('classNameToColor', () => {
  it('returns the same colour for the same string, ignoring case', () => {
    const a = classNameToColor('person');
    const b = classNameToColor('PERSON');
    const c = classNameToColor('  person  ');
    expect(b.hex).toBe(a.hex);
    expect(c.hex).toBe(a.hex);
  });

  it('spreads the 9 sample classes over distinct hues', () => {
    const classes = ['person', 'helmet', 'vest', 'harness', 'forklift', 'vehicle', 'fire', 'smoke', 'fall'];
    const hues = new Set<string>();
    for (const name of classes) hues.add(classNameToColor(name).hslCss);
    expect(hues.size).toBeGreaterThanOrEqual(7);
  });
});
