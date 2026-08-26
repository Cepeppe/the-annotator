import type { BBoxGeometry } from './types';
import { clampGeometry01 } from './bboxMath';

export interface BBoxLocal {
  id: string;
  classId: number;
  xCenter: number;
  yCenter: number;
  width: number;
  height: number;
}

export type UndoableOp =
  | { kind: 'create'; bboxes: BBoxLocal[] }
  | { kind: 'delete'; bboxes: BBoxLocal[] }
  | { kind: 'move'; id: string; from: BBoxGeometry; to: BBoxGeometry }
  | { kind: 'resize'; id: string; from: BBoxGeometry; to: BBoxGeometry }
  | { kind: 'changeClass'; ids: string[]; from: number[]; to: number }
  /**
   * Several operations the user performed as one gesture: dragging a
   * multi-selection moves every box in it, and one Ctrl+Z has to put all of
   * them back. Applied in order, undone in reverse order.
   */
  | { kind: 'batch'; ops: UndoableOp[] };

export interface UndoStack {
  past: UndoableOp[];
  future: UndoableOp[];
}

const MAX_OPS_PER_IMAGE = 50;

export function createUndoStack(): UndoStack {
  return { past: [], future: [] };
}

export function pushOp(stack: UndoStack, op: UndoableOp): UndoStack {
  const past = [...stack.past, op];
  while (past.length > MAX_OPS_PER_IMAGE) past.shift();
  return { past, future: [] };
}

export function canUndo(stack: UndoStack): boolean {
  return stack.past.length > 0;
}

export function canRedo(stack: UndoStack): boolean {
  return stack.future.length > 0;
}

export function popUndo(stack: UndoStack): { op: UndoableOp; next: UndoStack } | null {
  if (stack.past.length === 0) return null;
  const op = stack.past[stack.past.length - 1]!;
  const past = stack.past.slice(0, -1);
  const future = [op, ...stack.future];
  return { op, next: { past, future } };
}

export function popRedo(stack: UndoStack): { op: UndoableOp; next: UndoStack } | null {
  if (stack.future.length === 0) return null;
  const op = stack.future[0]!;
  const future = stack.future.slice(1);
  const past = [...stack.past, op];
  return { op, next: { past, future } };
}

export function clearStack(): UndoStack {
  return createUndoStack();
}

export const UNDO_STACK_LIMIT = MAX_OPS_PER_IMAGE;

/**
 * Wraps several operations into one undo step. Returns the single op unchanged
 * when there is only one, and null when there is nothing to record: a gesture
 * that turned out to change nothing must not eat an undo slot.
 */
export function batchOps(ops: UndoableOp[]): UndoableOp | null {
  if (ops.length === 0) return null;
  if (ops.length === 1) return ops[0]!;
  return { kind: 'batch', ops };
}

// ---------------------------------------------------------------------------
// Applying an operation. These are pure so the reducer stays a thin wrapper and
// the rewind logic can be tested on its own.
// ---------------------------------------------------------------------------

export function applyOpForward(bboxes: BBoxLocal[], op: UndoableOp): BBoxLocal[] {
  switch (op.kind) {
    case 'create':
      return [...bboxes, ...op.bboxes];
    case 'delete': {
      const ids = new Set(op.bboxes.map((b) => b.id));
      return bboxes.filter((b) => !ids.has(b.id));
    }
    case 'move':
    case 'resize':
      return bboxes.map((b) => (b.id === op.id ? { ...b, ...clampGeometry01(op.to) } : b));
    case 'changeClass': {
      const ids = new Set(op.ids);
      return bboxes.map((b) => (ids.has(b.id) ? { ...b, classId: op.to } : b));
    }
    case 'batch':
      return op.ops.reduce(applyOpForward, bboxes);
    default:
      return bboxes;
  }
}

export function applyOpInverse(bboxes: BBoxLocal[], op: UndoableOp): BBoxLocal[] {
  switch (op.kind) {
    case 'create': {
      const ids = new Set(op.bboxes.map((b) => b.id));
      return bboxes.filter((b) => !ids.has(b.id));
    }
    case 'delete':
      return [...bboxes, ...op.bboxes];
    case 'move':
    case 'resize':
      return bboxes.map((b) => (b.id === op.id ? { ...b, ...clampGeometry01(op.from) } : b));
    case 'changeClass': {
      const fromById = new Map<string, number>();
      op.ids.forEach((id, idx) => fromById.set(id, op.from[idx] ?? op.to));
      return bboxes.map((b) =>
        fromById.has(b.id) ? { ...b, classId: fromById.get(b.id)! } : b
      );
    }
    case 'batch':
      // Reverse order: the last thing done is the first thing undone.
      return [...op.ops].reverse().reduce(applyOpInverse, bboxes);
    default:
      return bboxes;
  }
}

// ---------------------------------------------------------------------------
// Per-class annotation counts. The sidebar keeps a running total instead of
// rescanning every .txt after each edit, so every operation has to report the
// difference it makes in both directions.
// ---------------------------------------------------------------------------

export function countsDeltaForward(op: UndoableOp): Record<number, number> {
  const delta: Record<number, number> = {};
  accumulateDelta(delta, op, false);
  return delta;
}

export function countsDeltaInverse(op: UndoableOp): Record<number, number> {
  const delta: Record<number, number> = {};
  accumulateDelta(delta, op, true);
  return delta;
}

function accumulateDelta(
  delta: Record<number, number>,
  op: UndoableOp,
  inverse: boolean
): void {
  const sign = inverse ? -1 : 1;
  const bump = (classId: number, by: number): void => {
    delta[classId] = (delta[classId] ?? 0) + by * sign;
  };
  switch (op.kind) {
    case 'create':
      for (const b of op.bboxes) bump(b.classId, 1);
      break;
    case 'delete':
      for (const b of op.bboxes) bump(b.classId, -1);
      break;
    case 'changeClass':
      for (let i = 0; i < op.ids.length; i++) {
        const from = op.from[i] ?? op.to;
        if (from === op.to) continue;
        bump(from, -1);
        bump(op.to, 1);
      }
      break;
    case 'batch':
      for (const child of op.ops) accumulateDelta(delta, child, inverse);
      break;
    default:
      break;
  }
}

export function applyDelta(
  base: Record<number, number>,
  delta: Record<number, number>
): Record<number, number> {
  const next: Record<number, number> = { ...base };
  for (const [k, v] of Object.entries(delta)) {
    const id = Number(k);
    next[id] = (next[id] ?? 0) + v;
    if (next[id]! < 0) next[id] = 0;
  }
  return next;
}

/**
 * What stays selected after an operation is applied or undone: a box that no
 * longer exists must not stay in the selection, and a box that just came back
 * is the natural thing to have selected.
 */
export function selectionAfterOp(
  selection: string[],
  op: UndoableOp,
  isInverse: boolean
): string[] {
  if (op.kind === 'delete') {
    if (isInverse) return op.bboxes.map((b) => b.id);
    return selection.filter((id) => !op.bboxes.some((b) => b.id === id));
  }
  if (op.kind === 'create') {
    if (isInverse) return selection.filter((id) => !op.bboxes.some((b) => b.id === id));
    return op.bboxes.map((b) => b.id);
  }
  if (op.kind === 'batch') {
    const ordered = isInverse ? [...op.ops].reverse() : op.ops;
    return ordered.reduce((sel, child) => selectionAfterOp(sel, child, isInverse), selection);
  }
  return selection;
}
