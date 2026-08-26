import path from 'node:path';
import { app, ipcMain, shell } from 'electron';
import type {
  AppInfo,
  CleanupResult,
  DeleteBulkResult,
  DeleteImageResult,
  OpenFolderResult
} from '../../shared/types';
import { softDeleteImage, softDeleteImages, TRASH_DIRNAME } from '../lib/softDelete';
import { DEFAULT_TTL_DAYS, parseDirTimestamp, ttlCleanup } from '../lib/ttlCleanup';
import { getLogger, logsFolderPath } from '../lib/logger';

export const DELETE_IPC_CHANNELS = {
  deleteImage: 'image:delete',
  deleteImagesBulk: 'image:deleteBulk',
  cleanupTrash: 'trash:cleanup',
  openFolder: 'app:openFolder',
  openLogsFolder: 'app:openLogsFolder',
  logEvent: 'app:logEvent',
  appInfo: 'app:info'
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function registerDeleteHandlers(): void {
  const logger = getLogger();

  ipcMain.handle(
    DELETE_IPC_CHANNELS.deleteImage,
    async (_evt, datasetRoot: string, imageFilename: string): Promise<DeleteImageResult> => {
      if (typeof datasetRoot !== 'string' || typeof imageFilename !== 'string') {
        return {
          ok: false,
          filename: typeof imageFilename === 'string' ? imageFilename : '',
          reason: 'unknown',
          details: 'Invalid arguments',
          rolledBack: true
        };
      }
      const t0 = Date.now();
      const result = await softDeleteImage(datasetRoot, imageFilename);
      if (result.ok) {
        logger.info('delete_image', {
          filename: imageFilename,
          had_label_file: result.hadLabelFile,
          annotations_count: result.annotationsCount,
          duration_ms: Date.now() - t0
        });
      } else {
        logger.warn('delete_image_failed', {
          filename: imageFilename,
          reason: result.reason,
          rolled_back: result.rolledBack,
          details: result.details
        });
      }
      return result;
    }
  );

  ipcMain.handle(
    DELETE_IPC_CHANNELS.deleteImagesBulk,
    async (
      _evt,
      datasetRoot: string,
      imageFilenames: string[]
    ): Promise<DeleteBulkResult> => {
      if (typeof datasetRoot !== 'string' || !Array.isArray(imageFilenames)) {
        return { succeeded: [], failed: [], totalAnnotationsRemoved: 0 };
      }
      const t0 = Date.now();
      const result = await softDeleteImages(datasetRoot, imageFilenames);
      logger.info('bulk_op', {
        op: 'delete_images_bulk',
        affected_files: result.succeeded.length,
        failed_files: result.failed.length,
        annotations_removed: result.totalAnnotationsRemoved,
        duration_ms: Date.now() - t0
      });
      return result;
    }
  );

  ipcMain.handle(
    DELETE_IPC_CHANNELS.cleanupTrash,
    async (_evt, datasetRoot: string, ttlDays?: number): Promise<CleanupResult> => {
      if (typeof datasetRoot !== 'string' || datasetRoot.length === 0) {
        return { removed: 0, freedBytes: 0 };
      }
      const days = typeof ttlDays === 'number' && ttlDays > 0 ? ttlDays : DEFAULT_TTL_DAYS;
      const res = await ttlCleanup({
        rootPath: path.join(datasetRoot, TRASH_DIRNAME),
        ttlMs: days * DAY_MS,
        parseTimestamp: parseDirTimestamp,
        silent: true
      });
      if (res.removed > 0) {
        logger.info('trash_cleanup', {
          dataset_root: datasetRoot,
          ttl_days: days,
          removed: res.removed,
          freed_bytes: res.freedBytes,
          errors: res.errors
        });
      }
      return { removed: res.removed, freedBytes: res.freedBytes };
    }
  );

  ipcMain.handle(
    DELETE_IPC_CHANNELS.openFolder,
    async (_evt, folderPath: string): Promise<OpenFolderResult> => {
      if (typeof folderPath !== 'string' || folderPath.length === 0) {
        return { ok: false, reason: 'Invalid path' };
      }
      try {
        const errString = await shell.openPath(folderPath);
        if (errString) {
          return { ok: false, reason: errString };
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: (err as Error).message };
      }
    }
  );

  ipcMain.handle(
    DELETE_IPC_CHANNELS.openLogsFolder,
    async (): Promise<OpenFolderResult> => {
      const folder = logsFolderPath();
      try {
        const errString = await shell.openPath(folder);
        if (errString) return { ok: false, reason: errString };
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: (err as Error).message };
      }
    }
  );

  ipcMain.handle(
    DELETE_IPC_CHANNELS.logEvent,
    async (
      _evt,
      level: 'info' | 'warn' | 'error',
      event: string,
      data?: Record<string, unknown>
    ): Promise<void> => {
      if (typeof event !== 'string') return;
      const safeLevel: 'info' | 'warn' | 'error' =
        level === 'warn' || level === 'error' ? level : 'info';
      logger[safeLevel](event, data ?? {});
    }
  );

  ipcMain.handle(DELETE_IPC_CHANNELS.appInfo, async (): Promise<AppInfo> => {
    return {
      version: app.getVersion(),
      electronVersion: process.versions['electron'] ?? '',
      chromiumVersion: process.versions['chrome'] ?? '',
      nodeVersion: process.versions['node'] ?? '',
      platform: process.platform,
      logsFolder: logsFolderPath()
    };
  });
}
