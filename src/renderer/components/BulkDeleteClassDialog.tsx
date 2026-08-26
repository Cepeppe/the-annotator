import { useEffect, useState } from 'react';
import { useT } from '../i18n';

interface BulkDeleteClassDialogProps {
  classes: string[];
  perClassCounts: Record<number, number>;
  onConfirm: (classId: number) => void;
  onCancel: () => void;
}

export function BulkDeleteClassDialog({
  classes,
  perClassCounts,
  onConfirm,
  onCancel
}: BulkDeleteClassDialogProps): JSX.Element {
  const t = useT();
  const [classId, setClassId] = useState(0);
  const [previewed, setPreviewed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const count = perClassCounts[classId] ?? 0;
  const canDelete = classes.length > 0;
  const className = classes[classId] ?? '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="max-w-md w-full mx-6 rounded-lg bg-app-surface shadow-xl border border-app-border"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-app-border">
          <h2 className="text-lg font-semibold">{t('bulkDeleteClass.title')}</h2>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-app-text-muted">{t('bulkDeleteClass.classLabel')}</span>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(Number.parseInt(e.target.value, 10));
                setPreviewed(false);
              }}
              className="border border-app-border rounded-md px-3 py-2"
            >
              {classes.map((name, idx) => (
                <option key={`${idx}-${name}`} value={idx}>
                  {idx}: {name}
                </option>
              ))}
            </select>
          </label>
          {previewed ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              {t(
                count === 1 ? 'bulkDeleteClass.previewOne' : 'bulkDeleteClass.previewOther',
                { count, name: className }
              )}
            </div>
          ) : (
            <p className="text-xs text-app-text-muted">{t('bulkDeleteClass.previewHint')}</p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-app-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md border border-app-border bg-white hover:bg-app-bg"
          >
            {t('common.cancel')}
          </button>
          {!previewed ? (
            <button
              type="button"
              disabled={!canDelete}
              onClick={() => setPreviewed(true)}
              className="px-4 py-2 text-sm rounded-md border border-app-border bg-white hover:bg-app-bg disabled:opacity-40"
            >
              {t('common.preview')}
            </button>
          ) : (
            <button
              type="button"
              disabled={!canDelete}
              onClick={() => onConfirm(classId)}
              className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
            >
              {t('bulkDeleteClass.confirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
