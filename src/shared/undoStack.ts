import type { BBoxGeometry } from './types';

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
  | { kind: 'changeClass'; ids: string[]; from: number[]; to: number };

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
