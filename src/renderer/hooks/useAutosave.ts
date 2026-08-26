import { useCallback, useEffect, useRef } from 'react';
import {
  getCurrentEditState,
  useDataset,
  type DatasetState,
  type ImageEditState
} from '../state/datasetStore';
import { useApi } from './useApi';
import type { BBoxYolo } from '@shared/types';
import { t } from '../i18n';

interface UseAutosaveResult {
  /**
   * Saves the current image right away and reports whether it succeeded. Used
   * by Ctrl+S and to flush pending edits before closing or switching image.
   */
  saveCurrentNow: () => Promise<boolean>;
  /** Saves one specific image, for the flush before switching to another one. */
  saveImageNow: (filename: string) => Promise<boolean>;
}

const DEBOUNCE_MS = 500;
const THROTTLE_MS = 30_000;

interface SaveOutcome {
  ok: boolean;
}

export function useAutosave(onToast: (message: string) => void): UseAutosaveResult {
  const { state, dispatch } = useDataset();
  const api = useApi();
  const stateRef = useRef<DatasetState>(state);
  stateRef.current = state;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const apiRef = useRef(api);
  apiRef.current = api;
  const onToastRef = useRef(onToast);
  onToastRef.current = onToast;

  const debounceTimerRef = useRef<number | null>(null);
  const lastFlushAtRef = useRef<number>(Date.now());
  const inFlightRef = useRef<Promise<SaveOutcome> | null>(null);

  const performSave = useCallback(
    async (filename: string, showToast: boolean): Promise<boolean> => {
      const s = stateRef.current;
      if (s.phase !== 'loaded') return false;
      const entry = s.perImage.get(filename);
      if (!entry || !entry.isDirty) {
        if (showToast) onToastRef.current(t('toast.nothingToSave'));
        return true;
      }
      const dp = dispatchRef.current;
      const root = s.root;
      const bboxesYolo: BBoxYolo[] = entry.bboxes.map(({ classId, xCenter, yCenter, width, height }) => ({
        classId,
        xCenter,
        yCenter,
        width,
        height
      }));
      dp({ type: 'MARK_SAVING' });
      const t0 = performance.now();
      const result = await apiRef.current.saveAnnotations(root, filename, bboxesYolo);
      const elapsed = Math.round(performance.now() - t0);
      // eslint-disable-next-line no-console
      console.info(`[autosave] ${filename}: ${elapsed}ms`);
      if (result.ok) {
        dp({ type: 'MARK_SAVED', filename, savedAt: result.savedAt });
        lastFlushAtRef.current = Date.now();
        if (showToast) onToastRef.current(`${t('toast.saved')} ✓`);
        return true;
      }
      const recoveryNote = result.recoveredTo
        ? t('fs.save.recoveryNote', { path: result.recoveredTo })
        : '';
      const message = `${result.details}${recoveryNote}`;
      dp({ type: 'MARK_SAVE_ERROR', message });
      if (showToast) onToastRef.current(t('toast.saveFailed'));
      return false;
    },
    []
  );

  const saveImageNow = useCallback(
    async (filename: string): Promise<boolean> => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const promise = (async (): Promise<SaveOutcome> => {
        const ok = await performSave(filename, false);
        return { ok };
      })();
      inFlightRef.current = promise;
      try {
        const out = await promise;
        return out.ok;
      } finally {
        if (inFlightRef.current === promise) inFlightRef.current = null;
      }
    },
    [performSave]
  );

  const saveCurrentNow = useCallback(async (): Promise<boolean> => {
    const s = stateRef.current;
    if (s.phase !== 'loaded' || !s.currentImage) return true;
    const result = await saveImageNow(s.currentImage);
    onToastRef.current(result ? `${t('toast.saved')} ✓` : t('toast.saveFailed'));
    return result;
  }, [saveImageNow]);

  // Reacts to a change of dirty state or current image: schedules the debounce,
  // or flushes right away when the throttle window has already elapsed.
  useEffect(() => {
    const s = state;
    if (s.phase !== 'loaded' || !s.currentImage) return;
    const entry = getCurrentEditState(s);
    if (!entry || !entry.isDirty) return;
    const filename = s.currentImage;

    const sinceLast = Date.now() - lastFlushAtRef.current;
    const wait = sinceLast >= THROTTLE_MS ? 0 : DEBOUNCE_MS;

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void performSave(filename, false);
    }, wait);

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [state, performSave]);

  // Safety net for a continuous editing session: force a flush every
  // THROTTLE_MS even if the debounce keeps being reset.
  useEffect(() => {
    const interval = window.setInterval(() => {
      const s = stateRef.current;
      if (s.phase !== 'loaded' || !s.currentImage) return;
      const entry = s.perImage.get(s.currentImage);
      if (!entry || !entry.isDirty) return;
      const sinceLast = Date.now() - lastFlushAtRef.current;
      if (sinceLast < THROTTLE_MS) return;
      void performSave(s.currentImage, false);
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [performSave]);

  return { saveCurrentNow, saveImageNow };
}

export function isImageDirty(state: DatasetState, filename: string): boolean {
  if (state.phase !== 'loaded') return false;
  const entry: ImageEditState | undefined = state.perImage.get(filename);
  return Boolean(entry?.isDirty);
}
