import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { LanguagePreference, Locale } from '../shared/i18n';
import type {
  AppInfo,
  AppTheme,
  BBoxYolo,
  BulkOpMenuKind,
  BulkOpResult,
  BulkProgressUpdate,
  CleanupResult,
  CreateBackupResponse,
  CreateEmptyDataYamlResult,
  DeleteBulkResult,
  DeleteImageResult,
  ImageDataUrlResult,
  LoadAnnotationsResult,
  LoadProgressFileResult,
  LoadRecentDatasetsResult,
  LoadUserSettingsResult,
  OpenDatasetResult,
  OpenFolderResult,
  ProgressFile,
  SaveAnnotationsResult,
  SaveDataYamlResult,
  SaveProgressFileResult,
  SaveUserSettingsResult,
  ScanDatasetStatsResult,
  ThumbnailResult,
  UserSettings
} from '../shared/types';

const CHANNELS = {
  openDatasetDialog: 'dataset:openDialog',
  openDatasetByPath: 'dataset:openByPath',
  createEmptyDataYaml: 'dataset:createEmptyDataYaml',
  loadAnnotations: 'dataset:loadAnnotations',
  saveAnnotations: 'dataset:saveAnnotations',
  getThumbnail: 'dataset:getThumbnail',
  getImageDataUrl: 'dataset:getImageDataUrl',
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
  closeConfirm: 'app:closeConfirm',
  closeCancel: 'app:closeCancel',
  loadRecentDatasets: 'recent:load',
  addRecentDataset: 'recent:add',
  removeRecentDataset: 'recent:remove',
  loadUserSettings: 'settings:load',
  saveUserSettings: 'settings:save',
  deleteImage: 'image:delete',
  deleteImagesBulk: 'image:deleteBulk',
  cleanupTrash: 'trash:cleanup',
  openFolder: 'app:openFolder',
  openLogsFolder: 'app:openLogsFolder',
  logEvent: 'app:logEvent',
  appInfo: 'app:info',
  syncTheme: 'menu:syncTheme',
  syncLanguage: 'menu:syncLanguage'
} as const;

export const api = {
  openDatasetDialog(): Promise<OpenDatasetResult> {
    return ipcRenderer.invoke(CHANNELS.openDatasetDialog);
  },
  openDatasetByPath(root: string): Promise<OpenDatasetResult> {
    return ipcRenderer.invoke(CHANNELS.openDatasetByPath, root);
  },
  createEmptyDataYaml(root: string): Promise<CreateEmptyDataYamlResult> {
    return ipcRenderer.invoke(CHANNELS.createEmptyDataYaml, root);
  },
  loadAnnotations(root: string, imageFilename: string): Promise<LoadAnnotationsResult> {
    return ipcRenderer.invoke(CHANNELS.loadAnnotations, root, imageFilename);
  },
  saveAnnotations(
    root: string,
    imageFilename: string,
    bboxes: BBoxYolo[]
  ): Promise<SaveAnnotationsResult> {
    return ipcRenderer.invoke(CHANNELS.saveAnnotations, root, imageFilename, bboxes);
  },
  getThumbnail(root: string, imageFilename: string): Promise<ThumbnailResult> {
    return ipcRenderer.invoke(CHANNELS.getThumbnail, root, imageFilename);
  },
  getImageDataUrl(root: string, imageFilename: string): Promise<ImageDataUrlResult> {
    return ipcRenderer.invoke(CHANNELS.getImageDataUrl, root, imageFilename);
  },
  loadProgressFile(root: string): Promise<LoadProgressFileResult> {
    return ipcRenderer.invoke(CHANNELS.loadProgressFile, root);
  },
  saveProgressFile(root: string, content: ProgressFile): Promise<SaveProgressFileResult> {
    return ipcRenderer.invoke(CHANNELS.saveProgressFile, root, content);
  },
  saveDataYaml(root: string, names: string[]): Promise<SaveDataYamlResult> {
    return ipcRenderer.invoke(CHANNELS.saveDataYaml, root, names);
  },
  scanDatasetStats(root: string, classes: string[]): Promise<ScanDatasetStatsResult> {
    return ipcRenderer.invoke(CHANNELS.scanDatasetStats, root, classes);
  },
  bulkDeleteClassAnnotations(
    root: string,
    classes: string[],
    classId: number,
    opId: string
  ): Promise<BulkOpResult> {
    return ipcRenderer.invoke(CHANNELS.bulkDeleteClass, root, classes, classId, opId);
  },
  bulkMergeClasses(
    root: string,
    classes: string[],
    fromClassId: number,
    toClassId: number,
    opId: string
  ): Promise<BulkOpResult> {
    return ipcRenderer.invoke(
      CHANNELS.bulkMergeClasses,
      root,
      classes,
      fromClassId,
      toClassId,
      opId
    );
  },
  bulkRemapClasses(
    root: string,
    classes: string[],
    mapping: Array<{ from: number; to: number }>,
    opId: string
  ): Promise<BulkOpResult> {
    return ipcRenderer.invoke(CHANNELS.bulkRemapClasses, root, classes, mapping, opId);
  },
  bulkReorderClasses(
    root: string,
    classes: string[],
    fromIndex: number,
    toIndex: number,
    opId: string
  ): Promise<BulkOpResult> {
    return ipcRenderer.invoke(CHANNELS.bulkReorderClasses, root, classes, fromIndex, toIndex, opId);
  },
  bulkCancel(opId: string): Promise<void> {
    return ipcRenderer.invoke(CHANNELS.bulkCancel, opId);
  },
  createBackup(root: string, label: string, files: string[]): Promise<CreateBackupResponse> {
    return ipcRenderer.invoke(CHANNELS.createBackup, root, label, files);
  },
  cleanupBackups(root: string): Promise<void> {
    return ipcRenderer.invoke(CHANNELS.cleanupBackups, root);
  },
  onBulkProgress(handler: (update: BulkProgressUpdate) => void): () => void {
    const listener = (_evt: IpcRendererEvent, update: BulkProgressUpdate): void => handler(update);
    ipcRenderer.on('bulk:progress', listener);
    return () => ipcRenderer.removeListener('bulk:progress', listener);
  },
  onMenuOpenDataset(handler: () => void): () => void {
    const listener = (): void => handler();
    ipcRenderer.on('menu:open-dataset', listener);
    return () => ipcRenderer.removeListener('menu:open-dataset', listener);
  },
  onMenuBulkOp(handler: (kind: BulkOpMenuKind) => void): () => void {
    const listener = (_evt: IpcRendererEvent, kind: BulkOpMenuKind): void => handler(kind);
    ipcRenderer.on('menu:bulk-op', listener);
    return () => ipcRenderer.removeListener('menu:bulk-op', listener);
  },
  onCloseRequested(handler: () => void): () => void {
    const listener = (): void => handler();
    ipcRenderer.on('app:close-requested', listener);
    return () => ipcRenderer.removeListener('app:close-requested', listener);
  },
  confirmClose(): Promise<void> {
    return ipcRenderer.invoke(CHANNELS.closeConfirm);
  },
  cancelClose(): Promise<void> {
    return ipcRenderer.invoke(CHANNELS.closeCancel);
  },
  loadRecentDatasets(): Promise<LoadRecentDatasetsResult> {
    return ipcRenderer.invoke(CHANNELS.loadRecentDatasets);
  },
  addRecentDataset(p: string, name: string): Promise<LoadRecentDatasetsResult> {
    return ipcRenderer.invoke(CHANNELS.addRecentDataset, p, name);
  },
  removeRecentDataset(p: string): Promise<LoadRecentDatasetsResult> {
    return ipcRenderer.invoke(CHANNELS.removeRecentDataset, p);
  },
  loadUserSettings(): Promise<LoadUserSettingsResult> {
    return ipcRenderer.invoke(CHANNELS.loadUserSettings);
  },
  saveUserSettings(settings: UserSettings): Promise<SaveUserSettingsResult> {
    return ipcRenderer.invoke(CHANNELS.saveUserSettings, settings);
  },
  onMenuOpenRecent(handler: (path: string) => void): () => void {
    const listener = (_evt: IpcRendererEvent, p: string): void => handler(p);
    ipcRenderer.on('menu:open-recent', listener);
    return () => ipcRenderer.removeListener('menu:open-recent', listener);
  },
  onMenuOpenSettings(handler: () => void): () => void {
    const listener = (): void => handler();
    ipcRenderer.on('menu:open-settings', listener);
    return () => ipcRenderer.removeListener('menu:open-settings', listener);
  },
  deleteImage(root: string, imageFilename: string): Promise<DeleteImageResult> {
    return ipcRenderer.invoke(CHANNELS.deleteImage, root, imageFilename);
  },
  deleteImagesBulk(root: string, imageFilenames: string[]): Promise<DeleteBulkResult> {
    return ipcRenderer.invoke(CHANNELS.deleteImagesBulk, root, imageFilenames);
  },
  cleanupOldTrashAndBackups(root: string, ttlDays: number): Promise<CleanupResult> {
    return ipcRenderer.invoke(CHANNELS.cleanupTrash, root, ttlDays);
  },
  openFolder(folderPath: string): Promise<OpenFolderResult> {
    return ipcRenderer.invoke(CHANNELS.openFolder, folderPath);
  },
  openLogsFolder(): Promise<OpenFolderResult> {
    return ipcRenderer.invoke(CHANNELS.openLogsFolder);
  },
  logEvent(
    level: 'info' | 'warn' | 'error',
    event: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    return ipcRenderer.invoke(CHANNELS.logEvent, level, event, data);
  },
  getAppInfo(): Promise<AppInfo> {
    return ipcRenderer.invoke(CHANNELS.appInfo);
  },
  syncTheme(theme: AppTheme): Promise<void> {
    return ipcRenderer.invoke(CHANNELS.syncTheme, theme);
  },
  syncLanguage(preference: LanguagePreference): Promise<void> {
    return ipcRenderer.invoke(CHANNELS.syncLanguage, preference);
  },
  onMenuShortcutHelp(handler: () => void): () => void {
    const listener = (): void => handler();
    ipcRenderer.on('menu:shortcut-help', listener);
    return () => ipcRenderer.removeListener('menu:shortcut-help', listener);
  },
  onMenuAbout(handler: () => void): () => void {
    const listener = (): void => handler();
    ipcRenderer.on('menu:about', listener);
    return () => ipcRenderer.removeListener('menu:about', listener);
  },
  onMenuSetTheme(handler: (theme: AppTheme) => void): () => void {
    const listener = (_evt: IpcRendererEvent, theme: AppTheme): void => handler(theme);
    ipcRenderer.on('menu:set-theme', listener);
    return () => ipcRenderer.removeListener('menu:set-theme', listener);
  },
  onMenuSetLanguage(handler: (locale: Locale) => void): () => void {
    const listener = (_evt: IpcRendererEvent, locale: Locale): void => handler(locale);
    ipcRenderer.on('menu:set-language', listener);
    return () => ipcRenderer.removeListener('menu:set-language', listener);
  }
};

/** Shape of `window.api`, the only surface the renderer can reach the main process through. */
export type CustomLabelerApi = typeof api;

contextBridge.exposeInMainWorld('api', api);
