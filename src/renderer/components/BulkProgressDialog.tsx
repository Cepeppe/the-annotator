import type { BulkProgressUpdate } from '@shared/types';
import type { TranslationKey } from '@shared/i18n';
import { useT } from '../i18n';

interface BulkProgressDialogProps {
  title: string;
  update: BulkProgressUpdate | null;
  onCancel?: () => void;
}

const PHASE_KEY: Record<BulkProgressUpdate['phase'], TranslationKey> = {
  scanning: 'bulkProgress.phase.scanning',
  backup: 'bulkProgress.phase.backup',
  applying: 'bulkProgress.phase.applying',
  rollback: 'bulkProgress.phase.rollback',
  done: 'bulkProgress.phase.done'
};

export function BulkProgressDialog({
  title,
  update,
  onCancel
}: BulkProgressDialogProps): JSX.Element {
  const t = useT();
  const total = update?.total ?? 0;
  const current = update?.current ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const phaseLabel = update ? t(PHASE_KEY[update.phase]) : t('bulkProgress.preparing');
  const canCancel = onCancel && update && update.phase !== 'rollback' && update.phase !== 'done';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="max-w-md w-full mx-6 rounded-lg bg-app-surface shadow-xl border border-app-border"
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 py-5 border-b border-app-border">
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="px-6 py-5 flex flex-col gap-3 text-sm">
          <div className="text-app-text-muted">{phaseLabel}...</div>
          <div className="w-full bg-app-bg rounded-full overflow-hidden h-3 border border-app-border">
            <div
              className="h-full bg-app-accent transition-all duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs text-app-text-muted text-right tabular-nums">
            {total > 0 ? t('bulkProgress.files', { current, total, percent: pct }) : '...'}
          </div>
          <p className="text-[11px] text-app-text-muted">{t('bulkProgress.backupNote')}</p>
        </div>
        <div className="px-6 py-4 border-t border-app-border flex justify-end">
          <button
            type="button"
            disabled={!canCancel}
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md border border-app-border bg-white hover:bg-app-bg disabled:opacity-40"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
