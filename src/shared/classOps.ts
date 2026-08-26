/**
 * Class-list arithmetic shared by the main process (which rewrites the .txt
 * files) and the renderer (which remaps the boxes it is holding in memory).
 * Both sides have to agree exactly, or a bulk operation leaves the canvas
 * showing different classes than the files on disk.
 */

/**
 * old_id -> new_id map for moving the entry at `fromIndex` to `toIndex`.
 *
 * Derived from the two positions alone, never by looking a name up in the
 * reordered list: a data.yaml written by another tool may well repeat a name,
 * and `indexOf` would then map both copies onto the same id and silently
 * rewrite the wrong annotations.
 *
 * Only the ids that actually change are in the map.
 *
 * Example: length=3, fromIndex=2, toIndex=0  ->  {2: 0, 0: 1, 1: 2}
 */
export function reorderIdMapping(
  length: number,
  fromIndex: number,
  toIndex: number
): Map<number, number> {
  const map = new Map<number, number>();
  if (fromIndex === toIndex) return map;
  if (fromIndex < 0 || fromIndex >= length || toIndex < 0 || toIndex >= length) return map;
  map.set(fromIndex, toIndex);
  const lo = Math.min(fromIndex, toIndex);
  const hi = Math.max(fromIndex, toIndex);
  // Everything between the two positions shifts one slot the other way.
  const shift = fromIndex < toIndex ? -1 : 1;
  for (let oldId = lo; oldId <= hi; oldId++) {
    if (oldId === fromIndex) continue;
    map.set(oldId, oldId + shift);
  }
  return map;
}

/** Applies `reorderIdMapping`'s move to the class-name list itself. */
export function reorderClasses(
  classes: string[],
  fromIndex: number,
  toIndex: number
): string[] | null {
  if (fromIndex < 0 || fromIndex >= classes.length) return null;
  if (toIndex < 0 || toIndex >= classes.length) return null;
  const next = [...classes];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return null;
  next.splice(toIndex, 0, moved);
  return next;
}
