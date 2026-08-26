import { useEffect } from 'react';
import { plural } from '@shared/i18n';
import { useT } from '../i18n';

interface DeleteImageConfirmDialogProps {
  filename: string;
  annotationsCount: number;
  hadLabelFile: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteImageConfirmDialog({
  filename,
  annotationsCount,
  hadLabelFile,
  onConfirm,
  onCancel
}: DeleteImageConfirmDialogProps): JSX.Element {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  const details = hadLabelFile
    ? plural(t, annotationsCount, 'deleteImage.withBoxes.one', 'deleteImage.withBoxes.other')
    : t('deleteImage.withoutBoxes');

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
          <h2 className="text-lg font-semibold text-app-text">{t('deleteImage.title')}</h2>
        </div>
        <div className="px-6 py-5 text-sm text-app-text whitespace-pre-wrap">
          {t('deleteImage.message', { filename, details })}
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
