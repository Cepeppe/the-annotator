import { parseDocument, YAMLMap, YAMLSeq, Scalar, isMap, isSeq, isScalar, type Pair } from 'yaml';

// Class names under `names` in data.yaml are always written between single
// quotes ('foo'), even where YAML would not require them. This keeps the file
// visually consistent and avoids parsing ambiguities in downstream tools
// (Roboflow, ultralytics, custom parsers).
function quotedScalar(value: string): Scalar {
  const s = new Scalar(value);
  s.type = Scalar.QUOTE_SINGLE;
  return s;
}

export type YamlDocument = ReturnType<typeof parseDocument>;

export interface ParseDataYamlResult {
  names: string[];
  rawDocument: YamlDocument;
}

/**
 * Errors raised by this module carry a translation key so the caller can render
 * them in the user's language. Errors bubbled up from the `yaml` package have
 * no key: their (English) message is passed through unchanged.
 */
export type YamlErrorKey =
  | 'yaml.error.parse'
  | 'yaml.error.notAMap'
  | 'yaml.error.missingNames'
  | 'yaml.error.namesShape'
  | 'yaml.error.notSerializable';

export class YamlParseError extends Error {
  constructor(
    message: string,
    public readonly line?: number,
    public readonly code?: YamlErrorKey
  ) {
    super(message);
    this.name = 'YamlParseError';
  }
}

export function parseDataYaml(yamlText: string): ParseDataYamlResult {
  const doc = parseDocument(yamlText);
  if (doc.errors.length > 0) {
    const first = doc.errors[0];
    if (!first) throw new YamlParseError('Could not parse data.yaml', undefined, 'yaml.error.parse');
    const pos = first.linePos?.[0]?.line;
    throw new YamlParseError(first.message, pos);
  }

  const contents = doc.contents;
  if (!isMap(contents)) {
    throw new YamlParseError(
      'data.yaml does not contain a valid mapping',
      undefined,
      'yaml.error.notAMap'
    );
  }

  const namesNode = contents.get('names', true);
  if (namesNode == null) {
    throw new YamlParseError(
      'data.yaml does not contain the "names" field',
      undefined,
      'yaml.error.missingNames'
    );
  }

  const names = extractNames(namesNode);
  return { names, rawDocument: doc };
}

function extractNames(node: unknown): string[] {
  if (isSeq(node)) {
    return node.items.map((item) => {
      if (item instanceof Scalar && typeof item.value === 'string') return item.value;
      if (typeof item === 'string') return item;
      return String(item);
    });
  }

  if (isMap(node)) {
    const pairs: Array<{ key: number; value: string }> = [];
    for (const pair of node.items) {
      const keyNode = pair.key;
      const valueNode = pair.value;
      const key = keyNode instanceof Scalar ? keyNode.value : keyNode;
      const keyNum = typeof key === 'number' ? key : Number.parseInt(String(key), 10);
      if (!Number.isFinite(keyNum)) continue;
      const value = valueNode instanceof Scalar ? valueNode.value : valueNode;
      const valueStr = typeof value === 'string' ? value : String(value);
      pairs.push({ key: keyNum, value: valueStr });
    }
    pairs.sort((a, b) => a.key - b.key);
    return pairs.map((p) => p.value);
  }

  throw new YamlParseError(
    'The "names" field must be a list or a mapping',
    undefined,
    'yaml.error.namesShape'
  );
}

export function isClassNamesAsList(doc: YamlDocument): boolean {
  const contents = doc.contents;
  if (!isMap(contents)) return false;
  const namesNode = contents.get('names', true);
  return isSeq(namesNode);
}

export function serializeDataYaml(
  doc: YamlDocument,
  updates: { names?: string[]; nc?: number }
): string {
  const contents = doc.contents;
  if (!isMap(contents)) {
    throw new YamlParseError(
      'data.yaml cannot be serialized',
      undefined,
      'yaml.error.notSerializable'
    );
  }

  if (updates.nc != null) {
    contents.set('nc', updates.nc);
  }

  if (updates.names != null) {
    updateNamesPreservingShape(contents, updates.names);
  }

  return doc.toString({ lineWidth: 0 });
}

function updateNamesPreservingShape(contents: YAMLMap, newNames: string[]): void {
  const node = contents.get('names', true);

  if (isSeq(node)) {
    const items = node.items;
    const reused = Math.min(items.length, newNames.length);
    for (let i = 0; i < reused; i++) {
      const existing = items[i];
      const name = newNames[i]!;
      if (isScalar(existing) && typeof existing.value === 'string') {
        existing.value = name;
        existing.type = Scalar.QUOTE_SINGLE;
      } else {
        items[i] = quotedScalar(name) as unknown as (typeof items)[number];
      }
    }
    if (items.length > newNames.length) {
      items.splice(newNames.length, items.length - newNames.length);
    } else if (items.length < newNames.length) {
      for (let i = items.length; i < newNames.length; i++) {
        node.add(quotedScalar(newNames[i]!));
      }
    }
    return;
  }

  if (isMap(node)) {
    const items = node.items as unknown as Pair[];
    const reused = Math.min(items.length, newNames.length);
    for (let i = 0; i < reused; i++) {
      const pair = items[i]!;
      const valueNode = pair.value;
      const name = newNames[i]!;
      if (isScalar(valueNode) && typeof valueNode.value === 'string') {
        valueNode.value = name;
        valueNode.type = Scalar.QUOTE_SINGLE;
      } else {
        pair.value = quotedScalar(name) as unknown as Pair['value'];
      }
      const keyNode = pair.key;
      if (isScalar(keyNode)) {
        keyNode.value = i;
      } else {
        pair.key = i as unknown as Pair['key'];
      }
    }
    if (items.length > newNames.length) {
      items.splice(newNames.length, items.length - newNames.length);
    } else if (items.length < newNames.length) {
      for (let i = items.length; i < newNames.length; i++) {
        node.add({ key: i, value: quotedScalar(newNames[i]!) });
      }
    }
    return;
  }

  const seq = new YAMLSeq();
  for (const name of newNames) seq.add(quotedScalar(name));
  contents.set('names', seq);
}

export function buildEmptyDataYaml(): string {
  return 'nc: 0\nnames: []\n';
}
