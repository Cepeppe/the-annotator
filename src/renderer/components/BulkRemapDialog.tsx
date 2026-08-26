import { useEffect, useMemo, useState } from 'react';
import type { TranslateFn } from '@shared/i18n';
import { useT } from '../i18n';

interface BulkRemapDialogProps {
  classes: string[];
  perClassCounts: Record<number, number>;
  onConfirm: (mapping: Array<{ from: number; to: number }>) => void;
  onCancel: () => void;
}

interface Row {
  id: number;
  from: number;
  to: number;
}

let rowIdCounter = 0;
const nextRowId = (): number => ++rowIdCounter;

export function BulkRemapDialog({
  classes,
  perClassCounts,
  onConfirm,
  onCancel
}: BulkRemapDialogProps): JSX.Element {
  const t = useT();
  const [rows, setRows] = useState<Row[]>(() => [
    { id: nextRowId(), from: 0, to: classes.length > 1 ? 1 : 0 }
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const validation = useMemo(() => validateRows(t, rows, classes), [t, rows, classes]);
  const totalImpact = useMemo(() => {
    let s = 0;
    for (const r of rows) {
      if (r.from !== r.to) s += perClassCounts[r.from] ?? 0;
    }
    return s;
  }, [rows, perClassCounts]);

  const addRow = (): void => {
    setRows((prev) => [
      ...prev,
      { id: nextRowId(), from: 0, to: classes.length > 1 ? 1 : 0 }
    ]);
  };
  const removeRow = (id: number): void => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)));
  };
  const updateRow = (id: number, patch: Partial<Pick<Row, 'from' | 'to'>>): void => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const submit = (): void => {
    if (!validation.ok) return;
    const mapping = rows.filter((r) => r.from !== r.to).map((r) => ({ from: r.from, to: r.to }));
    if (mapping.length === 0) {
      onCancel();
      return;
    }
    onConfirm(mapping);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="max-w-2xl w-full mx-6 rounded-lg bg-app-surface shadow-xl border border-app-border"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-app-border">
          <h2 className="text-lg font-semibold">{t('bulkRemap.title')}</h2>
        </div>
        <div className="px-6 py-5 flex flex-col gap-3 text-sm">
          <p className="text-xs text-app-text-muted">{t('bulkRemap.intro')}</p>
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
            {rows.map((r, i) => (
              <div key={r.id} className="flex items-center gap-2">
                <span className="text-xs text-app-text-muted w-6 text-right">{i + 1}.</span>
                <select
                  value={r.from}
                  onChange={(e) =>
                    updateRow(r.id, { from: Number.parseInt(e.target.value, 10) })
                  }
                  className="flex-1 border border-app-border rounded-md px-2 py-1.5"
                >
                  {classes.map((name, idx) => (
                    <option key={`from-${r.id}-${idx}`} value={idx}>
                      {idx}: {name}
                    </option>
                  ))}
                </select>
                <span className="text-app-text-muted">→</span>
                <select
                  value={r.to}
                  onChange={(e) => updateRow(r.id, { to: Number.parseInt(e.target.value, 10) })}
                  className="flex-1 border border-app-border rounded-md px-2 py-1.5"
                >
                  {classes.map((name, idx) => (
                    <option key={`to-${r.id}-${idx}`} value={idx}>
                      {idx}: {name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeRow(r.id)}
                  disabled={rows.length === 1}
                  title={t('bulkRemap.removeRow')}
                  className="w-8 h-8 flex items-center justify-center rounded border border-app-border bg-white hover:bg-app-bg disabled:opacity-40"
                >
                  −
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addRow}
            className="self-start text-xs px-3 py-1 rounded border border-app-border bg-white hover:bg-app-bg"
          >
            + {t('bulkRemap.addRow')}
          </button>
          {!validation.ok && <p className="text-xs text-red-700">{validation.reason}</p>}
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            {t('bulkRemap.impact', { count: totalImpact })}
          </div>
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
            disabled={!validation.ok}
            onClick={submit}
            className="px-4 py-2 text-sm rounded-md bg-app-accent text-white hover:brightness-110 disabled:opacity-40"
          >
            {t('bulkRemap.apply')}
          </button>
        </div>
      </div>
    </div>
  );
}

function validateRows(
  t: TranslateFn,
  rows: Row[],
  classes: string[]
): { ok: true } | { ok: false; reason: string } {
  if (classes.length === 0) return { ok: false, reason: t('bulkRemap.error.noClasses') };
  const seen = new Set<number>();
  for (const r of rows) {
    if (r.from < 0 || r.from >= classes.length || r.to < 0 || r.to >= classes.length) {
      return { ok: false, reason: t('bulkRemap.error.invalidClass') };
    }
    if (r.from === r.to) continue;
    if (seen.has(r.from)) {
      return {
        ok: false,
        reason: t('bulkRemap.error.duplicateSource', { classId: r.from })
      };
    }
    seen.add(r.from);
  }
  return { ok: true };
}
