import { useEffect } from 'react';

interface DialogProps {
  title: string;
  message: string;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  onClose: () => void;
}

export function Dialog({
  title,
  message,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  onClose
}: DialogProps): JSX.Element {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') onPrimary();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrimary]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-w-md w-full mx-6 rounded-lg bg-app-surface shadow-xl border border-app-border"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 py-5 border-b border-app-border">
          <h2 className="text-lg font-semibold text-app-text">{title}</h2>
        </div>
        <div className="px-6 py-5 text-sm text-app-text whitespace-pre-wrap">{message}</div>
        <div className="px-6 py-4 border-t border-app-border flex justify-end gap-2">
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="px-4 py-2 text-sm rounded-md border border-app-border bg-white hover:bg-app-bg"
            >
              {secondaryLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onPrimary}
            className="px-4 py-2 text-sm rounded-md bg-app-accent text-white hover:brightness-110"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
