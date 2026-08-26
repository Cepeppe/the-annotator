import { useState } from 'react';
import { useT } from '../i18n';

interface CanvasToolbarSecondaryProps {
  /** File name of the current image; the button is disabled when null. */
  currentImage: string | null;
  /** Deletes immediately, no confirmation. The warning lives in the tooltip. */
  onDeleteCurrentImage: () => void;
}

/**
 * Secondary toolbar below the main one. It holds advanced and destructive
 * actions that must not distract the day-to-day annotator, so it is
 * collapsible and closed by default.
 */
export function CanvasToolbarSecondary({
  currentImage,
  onDeleteCurrentImage
}: CanvasToolbarSecondaryProps): JSX.Element {
  const t = useT();
  const [open, setOpen] = useState(false);
  const tooltip = t('advancedToolbar.tooltip');

  return (
    <div className="flex-none border-b border-app-border bg-app-surface">
      <div className="flex items-center px-3 py-1 gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-app-text-muted hover:text-app-text flex items-center gap-1"
          aria-expanded={open}
          aria-controls="toolbar-secondary-panel"
          title={tooltip}
        >
          <span>{open ? '▾' : '▸'}</span>
          <span>{t('advancedToolbar.label')}</span>
          <span
            className="ml-1 inline-flex w-4 h-4 items-center justify-center rounded-full border border-app-border text-[10px] text-app-text-muted"
            aria-hidden="true"
          >
            ?
          </span>
        </button>
        {!open && (
          <span className="text-[11px] text-app-text-muted">{t('advancedToolbar.hint')}</span>
        )}
      </div>
      {open && (
        <div
          id="toolbar-secondary-panel"
          className="flex items-center px-3 pb-2 gap-2 border-t border-app-border"
        >
          <button
            type="button"
            disabled={!currentImage}
            onClick={onDeleteCurrentImage}
            className="px-3 py-1.5 text-sm rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title={tooltip}
          >
            🗑 {t('advancedToolbar.deleteImage')}
          </button>
        </div>
      )}
    </div>
  );
}
