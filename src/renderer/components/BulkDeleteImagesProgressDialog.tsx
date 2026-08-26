import { useT } from '../i18n';

interface BulkDeleteImagesProgressDialogProps {
  current: number;
  total: number;
}

/**
 * Non-cancellable modal shown while deleting more than 20 images. The batch
 * cannot be stopped halfway because each delete is atomic per pair (img + txt),
 * so aborting would leave the selection half applied.
 */
export function BulkDeleteImagesProgressDialog({
  current,
  total
}: BulkDeleteImagesProgressDialogProps): JSX.Element {
  const t = useT();
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="presentation"
    >
      <div
        className="max-w-md w-full mx-6 rounded-lg bg-app-surface shadow-xl border border-app-border"
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 py-5 border-b border-app-border">
          <h2 className="text-lg font-semibold text-app-text">{t('bulkDeleteImages.title')}</h2>
        </div>
        <div className="px-6 py-5 flex flex-col gap-3 text-sm text-app-text">
          <div>{t('bulkDeleteImages.progress', { current, total, percent: pct })}</div>
          <div className="h-2 bg-app-bg rounded overflow-hidden">
            <div
              className="h-full bg-app-accent transition-[width] duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs text-app-text-muted">{t('bulkDeleteImages.note')}</div>
        </div>
      </div>
    </div>
  );
}
