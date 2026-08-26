import { describe, it, expect } from 'vitest';
import { reorderClasses, reorderIdMapping } from '../classOps';

describe('reorderClasses', () => {
  it('moves the entry to the requested position', () => {
    expect(reorderClasses(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(reorderClasses(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(reorderClasses(['a', 'b', 'c'], 1, 2)).toEqual(['a', 'c', 'b']);
  });

  it('rejects an index outside the list', () => {
    expect(reorderClasses(['a', 'b'], -1, 0)).toBeNull();
    expect(reorderClasses(['a', 'b'], 0, 5)).toBeNull();
  });
});

describe('reorderIdMapping', () => {
  it('is empty for a no-op or an invalid move', () => {
    expect(reorderIdMapping(3, 1, 1).size).toBe(0);
    expect(reorderIdMapping(3, 9, 0).size).toBe(0);
    expect(reorderIdMapping(3, 0, 9).size).toBe(0);
  });

  it('only lists the ids that actually change', () => {
    // Moving index 2 to 0 in a 4-entry list leaves index 3 alone.
    expect([...reorderIdMapping(4, 2, 0).entries()].sort()).toEqual([
      [0, 1],
      [1, 2],
      [2, 0]
    ]);
  });

  it('matches where each entry actually lands, for every possible move', () => {
    for (let length = 2; length <= 6; length++) {
      // Unique names, so indexOf is a valid reference here even though the
      // production code must not rely on uniqueness.
      const classes = Array.from({ length }, (_, i) => `c${i}`);
      for (let from = 0; from < length; from++) {
        for (let to = 0; to < length; to++) {
          const reordered = reorderClasses(classes, from, to)!;
          const map = reorderIdMapping(length, from, to);
          for (let oldId = 0; oldId < length; oldId++) {
            const expected = reordered.indexOf(classes[oldId]!);
            expect(map.get(oldId) ?? oldId).toBe(expected);
          }
        }
      }
    }
  });

  it('is a permutation: no two old ids collide on the same new id', () => {
    for (let length = 2; length <= 6; length++) {
      for (let from = 0; from < length; from++) {
        for (let to = 0; to < length; to++) {
          const map = reorderIdMapping(length, from, to);
          const targets = new Set<number>();
          for (let oldId = 0; oldId < length; oldId++) {
            targets.add(map.get(oldId) ?? oldId);
          }
          expect(targets.size).toBe(length);
        }
      }
    }
  });

  it('stays a permutation when the class names repeat', () => {
    // The case a name-based mapping gets wrong: two entries called "car".
    const map = reorderIdMapping(4, 2, 0);
    expect(map.get(0)).toBe(1);
    expect(map.get(1)).toBe(2);
    expect(map.get(2)).toBe(0);
    expect(map.get(3)).toBeUndefined();
  });
});
