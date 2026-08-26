import { app } from 'electron';
import { promises as fs, createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import { gzip, createGzip } from 'node:zlib';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';

/**
 * Filesystem logger with size-based rotation and gzip of the rotated files.
 *
 * Design notes:
 * - No winston/pino: no extra runtime dependency, under 5KB of code.
 * - One JSON object per line (NDJSON), so the file is readable both with
 *   `tail -f` and from an analysis pipeline.
 * - Rotation happens on write, once the file grows past `maxBytes`. At most
 *   `maxFiles` rotated files are kept, gzipped. Everything is best-effort: an
 *   I/O error is swallowed rather than propagated, because logging must never
 *   be able to take the app down.
 *
 * Events emitted by the app: `app_boot`, `dataset_opened`, `bulk_op`,
 * `save_failed`, `recovery`, `delete_image`, `delete_images_bulk`,
 * `crash_renderer`, `trash_cleanup`, `orphan_cleanup`.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface Logger {
  info: (event: string, data?: Record<string, unknown>) => void;
  warn: (event: string, data?: Record<string, unknown>) => void;
  error: (event: string, data?: Record<string, unknown>) => void;
  filePath: () => string;
  folder: () => string;
  flush: () => Promise<void>;
}

interface LoggerConfig {
  filename: string;
  maxBytes: number;
  maxFiles: number;
}

const DEFAULT_CONFIG: LoggerConfig = {
  filename: 'app-debug.log',
  maxBytes: 10 * 1024 * 1024,
  maxFiles: 5
};

const gzipAsync = promisify(gzip);

let singleton: Logger | null = null;

function logsFolder(): string {
  return path.join(app.getPath('userData'), 'logs');
}

async function ensureFolder(folder: string): Promise<void> {
  await fs.mkdir(folder, { recursive: true });
}

async function fileSize(p: string): Promise<number> {
  try {
    const s = await fs.stat(p);
    return s.size;
  } catch {
    return 0;
  }
}

async function rotate(folder: string, baseName: string, maxFiles: number): Promise<void> {
  const current = path.join(folder, baseName);
  // Shift the existing .N.gz files up, then compress the current file to .1.gz.
  for (let i = maxFiles; i >= 1; i--) {
    const src = path.join(folder, `${baseName}.${i}.gz`);
    const dst = path.join(folder, `${baseName}.${i + 1}.gz`);
    try {
      await fs.rename(src, dst);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        // Ignore and keep shifting the remaining files.
      }
    }
  }
  // Drop the file that just fell out of the retention window (.N+1.gz).
  try {
    await fs.unlink(path.join(folder, `${baseName}.${maxFiles + 1}.gz`));
  } catch {
    // Nothing to drop.
  }
  // Compress the current file into .1.gz.
  try {
    const out = path.join(folder, `${baseName}.1.gz`);
    await pipeline(createReadStream(current), createGzip(), createWriteStream(out));
    await fs.unlink(current);
  } catch {
    // Streaming failed: fall back to compressing the whole file in memory.
    try {
      const buf = await fs.readFile(current);
      const gzipped = await gzipAsync(buf);
      await fs.writeFile(path.join(folder, `${baseName}.1.gz`), gzipped);
      await fs.unlink(current);
    } catch {
      // Best-effort: leave the file as it is.
    }
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '"<unserializable>"';
  }
}

interface AppendQueueItem {
  line: string;
}

function createLogger(config: LoggerConfig = DEFAULT_CONFIG): Logger {
  const folder = logsFolder();
  const filePath = path.join(folder, config.filename);
  let queue: AppendQueueItem[] = [];
  let flushing = false;

  async function flush(): Promise<void> {
    if (flushing) return;
    if (queue.length === 0) return;
    flushing = true;
    try {
      await ensureFolder(folder);
      while (queue.length > 0) {
        const items = queue;
        queue = [];
        const data = items.map((i) => i.line).join('');
        try {
          await fs.appendFile(filePath, data, 'utf8');
        } catch {
          // Best-effort: a lost log line must never block the app.
        }
        try {
          const size = await fileSize(filePath);
          if (size >= config.maxBytes) {
            await rotate(folder, config.filename, config.maxFiles);
          }
        } catch {
          // Rotation errors are not fatal either.
        }
      }
    } finally {
      flushing = false;
    }
  }

  function enqueue(level: LogLevel, event: string, data?: Record<string, unknown>): void {
    const entry = {
      ts: new Date().toISOString(),
      level,
      event,
      ...(data ?? {})
    };
    queue.push({ line: `${safeStringify(entry)}\n` });
    void flush();
  }

  return {
    info: (event, data) => enqueue('info', event, data),
    warn: (event, data) => enqueue('warn', event, data),
    error: (event, data) => enqueue('error', event, data),
    filePath: () => filePath,
    folder: () => folder,
    flush
  };
}

export function getLogger(): Logger {
  if (!singleton) singleton = createLogger();
  return singleton;
}

export function logsFolderPath(): string {
  return logsFolder();
}
