import { useCallback, useMemo } from 'react';
import { applyFilter } from '@shared/searchFilter';
import type { ImageIndexEntry } from '@shared/types';
import { getCompletedSet, useDataset } from '../state/datasetStore';

export interface UseImageNavigationResult {
  filteredImages: ImageIndexEntry[];
  goToNext: () => string | null;
  goToPrev: () => string | null;
  goToFirst: () => string | null;
  goToLast: () => string | null;
  goToFirstPending: () => string | null;
  /** Next image still to do inside the current filter, excluding `skipFilename`. */
  findNextPending: (skipFilename: string | null) => string | null;
}

/**
 * Navigation hook. It always works on the currently filtered list and never
 * switches image by itself: it returns the candidate file name and calls the
 * `onSelect` callback, so the caller can route it through requestSelectImage,
 * which flushes pending edits and shows the unsaved-changes dialog.
 */
export function useImageNavigation(
  onSelect: (filename: string) => void
): UseImageNavigationResult {
  const { state } = useDataset();

  const filteredImages = useMemo<ImageIndexEntry[]>(() => {
    if (state.phase !== 'loaded') return [];
    const completedSet = getCompletedSet(state);
    return applyFilter(state.images, state.filter, completedSet);
  }, [state]);

  const currentImage = state.phase === 'loaded' ? state.currentImage : null;

  const goTo = useCallback(
    (filename: string | null): string | null => {
      if (!filename) return null;
      onSelect(filename);
      return filename;
    },
    [onSelect]
  );

  const goToNext = useCallback((): string | null => {
    if (filteredImages.length === 0) return null;
    if (!currentImage) return goTo(filteredImages[0]?.filename ?? null);
    const idx = filteredImages.findIndex((e) => e.filename === currentImage);
    if (idx === -1) return goTo(filteredImages[0]?.filename ?? null);
    if (idx >= filteredImages.length - 1) return null;
    return goTo(filteredImages[idx + 1]?.filename ?? null);
  }, [filteredImages, currentImage, goTo]);

  const goToPrev = useCallback((): string | null => {
    if (filteredImages.length === 0) return null;
    if (!currentImage) return goTo(filteredImages[0]?.filename ?? null);
    const idx = filteredImages.findIndex((e) => e.filename === currentImage);
    if (idx <= 0) return null;
    return goTo(filteredImages[idx - 1]?.filename ?? null);
  }, [filteredImages, currentImage, goTo]);

  const goToFirst = useCallback((): string | null => {
    return goTo(filteredImages[0]?.filename ?? null);
  }, [filteredImages, goTo]);

  const goToLast = useCallback((): string | null => {
    return goTo(filteredImages[filteredImages.length - 1]?.filename ?? null);
  }, [filteredImages, goTo]);

  const goToFirstPending = useCallback((): string | null => {
    if (state.phase !== 'loaded') return null;
    const completedSet = getCompletedSet(state);
    const next = filteredImages.find((e) => !completedSet.has(e.filename));
    return goTo(next?.filename ?? null);
  }, [filteredImages, state, goTo]);

  const findNextPending = useCallback(
    (skipFilename: string | null): string | null => {
      if (state.phase !== 'loaded') return null;
      const completedSet = getCompletedSet(state);
      // Look after the current image, inside the current filter.
      const startIdx = skipFilename
        ? filteredImages.findIndex((e) => e.filename === skipFilename)
        : -1;
      const sliceFrom = startIdx >= 0 ? startIdx + 1 : 0;
      for (let i = sliceFrom; i < filteredImages.length; i++) {
        const candidate = filteredImages[i];
        if (!candidate) continue;
        if (candidate.filename === skipFilename) continue;
        if (!completedSet.has(candidate.filename)) return candidate.filename;
      }
      // Then wrap around, from the start up to (but excluding) startIdx.
      for (let i = 0; i < sliceFrom; i++) {
        const candidate = filteredImages[i];
        if (!candidate) continue;
        if (candidate.filename === skipFilename) continue;
        if (!completedSet.has(candidate.filename)) return candidate.filename;
      }
      return null;
    },
    [filteredImages, state]
  );

  return {
    filteredImages,
    goToNext,
    goToPrev,
    goToFirst,
    goToLast,
    goToFirstPending,
    findNextPending
  };
}
