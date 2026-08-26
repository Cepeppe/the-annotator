import { useEffect, useMemo, useState } from 'react';
import { classNameToColor } from '@shared/colorPalette';
import { useT } from '../i18n';

interface AddClassDialogProps {
  existingClasses: string[];
  onConfirm: (name: string) => Promise<void> | void;
  onCancel: () => void;
}

const PALETTE_HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

export function AddClassDialog({
  existingClasses,
  onConfirm,
  onCancel
}: AddClassDialogProps): JSX.Element {
  const t = useT();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();

  const collision = useMemo(
    () => trimmed.length > 0 && existingClasses.includes(trimmed),
    [trimmed, existingClasses]
  );

  // Preview of the colour derived from the name (deterministic).
  const autoColor = useMemo(
    () => (trimmed.length > 0 ? classNameToColor(trimmed).hex : '#9ca3af'),
    [trimmed]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const canSubmit = trimmed.length > 0 && !collision && !busy;

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onConfirm(trimmed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="max-w-md w-full mx-6 rounded-lg bg-app-surface shadow-xl border border-app-border"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-app-border">
          <h2 className="text-lg font-semibold text-app-text">{t('addClass.title')}</h2>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4 text-sm text-app-text">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-app-text-muted">{t('addClass.nameLabel')}</span>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder={t('addClass.namePlaceholder')}
              className="border border-app-border rounded-md px-3 py-2"
            />
            {collision && (
              <span className="text-xs text-red-700">{t('addClass.collision')}</span>
            )}
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-app-text-muted">{t('addClass.colorPreview')}</span>
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-6 h-6 rounded-full border border-black/20"
                style={{ backgroundColor: autoColor }}
                aria-hidden
              />
              <span className="text-xs text-app-text-muted font-mono">{autoColor}</span>
            </div>
            <div className="grid grid-cols-12 gap-1 mt-1">
              {PALETTE_HUES.map((hue) => (
                <span
                  key={hue}
                  title={t('addClass.hueSwatch', { degrees: hue })}
                  className="w-5 h-5 rounded-full border border-black/10"
                  style={{ backgroundColor: `hsl(${hue}deg 70% 50%)` }}
                  aria-hidden
                />
              ))}
            </div>
            <p className="text-[11px] text-app-text-muted">{t('addClass.colorNote')}</p>
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
            disabled={!canSubmit}
            onClick={() => {
              void submit();
            }}
            className="px-4 py-2 text-sm rounded-md bg-app-accent text-white hover:brightness-110 disabled:opacity-40"
          >
            {t('common.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
