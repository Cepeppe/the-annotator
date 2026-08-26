import { describe, it, expect } from 'vitest';
import { parseDataYaml, isClassNamesAsList, serializeDataYaml } from '../yamlParser';

describe('parseDataYaml', () => {
  it('extracts the class names when names is a list', () => {
    const yaml = 'nc: 3\nnames:\n  - person\n  - helmet\n  - vest\n';
    const parsed = parseDataYaml(yaml);
    expect(parsed.names).toEqual(['person', 'helmet', 'vest']);
    expect(isClassNamesAsList(parsed.rawDocument)).toBe(true);
  });

  it('extracts the class names when names is a map with ordered numeric keys', () => {
    const yaml = 'nc: 3\nnames:\n  0: person\n  2: vest\n  1: helmet\n';
    const parsed = parseDataYaml(yaml);
    expect(parsed.names).toEqual(['person', 'helmet', 'vest']);
    expect(isClassNamesAsList(parsed.rawDocument)).toBe(false);
  });

  it('preserves comments and extra fields across a round-trip', () => {
    const yaml = [
      '# commento iniziale',
      'train: ./train',
      'val: ./valid',
      'nc: 2',
      'names:',
      '  - person',
      '  - helmet',
      ''
    ].join('\n');
    const parsed = parseDataYaml(yaml);
    const serialized = serializeDataYaml(parsed.rawDocument, {});
    expect(serialized).toContain('# commento iniziale');
    expect(serialized).toContain('train: ./train');
    expect(serialized).toContain('val: ./valid');
  });

  it('preserves top-level comments after names and nc are changed', () => {
    const yaml = [
      '# commento di intestazione',
      'train: ./train',
      'val: ./valid',
      'nc: 2',
      'names:',
      '  - person',
      '  - helmet',
      ''
    ].join('\n');
    const parsed = parseDataYaml(yaml);
    const out = serializeDataYaml(parsed.rawDocument, {
      names: ['person', 'helmet', 'vest'],
      nc: 3
    });
    expect(out).toContain('# commento di intestazione');
    expect(out).toContain('train: ./train');
    expect(out).toContain('val: ./valid');
    expect(out).toMatch(/nc:\s*3/);
    // the new name has been appended
    const reparsed = parseDataYaml(out);
    expect(reparsed.names).toEqual(['person', 'helmet', 'vest']);
    expect(isClassNamesAsList(reparsed.rawDocument)).toBe(true);
  });

  it('keeps the mapping shape when the input is a mapping, even after edits', () => {
    const yaml = 'nc: 2\nnames:\n  0: person\n  1: helmet\n';
    const parsed = parseDataYaml(yaml);
    const out = serializeDataYaml(parsed.rawDocument, {
      names: ['person', 'vest', 'helmet'],
      nc: 3
    });
    const reparsed = parseDataYaml(out);
    expect(reparsed.names).toEqual(['person', 'vest', 'helmet']);
    expect(isClassNamesAsList(reparsed.rawDocument)).toBe(false);
  });
});
