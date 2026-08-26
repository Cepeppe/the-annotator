import { useCallback, useEffect, useState } from 'react';
import { DatasetProvider, useDataset } from './state/datasetStore';
import { useApi } from './hooks/useApi';
import { WelcomeScreen } from './components/WelcomeScreen';
import { AppLayout } from './components/AppLayout';
import { Dialog } from './components/Dialog';
import { SettingsDialog } from './components/SettingsDialog';
import { ShortcutHelpModal } from './components/ShortcutHelpModal';
import { AboutDialog } from './components/AboutDialog';
import { ErrorBoundary } from './components/ErrorBoundary';
import { applyTheme } from './lib/themeManager';
import { I18nProvider, setLocale, useT } from './i18n';
import { resolveLocale, type Locale } from '@shared/i18n';
import type {
  AppTheme,
  OpenDatasetResult,
  RecentDataset,
  UserSettings
} from '@shared/types';

function basename(p: string): string {
  const normalized = p.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1]! : p;
}

/** Applies a stored language preference to the renderer and to the native menu. */
function applyLanguage(settings: UserSettings, syncMenu: (pref: UserSettings['language']) => void): void {
  setLocale(resolveLocale(settings.language, navigator.language));
  syncMenu(settings.language);
}

function DatasetFlow(): JSX.Element {
  const { state, dispatch } = useDataset();
  const api = useApi();
  const t = useT();
  const [errorDialog, setErrorDialog] = useState<{
    title: string;
    message: string;
    canCreateEmpty?: { root: string };
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [recentDatasets, setRecentDatasets] = useState<RecentDataset[]>([]);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [welcomeSettings, setWelcomeSettings] = useState<UserSettings | null>(null);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Load recents and settings at boot. Theme and language are applied right
  // away so the window never flashes with the wrong ones.
  useEffect(() => {
    void (async () => {
      const r = await api.loadRecentDatasets();
      if (r.ok) setRecentDatasets(r.datasets);
      const s = await api.loadUserSettings();
      if (s.ok) {
        setWelcomeSettings(s.settings);
        applyTheme(s.settings.theme);
        void api.syncTheme(s.settings.theme);
        applyLanguage(s.settings, (pref) => {
          void api.syncLanguage(pref);
        });
      }
    })();
  }, [api]);

  const handleResult = useCallback(
    async (result: OpenDatasetResult, sourcePath?: string) => {
      if (result.ok) {
        dispatch({
          type: 'OPEN_DATASET',
          root: result.root,
          classes: result.classes,
          images: result.images
        });
        const name = basename(result.root);
        const r = await api.addRecentDataset(result.root, name);
        if (r.ok) setRecentDatasets(r.datasets);
        void api.logEvent('info', 'dataset_opened', {
          path: result.root,
          classes_count: result.classes.length,
          images_count: result.images.length
        });
        // The scanner auto-fixes orphan files when opening a dataset: orphan
        // .txt files go to the trash and empty ones are created for images
        // that had none. Always logged for auditing, but only surfaced to the
        // annotator when something meaningful actually happened.
        const cleanup = result.orphanCleanup;
        if (cleanup && (cleanup.removedOrphanTxt > 0 || cleanup.createdEmptyTxt > 0)) {
          void api.logEvent('info', 'orphan_cleanup', {
            path: result.root,
            removed_orphan_txt: cleanup.removedOrphanTxt,
            created_empty_txt: cleanup.createdEmptyTxt,
            trash_path: cleanup.trashPath
          });
          if (cleanup.removedOrphanTxt > 0) {
            const extra =
              cleanup.createdEmptyTxt > 0
                ? ` ${t('orphanCleanup.createdEmpty', { count: cleanup.createdEmptyTxt })}`
                : '';
            setNotice(
              `${t('orphanCleanup.removedOrphans', { count: cleanup.removedOrphanTxt })}${extra}`
            );
          } else if (cleanup.createdEmptyTxt > 0) {
            setNotice(t('orphanCleanup.createdEmptyOnly', { count: cleanup.createdEmptyTxt }));
          }
        }
        return;
      }
      if (result.reason === 'cancelled') return;

      if (result.reason === 'invalid_structure') {
        const missingLabel = {
          missing_data_yaml: t('openError.missing.dataYaml'),
          missing_images_dir: t('openError.missing.imagesDir'),
          missing_labels_dir: t('openError.missing.labelsDir')
        }[result.missing];
        setErrorDialog({
          title: t('openError.invalidStructure.title'),
          message: t('openError.invalidStructure.message', { missing: missingLabel }),
          canCreateEmpty:
            result.missing === 'missing_data_yaml'
              ? { root: result.attemptedRoot }
              : undefined
        });
        return;
      }

      if (result.reason === 'yaml_parse_error') {
        setErrorDialog({
          title: t('openError.yaml.title'),
          message: result.details
        });
        return;
      }

      if (sourcePath) {
        const r = await api.removeRecentDataset(sourcePath);
        if (r.ok) setRecentDatasets(r.datasets);
        setErrorDialog({
          title: t('openError.folderMissing.title'),
          message: t('openError.folderMissing.message', { path: sourcePath })
        });
        return;
      }

      setErrorDialog({
        title: t('openError.io.title'),
        message: result.details
      });
    },
    [dispatch, api, t]
  );

  const openDatasetDialog = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api.openDatasetDialog();
      await handleResult(result);
    } finally {
      setBusy(false);
    }
  }, [api, busy, handleResult]);

  const openRecentDataset = useCallback(
    async (p: string) => {
      if (busy) return;
      setBusy(true);
      try {
        const result = await api.openDatasetByPath(p);
        await handleResult(result, p);
      } finally {
        setBusy(false);
      }
    },
    [api, busy, handleResult]
  );

  const createEmptyYamlAndRetry = useCallback(
    async (root: string) => {
      setErrorDialog(null);
      setBusy(true);
      try {
        const created = await api.createEmptyDataYaml(root);
        if (!created.ok) {
          setErrorDialog({
            title: t('openError.createYamlFailed.title'),
            message: created.reason
          });
          return;
        }
        const result = await api.openDatasetByPath(root);
        await handleResult(result);
      } finally {
        setBusy(false);
      }
    },
    [api, handleResult, t]
  );

  // ---- Menu listeners
  useEffect(() => {
    return api.onMenuOpenDataset(() => {
      void openDatasetDialog();
    });
  }, [api, openDatasetDialog]);

  useEffect(() => {
    return api.onMenuOpenRecent((p) => {
      void openRecentDataset(p);
    });
  }, [api, openRecentDataset]);

  useEffect(() => {
    return api.onMenuOpenSettings(() => {
      setSettingsDialogOpen(true);
    });
  }, [api]);

  useEffect(() => {
    return api.onMenuShortcutHelp(() => {
      setShortcutHelpOpen(true);
    });
  }, [api]);

  useEffect(() => {
    return api.onMenuAbout(() => {
      setAboutOpen(true);
    });
  }, [api]);

  // View > Light/Dark theme: apply immediately and persist, so the next launch
  // is consistent with what the menu just did.
  useEffect(() => {
    return api.onMenuSetTheme((theme: AppTheme) => {
      applyTheme(theme);
      const update = async (): Promise<void> => {
        const cur = await api.loadUserSettings();
        if (!cur.ok) return;
        const settings: UserSettings = { ...cur.settings, theme };
        await api.saveUserSettings(settings);
        setWelcomeSettings(settings);
        if (state.phase === 'loaded') {
          dispatch({ type: 'SET_USER_SETTINGS', settings });
        }
      };
      void update();
    });
  }, [api, dispatch, state]);

  // View > Language: same flow as the theme. The menu sends a concrete locale,
  // which also pins the preference away from "system".
  useEffect(() => {
    return api.onMenuSetLanguage((locale: Locale) => {
      setLocale(locale);
      const update = async (): Promise<void> => {
        const cur = await api.loadUserSettings();
        if (!cur.ok) return;
        const settings: UserSettings = { ...cur.settings, language: locale };
        await api.saveUserSettings(settings);
        void api.syncLanguage(locale);
        setWelcomeSettings(settings);
        if (state.phase === 'loaded') {
          dispatch({ type: 'SET_USER_SETTINGS', settings });
        }
      };
      void update();
    });
  }, [api, dispatch, state]);

  const closeSettingsDialog = useCallback(() => setSettingsDialogOpen(false), []);

  const handleWelcomeSaveSettings = useCallback(
    async (settings: UserSettings): Promise<void> => {
      const res = await api.saveUserSettings(settings);
      if (!res.ok) {
        setErrorDialog({
          title: t('openError.saveSettingsFailed.title'),
          message: res.reason
        });
        return;
      }
      setWelcomeSettings(settings);
      applyTheme(settings.theme);
      void api.syncTheme(settings.theme);
      applyLanguage(settings, (pref) => {
        void api.syncLanguage(pref);
      });
      closeSettingsDialog();
    },
    [api, closeSettingsDialog, t]
  );

  const showWelcomeSettings =
    settingsDialogOpen && state.phase !== 'loaded' && welcomeSettings !== null;

  return (
    <>
      {state.phase === 'welcome' ? (
        <WelcomeScreen
          onOpenDataset={openDatasetDialog}
          recentDatasets={recentDatasets}
          onOpenRecent={(p) => {
            void openRecentDataset(p);
          }}
          busy={busy}
        />
      ) : (
        <AppLayout
          onOpenDataset={openDatasetDialog}
          settingsDialogOpen={settingsDialogOpen}
          onCloseSettingsDialog={closeSettingsDialog}
          onShowShortcutHelp={() => setShortcutHelpOpen(true)}
        />
      )}
      {showWelcomeSettings && welcomeSettings && (
        <SettingsDialog
          initial={welcomeSettings}
          onSave={handleWelcomeSaveSettings}
          onCancel={closeSettingsDialog}
        />
      )}
      {shortcutHelpOpen && (
        <ShortcutHelpModal onClose={() => setShortcutHelpOpen(false)} />
      )}
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      {errorDialog && (
        <Dialog
          title={errorDialog.title}
          message={errorDialog.message}
          primaryLabel={
            errorDialog.canCreateEmpty ? t('openError.createEmptyYaml') : t('common.ok')
          }
          secondaryLabel={errorDialog.canCreateEmpty ? t('common.cancel') : undefined}
          onPrimary={() => {
            if (errorDialog.canCreateEmpty) {
              void createEmptyYamlAndRetry(errorDialog.canCreateEmpty.root);
            } else {
              setErrorDialog(null);
            }
          }}
          onSecondary={() => setErrorDialog(null)}
          onClose={() => setErrorDialog(null)}
        />
      )}
      {notice && (
        <Dialog
          title={t('orphanCleanup.title')}
          message={notice}
          primaryLabel={t('common.ok')}
          onPrimary={() => setNotice(null)}
          onClose={() => setNotice(null)}
        />
      )}
    </>
  );
}

export function App(): JSX.Element {
  return (
    <I18nProvider>
      <ErrorBoundary>
        <DatasetProvider>
          <DatasetFlow />
        </DatasetProvider>
      </ErrorBoundary>
    </I18nProvider>
  );
}
