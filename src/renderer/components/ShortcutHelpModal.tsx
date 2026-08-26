import { useEffect } from 'react';
import type { TranslationKey } from '@shared/i18n';
import { useT } from '../i18n';

interface ShortcutHelpModalProps {
  onClose: () => void;
}

interface ShortcutRow {
  /** Literal key combination, or a key for combos that need translating. */
  keys: string | TranslationKey;
  keysTranslated?: boolean;
  descriptionKey: TranslationKey;
}

interface ShortcutGroup {
  titleKey: TranslationKey;
  rows: ShortcutRow[];
}

const GROUPS: ShortcutGroup[] = [
  {
    titleKey: 'shortcuts.group.navigation',
    rows: [
      { keys: '↓ / J', descriptionKey: 'shortcuts.key.nextImage' },
      { keys: '↑ / K', descriptionKey: 'shortcuts.key.prevImage' },
      { keys: 'Home', descriptionKey: 'shortcuts.key.firstImage' },
      { keys: 'End', descriptionKey: 'shortcuts.key.lastImage' },
      {
        keys: 'shortcuts.keys.space',
        keysTranslated: true,
        descriptionKey: 'shortcuts.key.markDone'
      },
      { keys: 'Ctrl+Shift+M', descriptionKey: 'shortcuts.key.markPending' }
    ]
  },
  {
    titleKey: 'shortcuts.group.canvasModes',
    rows: [
      { keys: 'S', descriptionKey: 'shortcuts.key.selectMode' },
      { keys: 'D', descriptionKey: 'shortcuts.key.drawMode' }
    ]
  },
  {
    titleKey: 'shortcuts.group.boxes',
    rows: [
      { keys: 'Del / Backspace', descriptionKey: 'shortcuts.key.deleteBoxes' },
      { keys: 'Esc', descriptionKey: 'shortcuts.key.clearSelection' },
      { keys: 'Ctrl+C / Ctrl+V', descriptionKey: 'shortcuts.key.copyPaste' },
      { keys: '1 - 9, 0', descriptionKey: 'shortcuts.key.classDigits' },
      { keys: 'Ctrl+1 - Ctrl+0', descriptionKey: 'shortcuts.key.classDigitsCtrl' }
    ]
  },
  {
    titleKey: 'shortcuts.group.zoom',
    rows: [
      {
        keys: 'shortcuts.keys.wheel',
        keysTranslated: true,
        descriptionKey: 'shortcuts.key.wheelZoom'
      },
      { keys: '+ / -', descriptionKey: 'shortcuts.key.zoomInOut' },
      { keys: 'R', descriptionKey: 'shortcuts.key.fit' }
    ]
  },
  {
    titleKey: 'shortcuts.group.saving',
    rows: [
      { keys: 'Ctrl+S', descriptionKey: 'shortcuts.key.saveNow' },
      { keys: 'Ctrl+Z', descriptionKey: 'shortcuts.key.undo' },
      { keys: 'Ctrl+Y / Ctrl+Shift+Z', descriptionKey: 'shortcuts.key.redo' }
    ]
  },
  {
    titleKey: 'shortcuts.group.dataset',
    rows: [
      { keys: 'Backspace / Shift+Del', descriptionKey: 'shortcuts.key.deleteImages' },
      { keys: 'Ctrl+O', descriptionKey: 'shortcuts.key.openDataset' },
      { keys: 'Ctrl+,', descriptionKey: 'shortcuts.key.openSettings' },
      { keys: 'F1 / ?', descriptionKey: 'shortcuts.key.showHelp' }
    ]
  }
];

export function ShortcutHelpModal({ onClose }: ShortcutHelpModalProps): JSX.Element {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-w-2xl w-full mx-6 max-h-[85vh] flex flex-col rounded-lg bg-app-surface shadow-xl border border-app-border"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-help-title"
      >
        <div className="px-6 py-4 border-b border-app-border flex items-center justify-between">
          <h2 id="shortcut-help-title" className="text-lg font-semibold text-app-text">
            {t('shortcuts.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-app-text-muted hover:text-app-text px-2 py-1 rounded"
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-auto px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {GROUPS.map((group) => (
              <div key={group.titleKey}>
                <h3 className="text-xs uppercase tracking-wide text-app-text-muted mb-2">
                  {t(group.titleKey)}
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {group.rows.map((row) => {
                    const keys = row.keysTranslated
                      ? t(row.keys as TranslationKey)
                      : (row.keys as string);
                    return (
                      <li
                        key={row.descriptionKey}
                        className="text-sm text-app-text flex items-baseline gap-3"
                      >
                        <kbd className="font-mono text-[12px] px-2 py-0.5 rounded border border-app-border bg-app-bg whitespace-nowrap">
                          {keys}
                        </kbd>
                        <span className="flex-1">{t(row.descriptionKey)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="px-6 py-3 border-t border-app-border text-xs text-app-text-muted">
          {t('shortcuts.footer')}
        </div>
      </div>
    </div>
  );
}
