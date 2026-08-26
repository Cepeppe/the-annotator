import { useEffect, useState } from 'react';
import { useT } from '../i18n';

interface BulkMergeClassDialogProps {
  classes: string[];
  perClassCounts: Record<number, number>;
  onConfirm: (fromClassId: number, toClassId: number) => void;
  onCancel: () => void;
}

export function BulkMergeClassDialog({
  classes,
  perClassCounts,
  onConfirm,
  onCancel
}: BulkMergeClassDialogProps): JSX.Element {
  const t = useT();
  const [fromClassId, setFromClassId] = useState(0);
  const [toClassId, setToClassId] = useState(Math.min(1, classes.length - 1));
  const [previewed, setPreviewed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  useEffect(() => {
    setPreviewed(false);
  }, [fromClassId, toClassId]);

  const fromName = classes[fromClassId] ?? '';
  const toName = classes[toClassId] ?? '';
  const movedCount = perClassCounts[fromClassId] ?? 0;
  const sameClass = fromClassId === toClassId;
  const canSubmit = !sameClass && classes.length >= 2;

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
          <h2 className="text-lg font-semibold">{t('bulkMerge.title')}</h2>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-app-text-muted">{t('bulkMerge.fromLabel')}</span>
            <select
              value={fromClassId}
              onChange={(e) => setFromClassId(Number.parseInt(e.target.value, 10))}
              className="border border-app-border rounded-md px-3 py-2"
            >
              {classes.map((name, idx) => (
                <option key={`from-${idx}-${name}`} value={idx}>
                  {idx}: {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-app-text-muted">{t('bulkMerge.toLabel')}</span>
            <select
              value={toClassId}
              onChange={(e) => setToClassId(Number.parseInt(e.target.value, 10))}
              className="border border-app-border rounded-md px-3 py-2"
            >
              {classes.map((name, idx) => (
                <option key={`to-${idx}-${name}`} value={idx}>
                  {idx}: {name}
                </option>
              ))}
            </select>
          </label>
          {sameClass && <p className="text-xs text-red-700">{t('bulkMerge.sameClass')}</p>}
          {!sameClass && previewed && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              {t(movedCount === 1 ? 'bulkMerge.previewOne' : 'bulkMerge.previewOther', {
                count: movedCount,
                from: fromName,
                to: toName
              })}
            </div>
          )}
          {!sameClass && !previewed && (
            <p className="text-xs text-app-text-muted">{t('bulkMerge.previewHint')}</p>
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
              disabled={!canSubmit}
              onClick={() => setPreviewed(true)}
              className="px-4 py-2 text-sm rounded-md border border-app-border bg-white hover:bg-app-bg disabled:opacity-40"
            >
              {t('common.preview')}
            </button>
          ) : (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => onConfirm(fromClassId, toClassId)}
              className="px-4 py-2 text-sm rounded-md bg-app-accent text-white hover:brightness-110 disabled:opacity-40"
            >
              {t('common.merge')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
