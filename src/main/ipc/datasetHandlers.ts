import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ipcMain, dialog, type BrowserWindow } from 'electron';
import type {
  BBoxYolo,
  CreateEmptyDataYamlResult,
  ImageDataUrlResult,
  LoadAnnotationsResult,
  OpenDatasetResult,
  SaveAnnotationsResult,
  ThumbnailResult
} from '../../shared/types';
import { parseYoloTxt } from '../../shared/yoloParser';
import {
  createEmptyDataYaml,
  labelFilenameForImage,
  scanDataset
} from '../lib/datasetScanner';
import { getImageAsDataUrl, getOrCreateThumbnail } from '../lib/thumbnailCache';
import { saveAnnotations } from '../lib/saveAnnotations';
import { mt } from '../lib/appLocale';

// Argument-validation messages below stay in English on purpose: they can only
// be reached by a programming error in the preload bridge, never by the user.

export const IPC_CHANNELS = {
  openDatasetDialog: 'dataset:openDialog',
  openDatasetByPath: 'dataset:openByPath',
  createEmptyDataYaml: 'dataset:createEmptyDataYaml',
  loadAnnotations: 'dataset:loadAnnotations',
  saveAnnotations: 'dataset:saveAnnotations',
  getThumbnail: 'dataset:getThumbnail',
  getImageDataUrl: 'dataset:getImageDataUrl',
  closeConfirm: 'app:closeConfirm',
  closeCancel: 'app:closeCancel'
} as const;

export function registerDatasetHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC_CHANNELS.openDatasetDialog, async (): Promise<OpenDatasetResult> => {
    const win = getMainWindow();
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: mt('nativeDialog.selectDatasetFolder'),
          properties: ['openDirectory']
        })
      : await dialog.showOpenDialog({
          title: mt('nativeDialog.selectDatasetFolder'),
          properties: ['openDirectory']
        });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, reason: 'cancelled' };
    }
    const root = result.filePaths[0];
    if (!root) return { ok: false, reason: 'cancelled' };
    return scanDataset(root);
  });

  ipcMain.handle(
    IPC_CHANNELS.openDatasetByPath,
    async (_evt, root: string): Promise<OpenDatasetResult> => {
      if (typeof root !== 'string' || root.length === 0) {
        return { ok: false, reason: 'io_error', details: 'Invalid path' };
      }
      return scanDataset(root);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.createEmptyDataYaml,
    async (_evt, root: string): Promise<CreateEmptyDataYamlResult> => {
      if (typeof root !== 'string' || root.length === 0) {
        return { ok: false, reason: 'Invalid path' };
      }
      try {
        await createEmptyDataYaml(root);
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: (err as Error).message };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.loadAnnotations,
    async (_evt, root: string, imageFilename: string): Promise<LoadAnnotationsResult> => {
      if (typeof root !== 'string' || typeof imageFilename !== 'string') {
        return { ok: false, reason: 'io_error', details: 'Invalid arguments' };
      }
      const labelPath = path.join(root, 'labels', labelFilenameForImage(imageFilename));
      let content: string;
      try {
        content = await fs.readFile(labelPath, 'utf8');
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
          return { ok: true, bboxes: [], warnings: [] };
        }
        return { ok: false, reason: 'io_error', details: (err as Error).message };
      }
      try {
        const parsed = parseYoloTxt(content);
        return { ok: true, bboxes: parsed.bboxes, warnings: parsed.warnings };
      } catch (err) {
        return { ok: false, reason: 'parse_error', details: (err as Error).message };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.saveAnnotations,
    async (
      _evt,
      root: string,
      imageFilename: string,
      bboxes: BBoxYolo[]
    ): Promise<SaveAnnotationsResult> => {
      if (
        typeof root !== 'string' ||
        typeof imageFilename !== 'string' ||
        !Array.isArray(bboxes)
      ) {
        return { ok: false, reason: 'io_error', details: 'Invalid arguments' };
      }
      return saveAnnotations(root, imageFilename, bboxes);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.getThumbnail,
    async (_evt, root: string, imageFilename: string): Promise<ThumbnailResult> => {
      if (typeof root !== 'string' || typeof imageFilename !== 'string') {
        return { ok: false, reason: 'Invalid arguments' };
      }
      return getOrCreateThumbnail(root, imageFilename);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.getImageDataUrl,
    async (_evt, root: string, imageFilename: string): Promise<ImageDataUrlResult> => {
      if (typeof root !== 'string' || typeof imageFilename !== 'string') {
        return { ok: false, reason: 'Invalid arguments' };
      }
      return getImageAsDataUrl(root, imageFilename);
    }
  );
}
