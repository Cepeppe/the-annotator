import { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import type { AppInfo } from '@shared/types';
import { useT } from '../i18n';

interface AboutDialogProps {
  onClose: () => void;
}

const UNKNOWN = '-';

export function AboutDialog({ onClose }: AboutDialogProps): JSX.Element {
  const api = useApi();
  const t = useT();
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    void api.getAppInfo().then(setInfo);
  }, [api]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-w-md w-full mx-6 rounded-lg bg-app-surface shadow-xl border border-app-border"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-dialog-title"
      >
        <div className="px-6 py-4 border-b border-app-border">
          <h2 id="about-dialog-title" className="text-lg font-semibold text-app-text">
            {t('about.title')}
          </h2>
        </div>
        <div className="px-6 py-5 text-sm text-app-text flex flex-col gap-3">
          <div>
            <strong>the-annotator</strong> {t('about.description')}
          </div>
          <div className="text-xs text-app-text-muted">
            {t('about.version', { version: info?.version ?? UNKNOWN })}
            {info?.platform ? `  •  ${info.platform}` : ''}
          </div>
          <div className="text-xs text-app-text-muted">
            {t('about.runtime', {
              electron: info?.electronVersion ?? UNKNOWN,
              chromium: info?.chromiumVersion ?? UNKNOWN,
              node: info?.nodeVersion ?? UNKNOWN
            })}
          </div>

          <hr className="border-app-border my-1" />

          <div className="text-sm">
            <div className="font-medium mb-1">{t('about.trash.title')}</div>
            <p className="text-app-text-muted text-[13px] leading-snug">
              {t('about.trash.body')}
            </p>
            <p className="text-app-text-muted text-[13px] leading-snug mt-1">
              {t('about.trash.restore')}
            </p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-app-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md bg-app-accent text-white hover:brightness-110"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
