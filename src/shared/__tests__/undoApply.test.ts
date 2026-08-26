import { describe, it, expect } from 'vitest';
import {
  applyDelta,
  applyOpForward,
  applyOpInverse,
  batchOps,
  countsDeltaForward,
  countsDeltaInverse,
  createUndoStack,
  popRedo,
  popUndo,
  pushOp,
  selectionAfterOp,
  type BBoxLocal,
  type UndoableOp,
  type UndoStack
} from '../undoStack';

function box(id: string, classId = 0, x = 0.5, y = 0.5): BBoxLocal {
  return { id, classId, xCenter: x, yCenter: y, width: 0.1, height: 0.1 };
}

/** Drives a stack the way the reducer does, so undo/redo is exercised end to end. */
function run(start: BBoxLocal[], ops: UndoableOp[]): {
  bboxes: BBoxLocal[];
  stack: UndoStack;
} {
  let bboxes = start;
  let stack = createUndoStack();
  for (const op of ops) {
    bboxes = applyOpForward(bboxes, op);
    stack = pushOp(stack, op);
  }
  return { bboxes, stack };
}

function undoAll(bboxes: BBoxLocal[], stack: UndoStack): BBoxLocal[] {
  let cur = bboxes;
  let s = stack;
  for (;;) {
    const popped = popUndo(s);
    if (!popped) return cur;
    cur = applyOpInverse(cur, popped.op);
    s = popped.next;
  }
}

function redoAll(bboxes: BBoxLocal[], stack: UndoStack): BBoxLocal[] {
  let cur = bboxes;
  let s = stack;
  for (;;) {
    const popped = popRedo(s);
    if (!popped) return cur;
    cur = applyOpForward(cur, popped.op);
    s = popped.next;
  }
}

describe('undo is the exact inverse of every operation', () => {
  const cases: Array<{ name: string; start: BBoxLocal[]; op: UndoableOp }> = [
    {
      name: 'create',
      start: [box('a')],
      op: { kind: 'create', bboxes: [box('b', 1)] }
    },
    {
      name: 'delete',
      start: [box('a'), box('b', 2)],
      op: { kind: 'delete', bboxes: [box('b', 2)] }
    },
    {
      name: 'move',
      start: [box('a', 0, 0.5, 0.5)],
      op: {
        kind: 'move',
        id: 'a',
        from: { xCenter: 0.5, yCenter: 0.5, width: 0.1, height: 0.1 },
        to: { xCenter: 0.8, yCenter: 0.2, width: 0.1, height: 0.1 }
      }
    },
    {
      name: 'resize',
      start: [box('a')],
      op: {
        kind: 'resize',
        id: 'a',
        from: { xCenter: 0.5, yCenter: 0.5, width: 0.1, height: 0.1 },
        to: { xCenter: 0.5, yCenter: 0.5, width: 0.4, height: 0.3 }
      }
    },
    {
      name: 'changeClass',
      start: [box('a', 0), box('b', 3)],
      op: { kind: 'changeClass', ids: ['a', 'b'], from: [0, 3], to: 7 }
    }
  ];

  for (const { name, start, op } of cases) {
    it(`${name}: undo restores the exact previous geometry and classes`, () => {
      const after = applyOpForward(start, op);
      expect(after).not.toEqual(start);
      const back = applyOpInverse(after, op);
      // Order can differ for a delete/undo cycle, so compare as a set keyed by id.
      expect(sortById(back)).toEqual(sortById(start));
    });

    it(`${name}: the class counts return to where they started`, () => {
      const base = { 0: 5, 1: 5, 2: 5, 3: 5, 7: 5 };
      const forward = applyDelta(base, countsDeltaForward(op));
      const back = applyDelta(forward, countsDeltaInverse(op));
      expect(back).toEqual(base);
    });
  }
});

function sortById(bboxes: BBoxLocal[]): BBoxLocal[] {
  return [...bboxes].sort((a, b) => a.id.localeCompare(b.id));
}

describe('a multi-selection drag is one undo step', () => {
  const from = [0.2, 0.4, 0.6];
  const to = [0.3, 0.5, 0.7];
  const start = ['a', 'b', 'c'].map((id, i) => box(id, 0, from[i]!, from[i]!));
  const moves: UndoableOp[] = ['a', 'b', 'c'].map((id, i) => ({
    kind: 'move' as const,
    id,
    from: { xCenter: from[i]!, yCenter: from[i]!, width: 0.1, height: 0.1 },
    to: { xCenter: to[i]!, yCenter: to[i]!, width: 0.1, height: 0.1 }
  }));

  it('moves every box forward and puts every box back with one undo', () => {
    const batched = batchOps(moves);
    expect(batched).not.toBeNull();
    const after = applyOpForward(start, batched!);
    expect(after.map((b) => b.xCenter)).toEqual([0.3, 0.5, 0.7]);

    const { stack } = run(start, [batched!]);
    expect(stack.past).toHaveLength(1);
    expect(undoAll(after, stack)).toEqual(start);
  });

  it('takes one undo slot instead of one per box', () => {
    const perBox = run(start, moves).stack;
    const batched = run(start, [batchOps(moves)!]).stack;
    expect(perBox.past).toHaveLength(3);
    expect(batched.past).toHaveLength(1);
  });

  it('records nothing at all when the drag changed nothing', () => {
    expect(batchOps([])).toBeNull();
  });

  it('unwraps a single-box batch, so a plain drag stays a plain op', () => {
    expect(batchOps([moves[0]!])).toEqual(moves[0]);
  });

  it('undoes the children in reverse order', () => {
    // Two operations on the same box: undoing them in the wrong order would
    // leave it at the intermediate position.
    const twoStep: UndoableOp = {
      kind: 'batch',
      ops: [
        {
          kind: 'move',
          id: 'a',
          from: { xCenter: 0.2, yCenter: 0.2, width: 0.1, height: 0.1 },
          to: { xCenter: 0.5, yCenter: 0.5, width: 0.1, height: 0.1 }
        },
        {
          kind: 'move',
          id: 'a',
          from: { xCenter: 0.5, yCenter: 0.5, width: 0.1, height: 0.1 },
          to: { xCenter: 0.9, yCenter: 0.9, width: 0.1, height: 0.1 }
        }
      ]
    };
    const after = applyOpForward([box('a', 0, 0.2, 0.2)], twoStep);
    expect(after[0]?.xCenter).toBeCloseTo(0.9);
    const back = applyOpInverse(after, twoStep);
    expect(back[0]?.xCenter).toBeCloseTo(0.2);
  });

  it('accounts for every child in the class counts', () => {
    const mixed: UndoableOp = {
      kind: 'batch',
      ops: [
        { kind: 'create', bboxes: [box('x', 1)] },
        { kind: 'delete', bboxes: [box('y', 2)] },
        { kind: 'changeClass', ids: ['z'], from: [1], to: 2 }
      ]
    };
    expect(countsDeltaForward(mixed)).toEqual({ 1: 0, 2: 0 });
    const base = { 1: 10, 2: 10 };
    const forward = applyDelta(base, countsDeltaForward(mixed));
    expect(applyDelta(forward, countsDeltaInverse(mixed))).toEqual(base);
  });
});

describe('a full undo/redo round trip', () => {
  it('returns to the same state after undoing and redoing everything', () => {
    const start = [box('a', 0), box('b', 1)];
    const ops: UndoableOp[] = [
      { kind: 'create', bboxes: [box('c', 2)] },
      { kind: 'changeClass', ids: ['a'], from: [0], to: 2 },
      {
        kind: 'batch',
        ops: [
          {
            kind: 'move',
            id: 'b',
            from: { xCenter: 0.5, yCenter: 0.5, width: 0.1, height: 0.1 },
            to: { xCenter: 0.7, yCenter: 0.3, width: 0.1, height: 0.1 }
          },
          {
            kind: 'resize',
            id: 'c',
            from: { xCenter: 0.5, yCenter: 0.5, width: 0.1, height: 0.1 },
            to: { xCenter: 0.5, yCenter: 0.5, width: 0.25, height: 0.25 }
          }
        ]
      },
      { kind: 'delete', bboxes: [box('a', 2)] }
    ];

    const { bboxes: after, stack } = run(start, ops);

    // Undo everything.
    let cur = after;
    let s = stack;
    for (let i = 0; i < ops.length; i++) {
      const popped = popUndo(s)!;
      cur = applyOpInverse(cur, popped.op);
      s = popped.next;
    }
    expect(sortById(cur)).toEqual(sortById(start));
    expect(s.past).toHaveLength(0);
    expect(s.future).toHaveLength(ops.length);

    // Redo everything.
    const redone = redoAll(cur, s);
    expect(sortById(redone)).toEqual(sortById(after));
  });

  it('leaves the class counts where they started after undoing everything', () => {
    const base: Record<number, number> = { 0: 3, 1: 3, 2: 3 };
    const ops: UndoableOp[] = [
      { kind: 'create', bboxes: [box('c', 2), box('d', 2)] },
      { kind: 'changeClass', ids: ['c'], from: [2], to: 0 },
      { kind: 'delete', bboxes: [box('d', 2)] }
    ];
    let counts = base;
    for (const op of ops) counts = applyDelta(counts, countsDeltaForward(op));
    for (const op of [...ops].reverse()) counts = applyDelta(counts, countsDeltaInverse(op));
    expect(counts).toEqual(base);
  });
});

describe('selection after an operation', () => {
  it('drops boxes that no longer exist and selects the ones that came back', () => {
    const del: UndoableOp = { kind: 'delete', bboxes: [box('a'), box('b')] };
    expect(selectionAfterOp(['a', 'b', 'c'], del, false)).toEqual(['c']);
    expect(selectionAfterOp([], del, true)).toEqual(['a', 'b']);
  });

  it('leaves a moved box selected', () => {
    const mv: UndoableOp = {
      kind: 'move',
      id: 'a',
      from: { xCenter: 0.1, yCenter: 0.1, width: 0.1, height: 0.1 },
      to: { xCenter: 0.2, yCenter: 0.2, width: 0.1, height: 0.1 }
    };
    expect(selectionAfterOp(['a', 'b'], mv, false)).toEqual(['a', 'b']);
    expect(selectionAfterOp(['a', 'b'], mv, true)).toEqual(['a', 'b']);
  });

  it('folds a batch through its children', () => {
    const batch: UndoableOp = {
      kind: 'batch',
      ops: [
        { kind: 'delete', bboxes: [box('a')] },
        { kind: 'create', bboxes: [box('z')] }
      ]
    };
    expect(selectionAfterOp(['a', 'b'], batch, false)).toEqual(['z']);
  });
});

describe('the 50-operation limit', () => {
  it('keeps a batched multi-selection drag from filling the stack', () => {
    // Ten boxes dragged together, twenty times: as one op per box that is 200
    // entries and everything older than the last 50 is unreachable.
    const ids = Array.from({ length: 10 }, (_, i) => `b${i}`);
    const drag = (n: number): UndoableOp =>
      batchOps(
        ids.map((id) => ({
          kind: 'move' as const,
          id,
          from: { xCenter: 0.1 * n, yCenter: 0.5, width: 0.1, height: 0.1 },
          to: { xCenter: 0.1 * (n + 1), yCenter: 0.5, width: 0.1, height: 0.1 }
        }))
      )!;
    let stack = createUndoStack();
    for (let n = 0; n < 20; n++) stack = pushOp(stack, drag(n));
    expect(stack.past).toHaveLength(20);
  });
});
