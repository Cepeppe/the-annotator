import { ipcMain } from 'electron';
import type {
  LoadRecentDatasetsResult,
  LoadUserSettingsResult,
  SaveUserSettingsResult,
  UserSettings
} from '../../shared/types';
import {
  addRecentDataset,
  loadRecentDatasets,
  removeRecentDataset
} from '../lib/recentDatasets';
import { loadUserSettings, saveUserSettings } from '../lib/userSettings';

export const SETTINGS_IPC_CHANNELS = {
  loadRecentDatasets: 'recent:load',
  addRecentDataset: 'recent:add',
  removeRecentDataset: 'recent:remove',
  loadUserSettings: 'settings:load',
  saveUserSettings: 'settings:save'
} as const;

export function registerSettingsHandlers(onRecentChanged: () => void): void {
  ipcMain.handle(
    SETTINGS_IPC_CHANNELS.loadRecentDatasets,
    async (): Promise<LoadRecentDatasetsResult> => {
      try {
        const datasets = await loadRecentDatasets();
        return { ok: true, datasets };
      } catch (err) {
        return { ok: false, reason: (err as Error).message };
      }
    }
  );

  ipcMain.handle(
    SETTINGS_IPC_CHANNELS.addRecentDataset,
    async (_evt, p: string, name: string): Promise<LoadRecentDatasetsResult> => {
      if (typeof p !== 'string' || typeof name !== 'string' || p.length === 0) {
        return { ok: false, reason: 'Invalid arguments' };
      }
      try {
        const datasets = await addRecentDataset(p, name);
        onRecentChanged();
        return { ok: true, datasets };
      } catch (err) {
        return { ok: false, reason: (err as Error).message };
      }
    }
  );

  ipcMain.handle(
    SETTINGS_IPC_CHANNELS.removeRecentDataset,
    async (_evt, p: string): Promise<LoadRecentDatasetsResult> => {
      if (typeof p !== 'string' || p.length === 0) {
        return { ok: false, reason: 'Invalid path' };
      }
      try {
        const datasets = await removeRecentDataset(p);
        onRecentChanged();
        return { ok: true, datasets };
      } catch (err) {
        return { ok: false, reason: (err as Error).message };
      }
    }
  );

  ipcMain.handle(
    SETTINGS_IPC_CHANNELS.loadUserSettings,
    async (): Promise<LoadUserSettingsResult> => {
      try {
        const settings = await loadUserSettings();
        return { ok: true, settings };
      } catch (err) {
        return { ok: false, reason: (err as Error).message };
      }
    }
  );

  ipcMain.handle(
    SETTINGS_IPC_CHANNELS.saveUserSettings,
    async (_evt, settings: UserSettings): Promise<SaveUserSettingsResult> => {
      if (!settings || typeof settings !== 'object' || typeof settings.username !== 'string') {
        return { ok: false, reason: 'Invalid settings payload' };
      }
      try {
        await saveUserSettings(settings);
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: (err as Error).message };
      }
    }
  );
}
