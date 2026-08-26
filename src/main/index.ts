import { app, BrowserWindow, Menu, ipcMain, shell, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import { registerDatasetHandlers, IPC_CHANNELS } from './ipc/datasetHandlers';
import { registerBulkHandlers } from './ipc/bulkHandlers';
import { registerSettingsHandlers } from './ipc/settingsHandlers';
import { registerDeleteHandlers } from './ipc/deleteHandlers';
import { loadRecentDatasets } from './lib/recentDatasets';
import { loadUserSettings } from './lib/userSettings';
import { getLogger } from './lib/logger';
import { getMainLocale, mt, setLanguagePreference } from './lib/appLocale';
import { isLanguagePreference, LOCALES, type Locale } from '../shared/i18n';
import type { AppTheme, BulkOpMenuKind, RecentDataset } from '../shared/types';

const isDev = !app.isPackaged;

// Single-instance lock: only one instance may run at a time. Double-clicking
// the portable .exe while the app is already open makes the second process
// exit immediately and focuses the first one.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;
let allowClose = false;
let closeTimeoutId: NodeJS.Timeout | null = null;
let recentDatasetsCache: RecentDataset[] = [];
let currentTheme: AppTheme = 'light';

const CLOSE_HANDSHAKE_TIMEOUT_MS = 2000;

/**
 * Hands a URL to the system browser, but only for http(s). Anything else
 * (file:, and the shell handlers Windows registers for custom schemes) is
 * dropped rather than passed to the OS.
 */
function openExternalIfWeb(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
  void shell.openExternal(url);
}

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    backgroundColor: '#f5f5f7',
    title: 'the-annotator',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    // Maximize at boot so the layout does not collapse on small displays.
    // On a 1366x768 laptop with a device pixel ratio >= 1.25 the default
    // 1400x900 does not fit: Windows shrinks the window to roughly 830x760
    // logical pixels, the canvas column drops to ~270px and the image looks
    // off-centre. Order matters: show first, maximize after, because on
    // Windows maximize() on a still-hidden window is not always applied.
    mainWindow?.show();
    mainWindow?.maximize();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalIfWeb(url);
    return { action: 'deny' };
  });

  // Nothing may navigate the window away from the bundled UI. A `target="_blank"`
  // link (the credit strip) goes through the handler above; this covers anything
  // that would replace the page instead, which would leave the app unusable
  // until it is restarted. Reloads are not affected: Electron does not emit
  // will-navigate for window.location.reload(), which is what the error
  // boundary uses.
  mainWindow.webContents.on('will-navigate', (evt, url) => {
    if (url === mainWindow?.webContents.getURL()) return;
    evt.preventDefault();
    openExternalIfWeb(url);
  });

  mainWindow.webContents.on('render-process-gone', (_evt, details) => {
    getLogger().error('renderer_process_gone', {
      reason: details.reason,
      exitCode: details.exitCode
    });
  });

  mainWindow.on('close', (evt) => {
    if (allowClose) return;
    evt.preventDefault();
    mainWindow?.webContents.send('app:close-requested');
    // Fallback: if the renderer does not answer with closeConfirm/closeCancel
    // within the timeout (welcome screen with no handler, crashed renderer,
    // stuck dialog) close anyway, so we never leave a zombie window behind.
    if (closeTimeoutId !== null) clearTimeout(closeTimeoutId);
    closeTimeoutId = setTimeout(() => {
      closeTimeoutId = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        allowClose = true;
        mainWindow.close();
      }
    }, CLOSE_HANDSHAKE_TIMEOUT_MS);
  });

  mainWindow.on('closed', () => {
    if (closeTimeoutId !== null) {
      clearTimeout(closeTimeoutId);
      closeTimeoutId = null;
    }
    mainWindow = null;
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

function sendBulkMenu(kind: BulkOpMenuKind): void {
  mainWindow?.webContents.send('menu:bulk-op', kind);
}

function sendOpenRecent(p: string): void {
  mainWindow?.webContents.send('menu:open-recent', p);
}

function sendOpenSettings(): void {
  mainWindow?.webContents.send('menu:open-settings');
}

function sendShortcutHelp(): void {
  mainWindow?.webContents.send('menu:shortcut-help');
}

function sendAbout(): void {
  mainWindow?.webContents.send('menu:about');
}

function sendThemeChange(theme: AppTheme): void {
  mainWindow?.webContents.send('menu:set-theme', theme);
}

function sendLanguageChange(locale: Locale): void {
  mainWindow?.webContents.send('menu:set-language', locale);
}

function buildRecentSubmenu(): MenuItemConstructorOptions[] {
  if (recentDatasetsCache.length === 0) {
    return [{ label: mt('menu.file.noRecent'), enabled: false }];
  }
  return recentDatasetsCache.map((ds) => ({
    label: `${ds.name}  -  ${ds.path}`,
    click: () => sendOpenRecent(ds.path)
  }));
}

function buildLanguageSubmenu(): MenuItemConstructorOptions[] {
  const active = getMainLocale();
  return LOCALES.map((locale) => ({
    label: mt(locale === 'it' ? 'language.it' : 'language.en'),
    type: 'radio' as const,
    checked: active === locale,
    click: () => sendLanguageChange(locale)
  }));
}

function buildAppMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: mt('menu.file'),
      submenu: [
        {
          label: mt('menu.file.openDataset'),
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow?.webContents.send('menu:open-dataset');
          }
        },
        {
          label: mt('menu.file.openRecent'),
          submenu: buildRecentSubmenu()
        },
        { type: 'separator' },
        {
          label: mt('menu.file.settings'),
          accelerator: 'CmdOrCtrl+,',
          click: () => sendOpenSettings()
        },
        { type: 'separator' },
        {
          label: mt('menu.file.quit'),
          role: 'quit'
        }
      ]
    },
    {
      label: mt('menu.view'),
      submenu: [
        { role: 'reload', label: mt('menu.view.reload') },
        { role: 'toggleDevTools', label: mt('menu.view.devTools') },
        { type: 'separator' },
        { role: 'resetZoom', label: mt('menu.view.actualSize') },
        { role: 'zoomIn', label: mt('menu.view.zoomIn') },
        { role: 'zoomOut', label: mt('menu.view.zoomOut') },
        { type: 'separator' },
        {
          label: mt('menu.view.lightTheme'),
          type: 'radio',
          checked: currentTheme === 'light',
          click: () => {
            currentTheme = 'light';
            sendThemeChange('light');
          }
        },
        {
          label: mt('menu.view.darkTheme'),
          type: 'radio',
          checked: currentTheme === 'dark',
          click: () => {
            currentTheme = 'dark';
            sendThemeChange('dark');
          }
        },
        { type: 'separator' },
        {
          label: mt('menu.view.language'),
          submenu: buildLanguageSubmenu()
        },
        { type: 'separator' },
        { role: 'togglefullscreen', label: mt('menu.view.fullScreen') }
      ]
    },
    {
      label: mt('menu.tools'),
      submenu: [
        {
          label: mt('menu.tools.bulk'),
          submenu: [
            {
              label: mt('menu.tools.bulk.delete'),
              click: () => sendBulkMenu('delete')
            },
            {
              label: mt('menu.tools.bulk.rename'),
              click: () => sendBulkMenu('rename')
            },
            {
              label: mt('menu.tools.bulk.merge'),
              click: () => sendBulkMenu('merge')
            },
            {
              label: mt('menu.tools.bulk.remap'),
              click: () => sendBulkMenu('remap')
            }
          ]
        },
        { type: 'separator' },
        {
          label: mt('menu.tools.recomputeStats'),
          click: () => sendBulkMenu('recompute')
        }
      ]
    },
    {
      label: mt('menu.help'),
      submenu: [
        {
          label: mt('menu.help.shortcuts'),
          accelerator: 'F1',
          click: () => sendShortcutHelp()
        },
        { type: 'separator' },
        {
          label: mt('menu.help.about'),
          click: () => sendAbout()
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function refreshRecentDatasets(): Promise<void> {
  try {
    recentDatasetsCache = await loadRecentDatasets();
  } catch {
    recentDatasetsCache = [];
  }
  buildAppMenu();
}

function registerCloseHandshake(): void {
  ipcMain.handle(IPC_CHANNELS.closeConfirm, () => {
    if (closeTimeoutId !== null) {
      clearTimeout(closeTimeoutId);
      closeTimeoutId = null;
    }
    allowClose = true;
    mainWindow?.close();
  });
  ipcMain.handle(IPC_CHANNELS.closeCancel, () => {
    if (closeTimeoutId !== null) {
      clearTimeout(closeTimeoutId);
      closeTimeoutId = null;
    }
    allowClose = false;
  });
}

app.whenReady().then(async () => {
  registerDatasetHandlers(getMainWindow);
  registerBulkHandlers(getMainWindow);
  registerSettingsHandlers(() => {
    void refreshRecentDatasets();
  });
  registerDeleteHandlers();
  registerCloseHandshake();

  // Load theme and language before building the menu, so the radio items are
  // already checked correctly and the labels are in the right language.
  try {
    const settings = await loadUserSettings();
    currentTheme = settings.theme;
    setLanguagePreference(settings.language, app.getLocale());
  } catch {
    currentTheme = 'light';
    setLanguagePreference(undefined, app.getLocale());
  }

  await refreshRecentDatasets();

  // Boot log, after the handlers and the menu are ready but before the window.
  getLogger().info('app_boot', {
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions['electron'],
    chromium: process.versions['chrome'],
    node: process.versions['node']
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// A second launch (double-click on the portable .exe while the app is already
// running) focuses the existing window instead of spawning a zombie one.
// Works together with requestSingleInstanceLock().
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Keeps the View > Theme radio in sync with the theme chosen in Settings, so
// the menu shows the right selection after the renderer changes it.
ipcMain.handle('menu:syncTheme', (_evt, theme: AppTheme): void => {
  if (theme === 'light' || theme === 'dark') {
    currentTheme = theme;
    buildAppMenu();
  }
});

// Same for the language: the renderer owns the setting, the main process
// rebuilds the native menu and re-binds its own translator.
ipcMain.handle('menu:syncLanguage', (_evt, preference: unknown): void => {
  if (!isLanguagePreference(preference)) return;
  setLanguagePreference(preference, app.getLocale());
  buildAppMenu();
});
