import { classNameToColor } from '@shared/colorPalette';
import type { TranslateFn } from '@shared/i18n';
import {
  canRedoCurrent,
  canUndoCurrent,
  isImageCompleted,
  useDataset,
  type EditMode
} from '../state/datasetStore';
import { useApi } from '../hooks/useApi';
import { useT } from '../i18n';

interface CurrentClassBadgeProps {
  classes: string[];
  classId: number;
}

function CurrentClassBadge({ classes, classId }: CurrentClassBadgeProps): JSX.Element {
  const t = useT();
  const name = classes[classId];
  if (!name) {
    return <span className="text-xs text-app-text-muted">{t('toolbar.noClassSelected')}</span>;
  }
  const color = classNameToColor(name).hex;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-xs text-app-text-muted whitespace-nowrap">
        {t('toolbar.currentClass')}
      </span>
      <span
        className="inline-block w-3.5 h-3.5 rounded-full border border-black/20 flex-none"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="text-sm truncate max-w-[140px]" title={name}>
        {classId}: {name}
      </span>
    </div>
  );
}

interface CanvasToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onSaveNow: () => void;
  onMarkCompletedAndNext: () => void;
  onMarkPending: () => void;
}

const MODES: EditMode[] = ['select', 'draw'];

function modeLabel(t: TranslateFn, mode: EditMode): string {
  return mode === 'select' ? t('toolbar.mode.select') : t('toolbar.mode.draw');
}

function modeTooltip(t: TranslateFn, mode: EditMode): string {
  return mode === 'select' ? t('toolbar.mode.select.tooltip') : t('toolbar.mode.draw.tooltip');
}

export function CanvasToolbar({
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onSaveNow,
  onMarkCompletedAndNext,
  onMarkPending
}: CanvasToolbarProps): JSX.Element {
  const { state, dispatch } = useDataset();
  const api = useApi();
  const t = useT();
  if (state.phase !== 'loaded') return <></>;

  const canUndo = canUndoCurrent(state);
  const canRedo = canRedoCurrent(state);
  const saveStatus = state.saveStatus;
  const lastSaveError = state.lastSaveError;
  const completed = state.currentImage ? isImageCompleted(state, state.currentImage) : false;
  const hasCurrent = Boolean(state.currentImage);
  const showPixelGrid = state.userSettings.showPixelGrid;
  const showRulers = state.userSettings.showRulers;

  // Visual toggles update the store immediately (instant UI) and persist
  // fire-and-forget. A failed write is ignored on purpose: these settings are
  // cosmetic and not worth interrupting the user for.
  const toggleVisualSetting = (key: 'showPixelGrid' | 'showRulers'): void => {
    const next = { ...state.userSettings, [key]: !state.userSettings[key] };
    dispatch({ type: 'SET_USER_SETTINGS', settings: next });
    void api.saveUserSettings(next);
  };

  return (
    <div className="flex-none flex items-center gap-2 px-3 py-2 bg-app-surface border-b border-app-border text-sm">
      <div className="flex items-center gap-1">
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            title={modeTooltip(t, mode)}
            onClick={() => dispatch({ type: 'SET_MODE', mode })}
            className={`px-3 py-1.5 rounded-md border ${
              state.mode === mode
                ? 'bg-app-accent text-white border-app-accent'
                : 'bg-white text-app-text border-app-border hover:bg-app-bg'
            }`}
          >
            {modeLabel(t, mode)}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-app-border mx-1" />

      <div className="flex items-center gap-1">
        <button
          type="button"
          title={t('toolbar.zoomOut.title')}
          onClick={onZoomOut}
          className="px-2 py-1.5 rounded-md border border-app-border bg-white hover:bg-app-bg"
        >
          −
        </button>
        <button
          type="button"
          title={t('toolbar.zoomIn.title')}
          onClick={onZoomIn}
          className="px-2 py-1.5 rounded-md border border-app-border bg-white hover:bg-app-bg"
        >
          +
        </button>
        <button
          type="button"
          title={t('toolbar.fit.title')}
          onClick={onResetZoom}
          className="px-3 py-1.5 rounded-md border border-app-border bg-white hover:bg-app-bg"
        >
          {t('toolbar.fit')}
        </button>
        <button
          type="button"
          title={showPixelGrid ? t('toolbar.pixelGrid.hide') : t('toolbar.pixelGrid.show')}
          onClick={() => toggleVisualSetting('showPixelGrid')}
          aria-pressed={showPixelGrid}
          className={`px-2 py-1.5 rounded-md border ${
            showPixelGrid
              ? 'bg-app-accent text-white border-app-accent'
              : 'bg-white text-app-text border-app-border hover:bg-app-bg'
          }`}
        >
          ▦
        </button>
        <button
          type="button"
          title={showRulers ? t('toolbar.rulers.hide') : t('toolbar.rulers.show')}
          onClick={() => toggleVisualSetting('showRulers')}
          aria-pressed={showRulers}
          className={`px-2 py-1.5 rounded-md border ${
            showRulers
              ? 'bg-app-accent text-white border-app-accent'
              : 'bg-white text-app-text border-app-border hover:bg-app-bg'
          }`}
        >
          ⊢
        </button>
      </div>

      <div className="w-px h-6 bg-app-border mx-1" />

      <div className="flex items-center gap-1">
        <button
          type="button"
          title={t('toolbar.undo.title')}
          disabled={!canUndo}
          onClick={() => dispatch({ type: 'UNDO' })}
          className="px-3 py-1.5 rounded-md border border-app-border bg-white hover:bg-app-bg disabled:opacity-40"
        >
          {t('toolbar.undo')}
        </button>
        <button
          type="button"
          title={t('toolbar.redo.title')}
          disabled={!canRedo}
          onClick={() => dispatch({ type: 'REDO' })}
          className="px-3 py-1.5 rounded-md border border-app-border bg-white hover:bg-app-bg disabled:opacity-40"
        >
          {t('toolbar.redo')}
        </button>
        <button
          type="button"
          title={t('toolbar.save.title')}
          onClick={onSaveNow}
          className="px-3 py-1.5 rounded-md border border-app-accent bg-app-accent text-white hover:brightness-110"
        >
          {t('toolbar.save')}
        </button>
      </div>

      <div className="w-px h-6 bg-app-border mx-1" />

      <div className="flex items-center gap-1">
        {completed ? (
          <button
            type="button"
            title={t('toolbar.markPending.title')}
            disabled={!hasCurrent}
            onClick={onMarkPending}
            className="px-3 py-1.5 rounded-md border border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:opacity-40"
          >
            ↶ {t('toolbar.markPending')}
          </button>
        ) : (
          <button
            type="button"
            title={t('toolbar.markDone.title')}
            disabled={!hasCurrent}
            onClick={onMarkCompletedAndNext}
            className="px-3 py-1.5 rounded-md border border-emerald-500 bg-emerald-500 text-white hover:brightness-110 disabled:opacity-40"
          >
            ✓ {t('toolbar.markDone')}
          </button>
        )}
      </div>

      <div className="w-px h-6 bg-app-border mx-1" />

      <CurrentClassBadge classes={state.classes} classId={state.currentClassId} />

      <div className="ml-auto flex items-center gap-2 text-xs">
        <SaveStatusBadge status={saveStatus} message={lastSaveError} />
      </div>
    </div>
  );
}

function SaveStatusBadge({
  status,
  message
}: {
  status: 'idle' | 'dirty' | 'saving' | 'error';
  message: string | null;
}): JSX.Element {
  const t = useT();
  if (status === 'saving') {
    return <span className="text-app-text-muted">{t('toolbar.saveStatus.saving')}</span>;
  }
  if (status === 'dirty') {
    return <span className="text-amber-700">● {t('toolbar.saveStatus.dirty')}</span>;
  }
  if (status === 'error') {
    return (
      <span className="text-red-700" title={message ?? ''}>
        ⚠ {t('toolbar.saveStatus.error')}
      </span>
    );
  }
  return <span className="text-emerald-700">✓ {t('toolbar.saveStatus.saved')}</span>;
}
