import { useEffect, useRef } from 'react';
import { useDataset } from '../state/datasetStore';
import { useApi } from './useApi';

const DEBOUNCE_MS = 500;
const KEEPALIVE_MS = 5 * 60 * 1000; // refresh last_opened_at every 5 minutes

export function useProgressAutosave(): void {
  const { state, dispatch } = useDataset();
  const api = useApi();

  const stateRef = useRef(state);
  stateRef.current = state;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const apiRef = useRef(api);
  apiRef.current = api;

  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (state.phase !== 'loaded') return;
    if (!state.progressFile) return;
    if (!state.progressDirty) return;

    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      const s = stateRef.current;
      if (s.phase !== 'loaded' || !s.progressFile) return;
      void apiRef.current.saveProgressFile(s.root, s.progressFile).then((res) => {
        if (res.ok) {
          dispatchRef.current({ type: 'MARK_PROGRESS_SAVED' });
        }
      });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [state.phase, (state as { progressDirty?: boolean }).progressDirty, (state as { progressFile?: unknown }).progressFile]);

  // Keep-alive: refresh last_opened_at periodically, so the progress file
  // reflects the session that is actually running.
  useEffect(() => {
    if (state.phase !== 'loaded') return;
    const interval = window.setInterval(() => {
      const s = stateRef.current;
      if (s.phase !== 'loaded' || !s.progressFile) return;
      const updated = { ...s.progressFile, last_opened_at: new Date().toISOString() };
      void apiRef.current.saveProgressFile(s.root, updated);
    }, KEEPALIVE_MS);
    return () => window.clearInterval(interval);
  }, [state.phase]);
}
