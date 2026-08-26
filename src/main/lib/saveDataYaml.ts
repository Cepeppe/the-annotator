import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SaveDataYamlResult } from '../../shared/types';
import { parseDataYaml, serializeDataYaml, buildEmptyDataYaml } from '../../shared/yamlParser';
import { writeFileAtomic } from './atomicWrite';

const DATA_YAML_FILENAME = 'data.yaml';

export function dataYamlPath(datasetRoot: string): string {
  return path.join(datasetRoot, DATA_YAML_FILENAME);
}

export async function saveDataYaml(
  datasetRoot: string,
  names: string[]
): Promise<SaveDataYamlResult> {
  const filePath = dataYamlPath(datasetRoot);
  let original: string;
  try {
    original = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      original = buildEmptyDataYaml();
    } else {
      return { ok: false, reason: (err as Error).message };
    }
  }

  let serialized: string;
  try {
    const parsed = parseDataYaml(original);
    serialized = serializeDataYaml(parsed.rawDocument, { names, nc: names.length });
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }

  try {
    await writeFileAtomic(filePath, serialized);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}
