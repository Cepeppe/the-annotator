import { ipcMain, type BrowserWindow } from 'electron';
import type {
  BulkOpResult,
  BulkProgressUpdate,
  CreateBackupResponse,
  LoadProgressFileResult,
  ProgressFile,
  SaveDataYamlResult,
  SaveProgressFileResult,
  ScanDatasetStatsResult
} from '../../shared/types';
import { loadProgressFile, saveProgressFile } from '../lib/progressFile';
import { saveDataYaml } from '../lib/saveDataYaml';
import { scanDatasetStats } from '../lib/datasetStats';
import {
  bulkDeleteClassAnnotations,
  bulkMergeClasses,
  bulkRemapClasses,
  bulkReorderClasses,
  cleanupOldBackups,
  createBackup
} from '../lib/bulkOps';

export const BULK_IPC_CHANNELS = {
  loadProgressFile: 'progress:load',
  saveProgressFile: 'progress:save',
  saveDataYaml: 'dataset:saveDataYaml',
  scanDatasetStats: 'dataset:scanStats',
  bulkDeleteClass: 'bulk:deleteClass',
  bulkMergeClasses: 'bulk:mergeClasses',
  bulkRemapClasses: 'bulk:remapClasses',
  bulkReorderClasses: 'bulk:reorderClasses',
  createBackup: 'bulk:createBackup',
  cleanupBackups: 'bulk:cleanupBackups',
  bulkCancel: 'bulk:cancel',
  bulkProgress: 'bulk:progress'
} as const;

// Ids of bulk operations the renderer asked to cancel. The worker loops in
// bulkOps poll this through the `isCancelled` hook.
const cancelledOps = new Set<string>();

// Argument-validation messages stay in English: only a bug in the preload
// bridge can produce them.

function emitProgress(
  win: BrowserWindow | null,
  update: BulkProgressUpdate
): void {
  win?.webContents.send(BULK_IPC_CHANNELS.bulkProgress, update);
}

export function registerBulkHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(
    BULK_IPC_CHANNELS.loadProgressFile,
    async (_evt, datasetRoot: string): Promise<LoadProgressFileResult> => {
      if (typeof datasetRoot !== 'string' || datasetRoot.length === 0) {
        return { ok: false, reason: 'Invalid path' };
      }
      void cleanupOldBackups(datasetRoot);
      return loadProgressFile(datasetRoot);
    }
  );

  ipcMain.handle(
    BULK_IPC_CHANNELS.saveProgressFile,
    async (_evt, datasetRoot: string, content: ProgressFile): Promise<SaveProgressFileResult> => {
      if (typeof datasetRoot !== 'string' || datasetRoot.length === 0) {
        return { ok: false, reason: 'Invalid path' };
      }
      if (!content || typeof content !== 'object') {
        return { ok: false, reason: 'Invalid progress payload' };
      }
      return saveProgressFile(datasetRoot, content);
    }
  );

  ipcMain.handle(
    BULK_IPC_CHANNELS.saveDataYaml,
    async (_evt, datasetRoot: string, names: string[]): Promise<SaveDataYamlResult> => {
      if (typeof datasetRoot !== 'string' || !Array.isArray(names)) {
        return { ok: false, reason: 'Invalid arguments' };
      }
      return saveDataYaml(datasetRoot, names);
    }
  );

  ipcMain.handle(
    BULK_IPC_CHANNELS.scanDatasetStats,
    async (_evt, datasetRoot: string, classes: string[]): Promise<ScanDatasetStatsResult> => {
      if (typeof datasetRoot !== 'string' || !Array.isArray(classes)) {
        return {
          totalImages: 0,
          totalAnnotations: 0,
          perClassCounts: {},
          outOfRangeAnnotations: []
        };
      }
      return scanDatasetStats(datasetRoot, classes);
    }
  );

  ipcMain.handle(
    BULK_IPC_CHANNELS.bulkDeleteClass,
    async (
      _evt,
      datasetRoot: string,
      classes: string[],
      classId: number,
      opId: string
    ): Promise<BulkOpResult> => {
      const win = getMainWindow();
      cancelledOps.delete(opId);
      const hooks = buildHooks(win, opId);
      const res = await bulkDeleteClassAnnotations(datasetRoot, classes, classId, hooks);
      cancelledOps.delete(opId);
      return res;
    }
  );

  ipcMain.handle(
    BULK_IPC_CHANNELS.bulkMergeClasses,
    async (
      _evt,
      datasetRoot: string,
      classes: string[],
      fromClassId: number,
      toClassId: number,
      opId: string
    ): Promise<BulkOpResult> => {
      const win = getMainWindow();
      cancelledOps.delete(opId);
      const hooks = buildHooks(win, opId);
      const res = await bulkMergeClasses(datasetRoot, classes, fromClassId, toClassId, hooks);
      cancelledOps.delete(opId);
      return res;
    }
  );

  ipcMain.handle(
    BULK_IPC_CHANNELS.bulkRemapClasses,
    async (
      _evt,
      datasetRoot: string,
      classes: string[],
      mapping: Array<{ from: number; to: number }>,
      opId: string
    ): Promise<BulkOpResult> => {
      const win = getMainWindow();
      cancelledOps.delete(opId);
      const hooks = buildHooks(win, opId);
      const res = await bulkRemapClasses(datasetRoot, classes, mapping, hooks);
      cancelledOps.delete(opId);
      return res;
    }
  );

  ipcMain.handle(
    BULK_IPC_CHANNELS.bulkReorderClasses,
    async (
      _evt,
      datasetRoot: string,
      classes: string[],
      fromIndex: number,
      toIndex: number,
      opId: string
    ): Promise<BulkOpResult> => {
      const win = getMainWindow();
      cancelledOps.delete(opId);
      const hooks = buildHooks(win, opId);
      const res = await bulkReorderClasses(datasetRoot, classes, fromIndex, toIndex, hooks);
      cancelledOps.delete(opId);
      return res;
    }
  );

  ipcMain.handle(BULK_IPC_CHANNELS.bulkCancel, async (_evt, opId: string): Promise<void> => {
    if (typeof opId === 'string') cancelledOps.add(opId);
  });

  ipcMain.handle(
    BULK_IPC_CHANNELS.createBackup,
    async (
      _evt,
      datasetRoot: string,
      label: string,
      files: string[]
    ): Promise<CreateBackupResponse> => {
      if (typeof datasetRoot !== 'string' || typeof label !== 'string' || !Array.isArray(files)) {
        return { ok: false, reason: 'Invalid arguments' };
      }
      try {
        const backup = await createBackup(datasetRoot, label, files);
        if (backup.unreadable.length > 0) {
          return {
            ok: false,
            reason: `${backup.unreadable.length} file(s) could not be copied into the backup`
          };
        }
        return { ok: true, backupPath: backup.backupPath };
      } catch (err) {
        return { ok: false, reason: (err as Error).message };
      }
    }
  );

  ipcMain.handle(
    BULK_IPC_CHANNELS.cleanupBackups,
    async (_evt, datasetRoot: string): Promise<void> => {
      if (typeof datasetRoot === 'string' && datasetRoot.length > 0) {
        await cleanupOldBackups(datasetRoot);
      }
    }
  );
}

function buildHooks(win: BrowserWindow | null, opId: string): {
  onPhase: (phase: BulkProgressUpdate['phase']) => void;
  onProgress: (current: number, total: number) => void;
  isCancelled: () => boolean;
} {
  let lastTotal = 0;
  let lastPhase: BulkProgressUpdate['phase'] = 'scanning';
  return {
    onPhase: (phase) => {
      lastPhase = phase;
      emitProgress(win, { opId, phase, current: 0, total: lastTotal });
    },
    onProgress: (current, total) => {
      lastTotal = total;
      emitProgress(win, { opId, phase: lastPhase, current, total });
    },
    isCancelled: () => cancelledOps.has(opId)
  };
}
