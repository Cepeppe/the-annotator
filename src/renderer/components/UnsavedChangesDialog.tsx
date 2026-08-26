import { useEffect } from 'react';
import { useT } from '../i18n';

interface UnsavedChangesDialogProps {
  onSaveAndContinue: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({
  onSaveAndContinue,
  onDiscard,
  onCancel
}: UnsavedChangesDialogProps): JSX.Element {
  const t = useT();

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="presentation"
    >
      <div
        className="max-w-md w-full mx-6 rounded-lg bg-app-surface shadow-xl border border-app-border"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 py-5 border-b border-app-border">
          <h2 className="text-lg font-semibold text-app-text">{t('unsaved.title')}</h2>
        </div>
        <div className="px-6 py-5 text-sm text-app-text">{t('unsaved.message')}</div>
        <div className="px-6 py-4 border-t border-app-border flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md border border-app-border bg-white hover:bg-app-bg"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="px-4 py-2 text-sm rounded-md border border-app-border bg-white text-red-700 hover:bg-red-50"
          >
            {t('unsaved.discard')}
          </button>
          <button
            type="button"
            onClick={onSaveAndContinue}
            className="px-4 py-2 text-sm rounded-md bg-app-accent text-white hover:brightness-110"
          >
            {t('unsaved.saveAndContinue')}
          </button>
        </div>
      </div>
    </div>
  );
}
