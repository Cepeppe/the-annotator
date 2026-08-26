import { describe, it, expect } from 'vitest';
import {
  canRedo,
  canUndo,
  createUndoStack,
  popRedo,
  popUndo,
  pushOp,
  UNDO_STACK_LIMIT,
  type UndoableOp
} from '../undoStack';

const opCreate = (id: string): UndoableOp => ({
  kind: 'create',
  bboxes: [{ id, classId: 0, xCenter: 0.5, yCenter: 0.5, width: 0.1, height: 0.1 }]
});

describe('undoStack', () => {
  it('push appends to past and clears future', () => {
    let stack = createUndoStack();
    stack = pushOp(stack, opCreate('a'));
    expect(stack.past).toHaveLength(1);
    expect(stack.future).toHaveLength(0);
    expect(canUndo(stack)).toBe(true);
    expect(canRedo(stack)).toBe(false);
  });

  it('undo moves an op from past to future, preserving order', () => {
    let stack = createUndoStack();
    stack = pushOp(stack, opCreate('a'));
    stack = pushOp(stack, opCreate('b'));
    const popped = popUndo(stack);
    expect(popped).not.toBeNull();
    if (!popped) return;
    expect(popped.op.kind).toBe('create');
    expect(popped.next.past).toHaveLength(1);
    expect(popped.next.future).toHaveLength(1);
    expect(canRedo(popped.next)).toBe(true);
  });

  it('redo moves an op back from future to past', () => {
    let stack = createUndoStack();
    stack = pushOp(stack, opCreate('a'));
    const u = popUndo(stack);
    if (!u) throw new Error('expected undo');
    const r = popRedo(u.next);
    if (!r) throw new Error('expected redo');
    expect(r.next.past).toHaveLength(1);
    expect(r.next.future).toHaveLength(0);
  });

  it('a push after an undo clears the future stack', () => {
    let stack = createUndoStack();
    stack = pushOp(stack, opCreate('a'));
    stack = pushOp(stack, opCreate('b'));
    const u = popUndo(stack);
    if (!u) throw new Error('expected undo');
    expect(canRedo(u.next)).toBe(true);
    const next = pushOp(u.next, opCreate('c'));
    expect(canRedo(next)).toBe(false);
    expect(next.past).toHaveLength(2);
  });

  it(`evicts FIFO past the limit of ${UNDO_STACK_LIMIT} operations`, () => {
    let stack = createUndoStack();
    for (let i = 0; i < UNDO_STACK_LIMIT + 5; i++) {
      stack = pushOp(stack, opCreate(`op${i}`));
    }
    expect(stack.past).toHaveLength(UNDO_STACK_LIMIT);
    // The 5 oldest operations have been dropped.
    const firstId = (stack.past[0] as Extract<UndoableOp, { kind: 'create' }>).bboxes[0]?.id;
    expect(firstId).toBe('op5');
  });

  it('popUndo and popRedo return null on empty stacks', () => {
    const empty = createUndoStack();
    expect(popUndo(empty)).toBeNull();
    expect(popRedo(empty)).toBeNull();
  });
});
