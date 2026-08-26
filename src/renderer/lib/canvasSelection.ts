import type { Object as FabricObject } from 'fabric';

/**
 * Fabric keeps a selected object's `left`/`top` in its parent's coordinate
 * space. As soon as two or more boxes are multi-selected they become children
 * of an ActiveSelection, and their `left`/`top` turn into offsets from the
 * selection's centre rather than positions in the image.
 *
 * That matters every time the store pushes new geometry onto the canvas
 * (an undo, a redo, a class change, the end of a multi-box drag): writing image
 * coordinates straight onto a box that is currently inside a selection moves it
 * by the selection's offset. With a selection centred at (225, 225), a box the
 * store places at (150, 150) ends up at (375, 375) — and the next drag then
 * writes that wrong position back to the .txt file.
 *
 * The fix is to take the selection apart before touching the boxes and put it
 * back afterwards, which is what `withSelectionSuspended` does.
 */

export interface SelectionHost {
  getActiveObjects(): FabricObject[];
  discardActiveObject(): void;
  setActiveObject(obj: FabricObject): void;
  /** Builds the object Fabric uses to represent a multi-box selection. */
  makeMultiSelection(objects: FabricObject[]): FabricObject;
}

/** The bbox id carried by a canvas rectangle, or null for anything else. */
export function bboxIdOf(obj: FabricObject | null | undefined): string | null {
  const id = (obj as Partial<{ __bboxId: string }> | null | undefined)?.__bboxId;
  return typeof id === 'string' ? id : null;
}

/**
 * Runs `mutate` with nothing selected, then restores the selection from the
 * ids that were selected before.
 *
 * `resolve` returns the object for an id, or undefined when the operation
 * removed it: undoing a "create" deletes the very box that was selected, and it
 * must not come back into the restored selection.
 */
export function withSelectionSuspended(
  host: SelectionHost,
  resolve: (id: string) => FabricObject | undefined,
  mutate: () => void
): void {
  const ids: string[] = [];
  for (const obj of host.getActiveObjects()) {
    const id = bboxIdOf(obj);
    if (id !== null) ids.push(id);
  }

  if (ids.length > 0) host.discardActiveObject();
  try {
    mutate();
  } finally {
    if (ids.length > 0) {
      const survivors: FabricObject[] = [];
      for (const id of ids) {
        const obj = resolve(id);
        // A box that is not selectable right now (draw mode) must not be forced
        // back into a selection.
        if (obj && obj.selectable) survivors.push(obj);
      }
      if (survivors.length === 1) {
        host.setActiveObject(survivors[0]!);
      } else if (survivors.length > 1) {
        host.setActiveObject(host.makeMultiSelection(survivors));
      }
    }
  }
}
