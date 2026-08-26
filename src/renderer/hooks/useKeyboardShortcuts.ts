import { useEffect, useRef } from 'react';
import {
  canRedoCurrent,
  canUndoCurrent,
  getCurrentEditState,
  nextBboxId,
  useDataset,
  type EditMode
} from '../state/datasetStore';
import type { BBoxLocal } from '@shared/undoStack';
import type { BBoxGeometry } from '@shared/types';
import { clampGeometry01 } from '@shared/bboxMath';

interface UseKeyboardShortcutsOptions {
  onSaveNow: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onMarkCompletedAndNext: () => void;
  onMarkPending: () => void;
  onNavNext: () => void;
  onNavPrev: () => void;
  onNavFirst: () => void;
  onNavLast: () => void;
  onShowShortcutHelp: () => void;
  /**
   * Fired by Backspace or Shift+Del when images are selected in the list and no
   * box is selected on the canvas. Never fired by a plain `Del`, which would be
   * too easy to confuse with deleting a box.
   */
  onRequestDeleteSelectedImages: () => void;
}

const NUMERIC_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

function digitToClassId(digit: string): number {
  return digit === '0' ? 9 : Number.parseInt(digit, 10) - 1;
}

function isFromInput(target: EventTarget | null): boolean {
  const t = target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (t.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(opts: UseKeyboardShortcutsOptions): void {
  const { state, dispatch } = useDataset();
  const stateRef = useRef(state);
  stateRef.current = state;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (isFromInput(e.target)) return;
      const s = stateRef.current;
      if (s.phase !== 'loaded') return;
      const dp = dispatchRef.current;
      const opts = optsRef.current;

      // Ctrl+Shift+M: mark as to do
      if (
        e.key.toLowerCase() === 'm' &&
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey
      ) {
        e.preventDefault();
        opts.onMarkPending();
        return;
      }
      // Ctrl+S
      if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        opts.onSaveNow();
        return;
      }
      // Ctrl+Z
      if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        if (canUndoCurrent(s)) dp({ type: 'UNDO' });
        return;
      }
      // Ctrl+Y / Ctrl+Shift+Z
      if (
        ((e.key.toLowerCase() === 'y' && (e.ctrlKey || e.metaKey)) ||
          (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey))
      ) {
        e.preventDefault();
        if (canRedoCurrent(s)) dp({ type: 'REDO' });
        return;
      }
      // Ctrl+C
      if (e.key.toLowerCase() === 'c' && (e.ctrlKey || e.metaKey)) {
        const edit = getCurrentEditState(s);
        if (!edit || s.selectedBboxIds.length === 0) return;
        e.preventDefault();
        const selected = edit.bboxes.filter((b) => s.selectedBboxIds.includes(b.id));
        const clipboard = selected.map(({ classId, xCenter, yCenter, width, height }) => ({
          classId,
          xCenter,
          yCenter,
          width,
          height
        }));
        dp({ type: 'SET_CLIPBOARD', bboxes: clipboard });
        return;
      }
      // Ctrl+V
      if (e.key.toLowerCase() === 'v' && (e.ctrlKey || e.metaKey)) {
        if (s.clipboard.length === 0 || !s.currentImage) return;
        e.preventDefault();
        const edit = getCurrentEditState(s);
        if (!edit || !edit.imageSize) return;
        // Centre of the current viewport, in image coordinates.
        const center = viewportCenterInImage(s.view, edit.imageSize);
        // Centre of the copied cluster, so the paste lands centred.
        const srcMinX = Math.min(...s.clipboard.map((b) => b.xCenter - b.width / 2));
        const srcMaxX = Math.max(...s.clipboard.map((b) => b.xCenter + b.width / 2));
        const srcMinY = Math.min(...s.clipboard.map((b) => b.yCenter - b.height / 2));
        const srcMaxY = Math.max(...s.clipboard.map((b) => b.yCenter + b.height / 2));
        const srcCx = (srcMinX + srcMaxX) / 2;
        const srcCy = (srcMinY + srcMaxY) / 2;
        const dx = center.x - srcCx;
        const dy = center.y - srcCy;
        const newBboxes: BBoxLocal[] = s.clipboard.map((b) => {
          const moved: BBoxGeometry = clampGeometry01({
            xCenter: b.xCenter + dx,
            yCenter: b.yCenter + dy,
            width: b.width,
            height: b.height
          });
          return { id: nextBboxId(), classId: b.classId, ...moved };
        });
        dp({ type: 'APPLY_OP', op: { kind: 'create', bboxes: newBboxes } });
        return;
      }
      // Shift+Del: request deletion of the selected images (never a plain Del).
      if (e.key === 'Delete' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (s.selectedBboxIds.length > 0) return; // boxes take priority
        if (s.selectedGridImages.length === 0) return;
        e.preventDefault();
        opts.onRequestDeleteSelectedImages();
        return;
      }
      // Backspace: delete the selected boxes when there are any; otherwise, if
      // images are selected in the list, open the delete confirmation. Never
      // with Shift, which is handled above.
      if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (s.selectedBboxIds.length > 0) {
          const edit = getCurrentEditState(s);
          if (!edit) return;
          const targets = edit.bboxes.filter((b) => s.selectedBboxIds.includes(b.id));
          if (targets.length === 0) return;
          e.preventDefault();
          dp({ type: 'APPLY_OP', op: { kind: 'delete', bboxes: targets } });
          return;
        }
        if (s.selectedGridImages.length > 0) {
          e.preventDefault();
          opts.onRequestDeleteSelectedImages();
          return;
        }
        return;
      }
      // Plain Del (no Shift) only ever deletes boxes on the canvas.
      if (e.key === 'Delete' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (s.selectedBboxIds.length === 0) return;
        const edit = getCurrentEditState(s);
        if (!edit) return;
        const targets = edit.bboxes.filter((b) => s.selectedBboxIds.includes(b.id));
        if (targets.length === 0) return;
        e.preventDefault();
        dp({ type: 'APPLY_OP', op: { kind: 'delete', bboxes: targets } });
        return;
      }
      // Esc clears both the box selection and the image selection.
      if (e.key === 'Escape') {
        if (s.selectedBboxIds.length > 0) {
          dp({ type: 'CLEAR_SELECTION' });
        }
        if (s.selectedGridImages.length > 0) {
          dp({ type: 'CLEAR_GRID_SELECTION' });
        }
        return;
      }
      // ? or F1 opens the shortcut help. On a US layout `?` is Shift+/, and on
      // other layouts the browser still reports `e.key === '?'` whenever the
      // printed character is `?`. Modifier keys are excluded so this does not
      // shadow other combinations (Ctrl+F1 in DevTools, for one).
      if (
        (e.key === '?' || e.key === 'F1') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        opts.onShowShortcutHelp();
        return;
      }
      // Space marks the image done and moves on, unless a box is selected.
      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (s.selectedBboxIds.length > 0) return;
        e.preventDefault();
        opts.onMarkCompletedAndNext();
        return;
      }
      // Keyboard navigation over the filtered list: down/J next, up/K previous.
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (e.key === 'ArrowDown' || e.key.toLowerCase() === 'j') {
          e.preventDefault();
          opts.onNavNext();
          return;
        }
        if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'k') {
          e.preventDefault();
          opts.onNavPrev();
          return;
        }
        if (e.key === 'Home') {
          e.preventDefault();
          opts.onNavFirst();
          return;
        }
        if (e.key === 'End') {
          e.preventDefault();
          opts.onNavLast();
          return;
        }
      }
      // Mode shortcuts: S, D
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 's' && s.mode !== 'select') {
          dp({ type: 'SET_MODE', mode: 'select' as EditMode });
          return;
        }
        if (k === 'd' && s.mode !== 'draw') {
          dp({ type: 'SET_MODE', mode: 'draw' as EditMode });
          return;
        }
        // Zoom keys: + - R
        if (e.key === '+' || (e.key === '=' && e.shiftKey === false)) {
          e.preventDefault();
          opts.onZoomIn();
          return;
        }
        if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          opts.onZoomOut();
          return;
        }
        if (k === 'r') {
          e.preventDefault();
          opts.onResetZoom();
          return;
        }
      }
      // Numeric class shortcuts
      if (NUMERIC_KEYS.includes(e.key)) {
        const baseId = digitToClassId(e.key);
        const targetId = e.ctrlKey || e.metaKey ? baseId + 10 : baseId;
        if (targetId < 0 || targetId >= s.classes.length) return;
        e.preventDefault();
        if (s.selectedBboxIds.length > 0) {
          const edit = getCurrentEditState(s);
          if (!edit) return;
          const ids = s.selectedBboxIds;
          const fromArr = ids.map((id) => edit.bboxes.find((b) => b.id === id)?.classId ?? targetId);
          dp({
            type: 'APPLY_OP',
            op: { kind: 'changeClass', ids, from: fromArr, to: targetId }
          });
        } else {
          dp({ type: 'SET_CURRENT_CLASS_ID', classId: targetId });
        }
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

function viewportCenterInImage(
  view: { zoom: number; panX: number; panY: number },
  imgSize: { width: number; height: number }
): { x: number; y: number } {
  // Reach the canvas container through the DOM to size the viewport: the
  // canvas element itself is owned by Fabric.
  const canvasEl = document.querySelector<HTMLCanvasElement>('canvas');
  const containerW = canvasEl?.parentElement?.clientWidth ?? imgSize.width;
  const containerH = canvasEl?.parentElement?.clientHeight ?? imgSize.height;
  const screenCx = containerW / 2;
  const screenCy = containerH / 2;
  const imgX = (screenCx - view.panX) / view.zoom;
  const imgY = (screenCy - view.panY) / view.zoom;
  // Clamp inside the image, so a paste always lands on visible pixels.
  return {
    x: Math.min(imgSize.width, Math.max(0, imgX)),
    y: Math.min(imgSize.height, Math.max(0, imgY))
  };
}
