import type { RecentDataset } from '@shared/types';
import { useDateTimeFormat, useT } from '../i18n';

interface WelcomeScreenProps {
  onOpenDataset: () => void;
  onOpenRecent: (path: string) => void;
  recentDatasets: RecentDataset[];
  busy: boolean;
}

export function WelcomeScreen({
  onOpenDataset,
  onOpenRecent,
  recentDatasets,
  busy
}: WelcomeScreenProps): JSX.Element {
  const t = useT();
  const formatDate = useDateTimeFormat();
  const steps = [t('welcome.step1'), t('welcome.step2'), t('welcome.step3')];

  return (
    <div className="h-full w-full flex items-center justify-center bg-app-bg">
      <div className="max-w-xl w-full px-10 py-12 flex flex-col items-center text-center">
        <h1 className="text-4xl font-semibold text-app-text mb-2">the-annotator</h1>
        <p className="text-app-text-muted mb-10">{t('welcome.tagline')}</p>

        <button
          type="button"
          onClick={onOpenDataset}
          disabled={busy}
          className="mb-8 px-8 py-4 text-lg font-medium rounded-lg bg-app-accent text-white shadow hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {busy ? t('welcome.opening') : t('welcome.openDataset')}
        </button>

        {recentDatasets.length > 0 && (
          <div className="w-full max-w-md mb-10 text-left">
            <h2 className="text-sm font-semibold text-app-text mb-2">
              {t('welcome.recentDatasets')}
            </h2>
            <ul className="flex flex-col gap-1">
              {recentDatasets.map((ds) => (
                <li key={ds.path}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onOpenRecent(ds.path)}
                    className="w-full flex flex-col items-start gap-0.5 px-3 py-2 rounded-md border border-app-border bg-white hover:bg-app-bg disabled:opacity-50"
                    title={ds.path}
                  >
                    <span className="text-sm text-app-text truncate w-full">
                      {ds.name}
                    </span>
                    <span className="text-[11px] text-app-text-muted truncate w-full">
                      {ds.path}
                      {'  ·  '}
                      {t('welcome.lastOpened', { date: formatDate(ds.lastOpenedAt) })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ol className="text-left space-y-3 text-sm text-app-text-muted w-full max-w-md">
          {steps.map((step, idx) => (
            <li key={step} className="flex gap-3">
              <span className="flex-none w-6 h-6 rounded-full bg-app-accent text-white font-semibold flex items-center justify-center text-xs">
                {idx + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
