import { useEffect } from 'react';
import { plural } from '@shared/i18n';
import { useT } from '../i18n';

interface DeleteImagesBulkConfirmDialogProps {
  imageCount: number;
  totalAnnotationsApprox: number;
  /** True when the annotation count is an estimate (not every .txt was read). */
  annotationsApprox?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteImagesBulkConfirmDialog({
  imageCount,
  totalAnnotationsApprox,
  annotationsApprox = false,
  onConfirm,
  onCancel
}: DeleteImagesBulkConfirmDialogProps): JSX.Element {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  const details =
    totalAnnotationsApprox > 0
      ? plural(
          t,
          totalAnnotationsApprox,
          'deleteImagesBulk.annotations.one',
          'deleteImagesBulk.annotations.other',
          { approx: annotationsApprox ? '≈ ' : '' }
        )
      : t('deleteImagesBulk.noAnnotations');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="max-w-md w-full mx-6 rounded-lg bg-app-surface shadow-xl border border-app-border"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 py-5 border-b border-app-border">
          <h2 className="text-lg font-semibold text-app-text">
            {plural(
              t,
              imageCount,
              'deleteImagesBulk.title.one',
              'deleteImagesBulk.title.other'
            )}
          </h2>
        </div>
        <div className="px-6 py-5 text-sm text-app-text whitespace-pre-wrap">
          {plural(
            t,
            imageCount,
            'deleteImagesBulk.message.one',
            'deleteImagesBulk.message.other',
            { details }
          )}
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
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700"
          >
            {t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
