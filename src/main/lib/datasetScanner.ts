import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  ImageIndexEntry,
  InvalidStructureReason,
  OpenDatasetResult
} from '../../shared/types';
import { parseDataYaml, YamlParseError } from '../../shared/yamlParser';
import { mt } from './appLocale';

const SUPPORTED_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png']);

export async function scanDataset(root: string): Promise<OpenDatasetResult> {
  const dataYamlPath = path.join(root, 'data.yaml');
  const imagesDir = path.join(root, 'images');
  const labelsDir = path.join(root, 'labels');

  const missing = await findMissingStructure(dataYamlPath, imagesDir, labelsDir);
  if (missing) {
    return {
      ok: false,
      reason: 'invalid_structure',
      attemptedRoot: root,
      missing
    };
  }

  let yamlText: string;
  try {
    yamlText = await fs.readFile(dataYamlPath, 'utf8');
  } catch (err) {
    return {
      ok: false,
      reason: 'io_error',
      attemptedRoot: root,
      details: mt('fs.error.readDataYaml', { message: (err as Error).message })
    };
  }

  let classes: string[];
  try {
    const parsed = parseDataYaml(yamlText);
    classes = parsed.names;
  } catch (err) {
    if (err instanceof YamlParseError) {
      const message = err.code ? mt(err.code) : err.message;
      return {
        ok: false,
        reason: 'yaml_parse_error',
        attemptedRoot: root,
        details: err.line
          ? mt('fs.error.dataYamlAtLine', { line: err.line, message })
          : mt('fs.error.dataYaml', { message })
      };
    }
    return {
      ok: false,
      reason: 'yaml_parse_error',
      attemptedRoot: root,
      details: mt('fs.error.dataYaml', { message: (err as Error).message })
    };
  }

  const labelsSet = await listLabelFiles(labelsDir);
  const imageBasenames = await listImageBasenames(imagesDir);

  // Auto-fix of orphan files:
  // 1) .txt without a matching image -> soft-deleted to the trash (30 day TTL)
  // 2) image without a .txt -> an empty .txt is created (valid YOLO, no boxes)
  const cleanup = await reconcileOrphans(root, labelsDir, labelsSet, imageBasenames);

  // Re-read labelsSet after the cleanup: orphan .txt files are gone and the
  // freshly created empty ones have been added.
  const updatedLabelsSet = await listLabelFiles(labelsDir);
  const images = await listImageEntries(imagesDir, updatedLabelsSet);

  return { ok: true, root, classes, images, orphanCleanup: cleanup };
}

interface OrphanCleanupSummary {
  removedOrphanTxt: number;
  createdEmptyTxt: number;
  /** Trash folder that was used, or null when no .txt file was removed. */
  trashPath: string | null;
}

async function reconcileOrphans(
  root: string,
  labelsDir: string,
  labelsSet: Set<string>,
  imageBasenames: Set<string>
): Promise<OrphanCleanupSummary> {
  const summary: OrphanCleanupSummary = {
    removedOrphanTxt: 0,
    createdEmptyTxt: 0,
    trashPath: null
  };

  // 1) orphan .txt files -> soft-delete
  const orphanTxts: string[] = [];
  for (const base of labelsSet) {
    if (!imageBasenames.has(base)) orphanTxts.push(`${base}.txt`);
  }
  if (orphanTxts.length > 0) {
    const ts = formatTimestamp(new Date());
    const trashDir = path.join(root, '.annotation-progress-cache', 'trash', `${ts}-orphan-txt`, 'labels');
    try {
      await fs.mkdir(trashDir, { recursive: true });
      for (const filename of orphanTxts) {
        const src = path.join(labelsDir, filename);
        const dst = path.join(trashDir, filename);
        try {
          await fs.rename(src, dst);
          summary.removedOrphanTxt += 1;
        } catch {
          // A cross-device rename fails with EXDEV: fall back to copy + unlink.
          try {
            const data = await fs.readFile(src);
            await fs.writeFile(dst, data);
            await fs.unlink(src);
            summary.removedOrphanTxt += 1;
          } catch {
            // Both attempts failed: leave the .txt where it is.
          }
        }
      }
      summary.trashPath = trashDir;
    } catch {
      // The trash folder cannot be created: skip the orphan cleanup.
    }
  }

  // 2) image without a .txt -> create an empty one
  for (const base of imageBasenames) {
    if (!labelsSet.has(base)) {
      const targetPath = path.join(labelsDir, `${base}.txt`);
      try {
        await fs.writeFile(targetPath, '', { flag: 'wx' }); // wx = fail if it exists
        summary.createdEmptyTxt += 1;
      } catch {
        // Already there, or an I/O error: nothing to do.
      }
    }
  }

  return summary;
}

function formatTimestamp(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

async function listImageBasenames(imagesDir: string): Promise<Set<string>> {
  const names = new Set<string>();
  try {
    const entries = await fs.readdir(imagesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_IMAGE_EXT.has(ext)) continue;
      const base = entry.name.slice(0, entry.name.length - ext.length);
      names.add(base);
    }
  } catch {
    // images/ is unreadable.
  }
  return names;
}

async function findMissingStructure(
  dataYamlPath: string,
  imagesDir: string,
  labelsDir: string
): Promise<InvalidStructureReason | null> {
  if (!(await pathExists(dataYamlPath))) return 'missing_data_yaml';
  if (!(await isDirectory(imagesDir))) return 'missing_images_dir';
  if (!(await isDirectory(labelsDir))) return 'missing_labels_dir';
  return null;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function listLabelFiles(labelsDir: string): Promise<Set<string>> {
  const names = new Set<string>();
  try {
    const entries = await fs.readdir(labelsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith('.txt')) continue;
      const base = entry.name.slice(0, -4);
      names.add(base);
    }
  } catch {
    // labels/ is unreadable: treat it as empty.
  }
  return names;
}

async function listImageEntries(
  imagesDir: string,
  labelsSet: Set<string>
): Promise<ImageIndexEntry[]> {
  const results: ImageIndexEntry[] = [];
  const entries = await fs.readdir(imagesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED_IMAGE_EXT.has(ext)) continue;
    const base = entry.name.slice(0, entry.name.length - ext.length);
    results.push({
      filename: entry.name,
      hasLabelFile: labelsSet.has(base)
    });
  }
  // Fixed 'en' collation with numeric ordering, so the list order does not
  // depend on the machine locale ("img2.jpg" before "img10.jpg").
  results.sort((a, b) => a.filename.localeCompare(b.filename, 'en', { numeric: true }));
  return results;
}

export function labelFilenameForImage(imageFilename: string): string {
  const ext = path.extname(imageFilename);
  const base = imageFilename.slice(0, imageFilename.length - ext.length);
  return `${base}.txt`;
}

export async function createEmptyDataYaml(root: string): Promise<void> {
  const dataYamlPath = path.join(root, 'data.yaml');
  await fs.writeFile(dataYamlPath, 'nc: 0\nnames: []\n', 'utf8');
}
