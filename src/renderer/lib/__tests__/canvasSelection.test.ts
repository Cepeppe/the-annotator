import { describe, it, expect } from 'vitest';
import { ActiveSelection, Rect, type Object as FabricObject } from 'fabric';
import { bboxIdOf, withSelectionSuspended, type SelectionHost } from '../canvasSelection';

type TaggedRect = Rect & { __bboxId: string };

function rect(id: string, left: number, top: number): TaggedRect {
  const r = new Rect({
    originX: 'left',
    originY: 'top',
    left,
    top,
    width: 50,
    height: 50,
    // Fabric counts the stroke in an object's bounds; zero keeps the numbers
    // below exact instead of off by half a pixel.
    strokeWidth: 0
  }) as TaggedRect;
  r.__bboxId = id;
  return r;
}

/**
 * Stands in for the Fabric Canvas. Selecting and deselecting go through the
 * same ActiveSelection machinery the real canvas uses (Canvas.setActiveObject
 * groups the objects, and discardActiveObject calls onDeselect, which is
 * removeAll), so the coordinate bookkeeping under test is the real one.
 */
function fakeHost(): SelectionHost & { active: FabricObject | null } {
  const host = {
    active: null as FabricObject | null,
    getActiveObjects(): FabricObject[] {
      const a = host.active;
      if (!a) return [];
      const children = (a as unknown as { _objects?: FabricObject[] })._objects;
      return children ?? [a];
    },
    discardActiveObject(): void {
      const a = host.active as unknown as { removeAll?: () => void } | null;
      a?.removeAll?.();
      host.active = null;
    },
    setActiveObject(obj: FabricObject): void {
      host.active = obj;
    },
    makeMultiSelection(objects: FabricObject[]): FabricObject {
      return new ActiveSelection(objects) as unknown as FabricObject;
    }
  };
  return host;
}

/** What syncBboxes does to each box: image coordinates straight onto the rect. */
function writeImageCoords(r: Rect, left: number, top: number): void {
  r.set({ left, top, width: 50, height: 50, scaleX: 1, scaleY: 1 });
  r.setCoords();
}

describe('the coordinate model this guard exists for', () => {
  it('makes a multi-selected box report offsets, not image coordinates', () => {
    const a = rect('a', 100, 100);
    const b = rect('b', 300, 300);
    new ActiveSelection([a, b]);
    // Still at (100,100) in the image, but its own left/top now say otherwise.
    expect(a.left).not.toBe(100);
    expect(a.getCenterPoint().x).toBeCloseTo(125);
  });

  it('displaces the box when image coordinates are written while it is grouped', () => {
    const a = rect('a', 100, 100);
    const b = rect('b', 300, 300);
    const sel = new ActiveSelection([a, b]);
    // The store says this box belongs at (150,150).
    writeImageCoords(a, 150, 150);
    sel.removeAll();
    // It ends up nowhere near there. This is the bug the helper prevents.
    expect(a.left).not.toBeCloseTo(150);
  });
});

describe('withSelectionSuspended', () => {
  it('lets image coordinates be written correctly under a multi-selection', () => {
    const a = rect('a', 100, 100);
    const b = rect('b', 300, 300);
    const byId = new Map<string, TaggedRect>([
      ['a', a],
      ['b', b]
    ]);
    const host = fakeHost();
    host.setActiveObject(host.makeMultiSelection([a, b]));

    withSelectionSuspended(
      host,
      (id) => byId.get(id),
      () => {
        writeImageCoords(a, 150, 150);
        writeImageCoords(b, 400, 400);
      }
    );

    // The boxes are where the store put them.
    expect(a.getCenterPoint().x).toBeCloseTo(175);
    expect(a.getCenterPoint().y).toBeCloseTo(175);
    expect(b.getCenterPoint().x).toBeCloseTo(425);
    expect(b.getCenterPoint().y).toBeCloseTo(425);
  });

  it('puts the multi-selection back afterwards', () => {
    const a = rect('a', 100, 100);
    const b = rect('b', 300, 300);
    const byId = new Map([
      ['a', a],
      ['b', b]
    ]);
    const host = fakeHost();
    host.setActiveObject(host.makeMultiSelection([a, b]));

    withSelectionSuspended(host, (id) => byId.get(id), () => undefined);

    expect(host.getActiveObjects().map(bboxIdOf).sort()).toEqual(['a', 'b']);
  });

  it('leaves out a box the operation deleted', () => {
    // Undoing a "create" removes the very box that was selected.
    const a = rect('a', 100, 100);
    const b = rect('b', 300, 300);
    const byId = new Map([
      ['a', a],
      ['b', b]
    ]);
    const host = fakeHost();
    host.setActiveObject(host.makeMultiSelection([a, b]));

    withSelectionSuspended(
      host,
      (id) => byId.get(id),
      () => {
        byId.delete('b');
      }
    );

    expect(host.getActiveObjects().map(bboxIdOf)).toEqual(['a']);
    // And 'a' is back to a plain single selection, at its real position.
    expect(a.getCenterPoint().x).toBeCloseTo(125);
  });

  it('selects nothing when every selected box is gone', () => {
    const a = rect('a', 100, 100);
    const b = rect('b', 300, 300);
    const byId = new Map([
      ['a', a],
      ['b', b]
    ]);
    const host = fakeHost();
    host.setActiveObject(host.makeMultiSelection([a, b]));

    withSelectionSuspended(
      host,
      (id) => byId.get(id),
      () => {
        byId.clear();
      }
    );

    expect(host.active).toBeNull();
  });

  it('does not force an unselectable box back into the selection', () => {
    // Switching to draw mode makes every box selectable: false.
    const a = rect('a', 100, 100);
    const b = rect('b', 300, 300);
    const byId = new Map([
      ['a', a],
      ['b', b]
    ]);
    const host = fakeHost();
    host.setActiveObject(host.makeMultiSelection([a, b]));

    withSelectionSuspended(
      host,
      (id) => byId.get(id),
      () => {
        a.selectable = false;
        b.selectable = false;
      }
    );

    expect(host.active).toBeNull();
  });

  it('does nothing at all when nothing was selected', () => {
    const a = rect('a', 100, 100);
    const byId = new Map([['a', a]]);
    const host = fakeHost();

    withSelectionSuspended(
      host,
      (id) => byId.get(id),
      () => writeImageCoords(a, 150, 150)
    );

    expect(host.active).toBeNull();
    expect(a.left).toBe(150);
  });

  it('restores the selection even when the mutation throws', () => {
    const a = rect('a', 100, 100);
    const b = rect('b', 300, 300);
    const byId = new Map([
      ['a', a],
      ['b', b]
    ]);
    const host = fakeHost();
    host.setActiveObject(host.makeMultiSelection([a, b]));

    expect(() =>
      withSelectionSuspended(
        host,
        (id) => byId.get(id),
        () => {
          throw new Error('boom');
        }
      )
    ).toThrow('boom');
    expect(host.getActiveObjects().map(bboxIdOf).sort()).toEqual(['a', 'b']);
  });
});

describe('bboxIdOf', () => {
  it('returns the id for a tagged rect and null for anything else', () => {
    expect(bboxIdOf(rect('a', 0, 0))).toBe('a');
    expect(bboxIdOf(new Rect({ left: 0, top: 0 }))).toBeNull();
    expect(bboxIdOf(null)).toBeNull();
    expect(bboxIdOf(undefined)).toBeNull();
  });
});
