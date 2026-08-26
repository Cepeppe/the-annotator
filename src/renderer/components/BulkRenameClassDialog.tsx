import { useEffect, useState } from 'react';
import { useT } from '../i18n';

interface BulkRenameClassDialogProps {
  classes: string[];
  onConfirm: (classId: number, newName: string) => void;
  onCancel: () => void;
}

export function BulkRenameClassDialog({
  classes,
  onConfirm,
  onCancel
}: BulkRenameClassDialogProps): JSX.Element {
  const t = useT();
  const [classId, setClassId] = useState(0);
  const [newName, setNewName] = useState(classes[0] ?? '');

  useEffect(() => {
    setNewName(classes[classId] ?? '');
  }, [classId, classes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const trimmed = newName.trim();
  const oldName = classes[classId] ?? '';
  const collision = trimmed.length > 0 && trimmed !== oldName && classes.includes(trimmed);
  const canSubmit = trimmed.length > 0 && trimmed !== oldName && !collision;

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
          <h2 className="text-lg font-semibold">{t('bulkRename.title')}</h2>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-app-text-muted">{t('bulkRename.classLabel')}</span>
            <select
              value={classId}
              onChange={(e) => setClassId(Number.parseInt(e.target.value, 10))}
              className="border border-app-border rounded-md px-3 py-2"
            >
              {classes.map((name, idx) => (
                <option key={`${idx}-${name}`} value={idx}>
                  {idx}: {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-app-text-muted">{t('bulkRename.newNameLabel')}</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) {
                  e.preventDefault();
                  onConfirm(classId, trimmed);
                }
              }}
              className="border border-app-border rounded-md px-3 py-2"
            />
            {collision && (
              <span className="text-xs text-red-700">{t('bulkRename.collision')}</span>
            )}
          </label>
          <p className="text-xs text-app-text-muted">{t('bulkRename.note')}</p>
        </div>
        <div className="px-6 py-4 border-t border-app-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md border border-app-border bg-white hover:bg-app-bg"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onConfirm(classId, trimmed)}
            className="px-4 py-2 text-sm rounded-md bg-app-accent text-white hover:brightness-110 disabled:opacity-40"
          >
            {t('common.rename')}
          </button>
        </div>
      </div>
    </div>
  );
}
