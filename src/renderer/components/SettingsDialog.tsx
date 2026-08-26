import { useEffect, useState } from 'react';
import type { AppTheme, UserSettings } from '@shared/types';
import type { LanguagePreference, TranslationKey } from '@shared/i18n';
import { useApi } from '../hooks/useApi';
import { useT } from '../i18n';

interface SettingsDialogProps {
  initial: UserSettings;
  onSave: (settings: UserSettings) => Promise<void> | void;
  onCancel: () => void;
}

type Section = 'general' | 'appearance' | 'model' | 'advanced';

const SECTIONS: Array<{ id: Section; labelKey: TranslationKey }> = [
  { id: 'general', labelKey: 'settings.section.general' },
  { id: 'appearance', labelKey: 'settings.section.appearance' },
  { id: 'model', labelKey: 'settings.section.model' },
  { id: 'advanced', labelKey: 'settings.section.advanced' }
];

const LANGUAGE_OPTIONS: Array<{ value: LanguagePreference; labelKey: TranslationKey }> = [
  { value: 'system', labelKey: 'language.system' },
  { value: 'en', labelKey: 'language.en' },
  { value: 'it', labelKey: 'language.it' }
];

export function SettingsDialog({ initial, onSave, onCancel }: SettingsDialogProps): JSX.Element {
  const api = useApi();
  const t = useT();
  const [section, setSection] = useState<Section>('general');
  const [username, setUsername] = useState(initial.username);
  const [theme, setTheme] = useState<AppTheme>(initial.theme);
  const [language, setLanguage] = useState<LanguagePreference>(initial.language);
  const [modelPath, setModelPath] = useState<string>(initial.modelPath ?? '');
  const [busy, setBusy] = useState(false);
  const [openLogsBusy, setOpenLogsBusy] = useState(false);
  const [openLogsError, setOpenLogsError] = useState<string | null>(null);

  const trimmedUsername = username.trim();
  const canSubmit = trimmedUsername.length > 0 && !busy;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onSave({
        ...initial,
        username: trimmedUsername,
        theme,
        language,
        modelPath: modelPath.trim().length > 0 ? modelPath.trim() : null
      });
    } finally {
      setBusy(false);
    }
  };

  const openLogs = async (): Promise<void> => {
    setOpenLogsBusy(true);
    setOpenLogsError(null);
    try {
      const res = await api.openLogsFolder();
      if (!res.ok) {
        setOpenLogsError(res.reason ?? t('settings.logs.error'));
      }
    } finally {
      setOpenLogsBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="max-w-2xl w-full mx-6 rounded-lg bg-app-surface shadow-xl border border-app-border flex flex-col max-h-[85vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-app-border">
          <h2 id="settings-dialog-title" className="text-lg font-semibold text-app-text">
            {t('settings.title')}
          </h2>
        </div>
        <div className="flex flex-1 min-h-0">
          <nav
            className="flex-none w-40 border-r border-app-border py-3"
            aria-label={t('settings.sections')}
          >
            <ul className="flex flex-col">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSection(s.id)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-app-bg ${
                      section === s.id
                        ? 'bg-app-row-current text-app-text font-medium'
                        : 'text-app-text-muted'
                    }`}
                    aria-current={section === s.id ? 'page' : undefined}
                  >
                    {t(s.labelKey)}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex-1 px-6 py-5 overflow-auto text-sm text-app-text">
            {section === 'general' && (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-app-text-muted">{t('settings.username')}</span>
                  <input
                    autoFocus
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void submit();
                      }
                    }}
                    placeholder={t('settings.username.placeholder')}
                    className="border border-app-border rounded-md px-3 py-2 bg-app-surface"
                  />
                  <span className="text-[11px] text-app-text-muted">
                    {t('settings.username.hint')}
                  </span>
                </label>
              </div>
            )}
            {section === 'appearance' && (
              <div className="flex flex-col gap-6">
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-xs text-app-text-muted">{t('settings.theme')}</legend>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="theme"
                      checked={theme === 'light'}
                      onChange={() => setTheme('light')}
                    />
                    <span>{t('settings.theme.light')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="theme"
                      checked={theme === 'dark'}
                      onChange={() => setTheme('dark')}
                    />
                    <span>{t('settings.theme.dark')}</span>
                  </label>
                  <span className="text-[11px] text-app-text-muted">
                    {t('settings.theme.hint')}
                  </span>
                </fieldset>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-app-text-muted">{t('settings.language')}</span>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as LanguagePreference)}
                    className="border border-app-border rounded-md px-3 py-2 bg-app-surface"
                  >
                    {LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-app-text-muted">
                    {t('settings.language.hint')}
                  </span>
                </label>
              </div>
            )}
            {section === 'model' && (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-app-text-muted">{t('settings.modelPath')}</span>
                  <input
                    type="text"
                    value={modelPath}
                    onChange={(e) => setModelPath(e.target.value)}
                    placeholder={t('settings.modelPath.placeholder')}
                    className="border border-app-border rounded-md px-3 py-2 bg-app-surface font-mono text-xs"
                  />
                  <span className="text-[11px] text-app-text-muted">
                    {t('settings.modelPath.hint')}
                  </span>
                </label>
              </div>
            )}
            {section === 'advanced' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-app-text-muted">{t('settings.logs')}</span>
                  <button
                    type="button"
                    disabled={openLogsBusy}
                    onClick={() => {
                      void openLogs();
                    }}
                    className="self-start px-4 py-2 text-sm rounded-md border border-app-border bg-app-surface hover:bg-app-bg disabled:opacity-40"
                  >
                    {t('settings.logs.open')}
                  </button>
                  {openLogsError && (
                    <span className="text-xs text-red-600">{openLogsError}</span>
                  )}
                  <span className="text-[11px] text-app-text-muted">
                    {t('settings.logs.hint')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-app-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md border border-app-border bg-app-surface hover:bg-app-bg"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              void submit();
            }}
            className="px-4 py-2 text-sm rounded-md bg-app-accent text-white hover:brightness-110 disabled:opacity-40"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
