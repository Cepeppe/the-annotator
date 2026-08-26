import { useEffect, useRef, useState } from 'react';
import {
  ActiveSelection,
  Canvas,
  FabricImage,
  FabricText,
  Point,
  Rect,
  type Object as FabricObject,
  type TPointerEventInfo,
  type TPointerEvent
} from 'fabric';
import type { BBoxYolo } from '@shared/types';
import { useApi } from '../hooks/useApi';
import { classNameToColor } from '@shared/colorPalette';
import {
  getCurrentEditState,
  nextBboxId,
  useDataset,
  type EditMode,
  type ViewState
} from '../state/datasetStore';
import type { BBoxLocal } from '@shared/undoStack';
import { clampGeometry01 } from '@shared/bboxMath';
import { plural } from '@shared/i18n';
import { t as translate, useT } from '../i18n';

interface CanvasViewProps {
  datasetRoot: string;
  imageFilename: string | null;
  classes: string[];
}

interface LoadedImage {
  filename: string;
  width: number;
  height: number;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const MIN_DRAW_SCREEN_PX = 5;
const MAX_BBOX_FOR_CACHING = 50;
// The top ruler is thin; the left one is wider so horizontal labels of 4-5
// digits ("2560", "9999") fit without being clipped.
export const RULER_TOP_SIZE = 22;
export const RULER_LEFT_SIZE = 36;
// The grid is fixed at every 50 image pixels. The minor ruler ticks use the
// same step, so every grid line lines up with one. Major ticks are the first
// multiple of GRID_STEP that leaves at least RULER_MIN_MAJOR_PX on screen,
// which keeps the labels from overlapping.
const GRID_STEP = 50;
const RULER_MIN_MAJOR_PX = 80;

interface BBoxFabricUserdata {
  __bboxId: string;
  __classId: number;
  __label: FabricText;
}
type LabeledRect = Rect & BBoxFabricUserdata;

function isLabeledRect(obj: FabricObject | undefined | null): obj is LabeledRect {
  return Boolean(obj && (obj as Partial<BBoxFabricUserdata>).__bboxId);
}

function colorForClass(classes: string[], classId: number): string {
  const name = classes[classId];
  return name ? classNameToColor(name).hex : '#ff3333';
}

function labelTextFor(classes: string[], classId: number): string {
  const name = classes[classId];
  return name ?? translate('canvas.unknownClass', { classId });
}

export function CanvasView({
  datasetRoot,
  imageFilename,
  classes
}: CanvasViewProps): JSX.Element {
  const api = useApi();
  const t = useT();
  const { state, dispatch } = useDataset();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const loadedRef = useRef<LoadedImage | null>(null);
  const generationRef = useRef(0);
  const rectsByIdRef = useRef<Map<string, LabeledRect>>(new Map());
  const isSyncingRef = useRef(false);
  const drawingRef = useRef<{ start: Point; ghost: Rect } | null>(null);
  const lastViewSentRef = useRef<ViewState | null>(null);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const topRulerRef = useRef<HTMLCanvasElement>(null);
  const leftRulerRef = useRef<HTMLCanvasElement>(null);

  // Refreshed on every render and read by the Fabric listeners, which are
  // registered once and would otherwise capture stale values.
  const modeRef = useRef<EditMode>('select');
  const currentClassIdRef = useRef(0);
  const bboxesRef = useRef<BBoxLocal[]>([]);
  const classesRef = useRef<string[]>([]);
  const lockZoomRef = useRef(false);
  const showPixelGridRef = useRef(false);
  const showRulersRef = useRef(false);

  const [status, setStatus] = useState<'empty' | 'loading' | 'ready' | 'error'>('empty');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // CanvasView is only mounted by AppLayout while phase === 'loaded'; the safe
  // defaults below are pure defence in depth.
  const isLoaded = state.phase === 'loaded';
  const editState = isLoaded ? getCurrentEditState(state) : null;
  const bboxes = editState?.bboxes ?? [];
  const view = isLoaded ? state.view : { zoom: 1, panX: 0, panY: 0 };
  const mode = isLoaded ? state.mode : 'select';
  const selection = isLoaded ? state.selectedBboxIds : [];
  const lockZoom = isLoaded ? state.lockZoom : false;
  const currentClassId = isLoaded ? state.currentClassId : 0;
  const showPixelGrid = isLoaded ? state.userSettings.showPixelGrid : false;
  const showRulers = isLoaded ? state.userSettings.showRulers : false;

  modeRef.current = mode;
  currentClassIdRef.current = currentClassId;
  bboxesRef.current = bboxes;
  classesRef.current = classes;
  lockZoomRef.current = lockZoom;
  showPixelGridRef.current = showPixelGrid;
  showRulersRef.current = showRulers;

  // ---- Init Fabric canvas (one-time)
  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;
    const fabric = new Canvas(el, {
      selection: true,
      preserveObjectStacking: true,
      backgroundColor: '#1f1f23',
      renderOnAddRemove: false,
      fireRightClick: false,
      stopContextMenu: true,
      uniformScaling: false
    });
    fabricRef.current = fabric;
    // Fabric wraps the original <canvas> in a <div class="canvas-container">
    // to manage its upper and lower canvases. That wrapper defaults to
    // position:relative at the canvas size (300x150 until setDimensions runs),
    // and it does not inherit the Tailwind classes of the original element, so
    // it sits at the top-left of the container as a plain block. Only the
    // absolute positioning is forced here: width and height are owned by
    // fabric.setDimensions() in exact pixels, and overriding them with 100%
    // would fight with it.
    const wrapper = (fabric as unknown as { wrapperEl?: HTMLDivElement }).wrapperEl;
    if (wrapper) {
      wrapper.style.position = 'absolute';
      wrapper.style.top = '0';
      wrapper.style.left = '0';
    }
    return () => {
      fabricRef.current = null;
      void fabric.dispose();
    };
  }, []);

  // ---- Keep the canvas the size of its container and refit on resize.
  // This also covers the layout shift on first mount: if the container is 0x0
  // when the image loads, computeFitView cannot do anything and the image
  // would stay unscaled in the top-left corner. The ResizeObserver recomputes
  // the fit once the container reaches its real size. Skipped when zoom is
  // locked.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const apply = (): void => {
      const fabric = fabricRef.current;
      if (!fabric) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      fabric.setDimensions({ width: w, height: h });
      const loaded = loadedRef.current;
      if (loaded && !lockZoomRef.current) {
        const padX = showRulersRef.current ? RULER_LEFT_SIZE : 0;
        const padY = showRulersRef.current ? RULER_TOP_SIZE : 0;
        const fit = computeFitView(w, h, loaded.width, loaded.height, padX, padY);
        if (!sameView(fit, lastViewSentRef.current)) {
          applyView(fabric, fit);
          lastViewSentRef.current = fit;
          adjustStrokeWidths(rectsByIdRef.current, fit.zoom);
          dispatchRef.current({ type: 'SET_VIEW', view: fit });
        }
      }
      fabric.requestRenderAll();
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ---- Load image when filename changes
  useEffect(() => {
    if (!imageFilename) {
      loadedRef.current = null;
      const fabric = fabricRef.current;
      if (fabric) {
        fabric.clear();
        fabric.backgroundColor = '#1f1f23';
        fabric.requestRenderAll();
      }
      rectsByIdRef.current.clear();
      setStatus('empty');
      return;
    }
    generationRef.current += 1;
    const gen = generationRef.current;
    setStatus('loading');
    setErrorMessage(null);

    (async (): Promise<void> => {
      const started = performance.now();
      const [imgRes, annRes] = await Promise.all([
        api.getImageDataUrl(datasetRoot, imageFilename),
        api.loadAnnotations(datasetRoot, imageFilename)
      ]);
      if (gen !== generationRef.current) return;
      if (!imgRes.ok) {
        setStatus('error');
        setErrorMessage(translate('canvas.error.openImage', { reason: imgRes.reason }));
        return;
      }
      const fabric = fabricRef.current;
      const container = containerRef.current;
      if (!fabric || !container) return;

      let fabricImg: FabricImage;
      try {
        fabricImg = await FabricImage.fromURL(imgRes.dataUrl);
      } catch (err) {
        setStatus('error');
        setErrorMessage(
          translate('canvas.error.loadImage', { message: (err as Error).message })
        );
        return;
      }
      if (gen !== generationRef.current) return;

      isSyncingRef.current = true;
      fabric.clear();
      rectsByIdRef.current.clear();
      fabric.backgroundColor = '#1f1f23';
      // Critical: originX/originY must be 'left'/'top'. Fabric 7 defaults
      // FabricImage to 'center', which makes (0, 0) the centre of the image
      // rather than its top-left corner. Without forcing the origin the image
      // shifts by half its size (-320,-320 for a 640x640 image) and the
      // viewport transform pushes it off canvas, while the boxes, which do use
      // top-left coordinates, end up drawn where the image should have been.
      fabricImg.set({
        originX: 'left',
        originY: 'top',
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
        hoverCursor: 'default'
      });
      fabric.add(fabricImg);
      fabric.sendObjectToBack(fabricImg);
      // Fabric is the source of truth for width and height: nativeImage in the
      // main process can report skewed dimensions (HiDPI scale factor, EXIF
      // orientation). YOLO boxes are normalized against the real file size,
      // which is what the browser sees when it decodes the data URL.
      const naturalW = fabricImg.width ?? imgRes.width;
      const naturalH = fabricImg.height ?? imgRes.height;
      loadedRef.current = {
        filename: imageFilename,
        width: naturalW,
        height: naturalH
      };

      const dp = dispatchRef.current;
      dp({
        type: 'LOAD_IMAGE_META',
        filename: imageFilename,
        width: naturalW,
        height: naturalH
      });
      const bboxesYolo: BBoxYolo[] = annRes.ok ? annRes.bboxes : [];
      dp({ type: 'LOAD_BBOXES', filename: imageFilename, bboxes: bboxesYolo });

      if (!lockZoomRef.current) {
        const w0 = container.clientWidth;
        const h0 = container.clientHeight;
        if (w0 > 0 && h0 > 0) {
          fabric.setDimensions({ width: w0, height: h0 });
          const padX = showRulersRef.current ? RULER_LEFT_SIZE : 0;
          const padY = showRulersRef.current ? RULER_TOP_SIZE : 0;
          const fit = computeFitView(w0, h0, naturalW, naturalH, padX, padY);
          applyView(fabric, fit);
          lastViewSentRef.current = fit;
          dp({ type: 'SET_VIEW', view: fit });
        }
        // If the container is still 0x0 (flex layout not settled yet), the
        // ResizeObserver applies the fit as soon as it has real dimensions.
      } else {
        applyView(fabric, view);
        lastViewSentRef.current = view;
      }
      // Critical: force an explicit render after setDimensions + applyView.
      // renderOnAddRemove is false, so without requestRenderAll the viewport
      // transform is set but nothing repaints until some external effect
      // (the box sync, for instance) happens to trigger it.
      fabric.requestRenderAll();
      isSyncingRef.current = false;
      setStatus('ready');

      // Refit after the next paint: the first computeFitView may have read
      // container dimensions that were not final yet. requestAnimationFrame
      // guarantees the browser has finished layout, so clientWidth and
      // clientHeight now reflect the real size.
      requestAnimationFrame(() => {
        if (gen !== generationRef.current) return;
        const f = fabricRef.current;
        const cont = containerRef.current;
        const ld = loadedRef.current;
        if (!f || !cont || !ld || lockZoomRef.current) return;
        const w = cont.clientWidth;
        const h = cont.clientHeight;
        if (w <= 0 || h <= 0) return;
        f.setDimensions({ width: w, height: h });
        const padX = showRulersRef.current ? RULER_LEFT_SIZE : 0;
        const padY = showRulersRef.current ? RULER_TOP_SIZE : 0;
        const refit = computeFitView(w, h, ld.width, ld.height, padX, padY);
        if (sameView(refit, lastViewSentRef.current)) return;
        applyView(f, refit);
        lastViewSentRef.current = refit;
        adjustStrokeWidths(rectsByIdRef.current, refit.zoom);
        dispatchRef.current({ type: 'SET_VIEW', view: refit });
        f.requestRenderAll();
      });

      const elapsed = Math.round(performance.now() - started);
      // eslint-disable-next-line no-console
      console.info(`[canvas] ${imageFilename}: ${bboxesYolo.length} boxes in ${elapsed}ms`);
    })().catch((err) => {
      if (gen !== generationRef.current) return;
      setStatus('error');
      setErrorMessage(translate('canvas.error.unexpected', { message: (err as Error).message }));
    });
  }, [api, datasetRoot, imageFilename]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Sync bboxes from store -> Fabric
  useEffect(() => {
    const fabric = fabricRef.current;
    const loaded = loadedRef.current;
    if (!fabric || !loaded || loaded.filename !== imageFilename) return;
    syncBboxes(fabric, rectsByIdRef.current, bboxes, classes, loaded, isSyncingRef);
    fabric.requestRenderAll();
  }, [bboxes, classes, imageFilename]);

  // ---- Sync view (zoom/pan) from store -> Fabric
  useEffect(() => {
    const fabric = fabricRef.current;
    if (!fabric) return;
    if (sameView(view, lastViewSentRef.current)) return;
    applyView(fabric, view);
    lastViewSentRef.current = view;
    adjustStrokeWidths(rectsByIdRef.current, view.zoom);
    fabric.requestRenderAll();
  }, [view]);

  // ---- Refit when the rulers are toggled: the padding available to the image
  // changes by RULER_*_SIZE, so the fit is recomputed to keep the image centred
  // in the usable area. Skipped when zoom is locked.
  useEffect(() => {
    const fabric = fabricRef.current;
    const loaded = loadedRef.current;
    const container = containerRef.current;
    if (!fabric || !loaded || !container) return;
    if (lockZoomRef.current) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;
    const padX = showRulers ? RULER_LEFT_SIZE : 0;
    const padY = showRulers ? RULER_TOP_SIZE : 0;
    const fit = computeFitView(w, h, loaded.width, loaded.height, padX, padY);
    if (sameView(fit, lastViewSentRef.current)) return;
    applyView(fabric, fit);
    lastViewSentRef.current = fit;
    adjustStrokeWidths(rectsByIdRef.current, fit.zoom);
    dispatchRef.current({ type: 'SET_VIEW', view: fit });
    fabric.requestRenderAll();
  }, [showRulers]);

  // ---- Overlay (pixel grid + rulers) hooked to Fabric's after:render event.
  // The effect only depends on showPixelGrid/showRulers to add or remove the
  // listener; when a toggle turns off, the forced re-render clears whatever the
  // overlay had painted.
  useEffect(() => {
    const fabric = fabricRef.current;
    if (!fabric) return;
    const onAfter = (): void => {
      const loaded = loadedRef.current;
      const vt = fabric.viewportTransform;
      if (!vt) return;
      const w = fabric.getWidth();
      const h = fabric.getHeight();
      if (showPixelGridRef.current && loaded) {
        const ctx = fabric.getContext();
        drawPixelGrid(ctx, vt, loaded.width, loaded.height, w, h);
      }
      if (showRulers) {
        const top = topRulerRef.current;
        const left = leftRulerRef.current;
        if (top && left) {
          drawRulers(top, left, vt, loaded?.width ?? 0, loaded?.height ?? 0, w, h);
        }
      }
    };
    fabric.on('after:render', onAfter);
    fabric.requestRenderAll();
    return () => {
      fabric.off('after:render', onAfter);
      fabric.requestRenderAll();
    };
  }, [showPixelGrid, showRulers]);

  // ---- Sync mode -> Fabric behavior
  useEffect(() => {
    const fabric = fabricRef.current;
    if (!fabric) return;
    applyMode(fabric, rectsByIdRef.current, mode);
    // Cancel an in-progress two-click drawing when the mode changes (the user
    // pressed S, or clicked Select in the toolbar, mid-drawing).
    if (mode !== 'draw' && drawingRef.current) {
      fabric.remove(drawingRef.current.ghost);
      drawingRef.current = null;
    }
    fabric.requestRenderAll();
  }, [mode]);

  // ---- Cancel an in-progress drawing when the image changes
  useEffect(() => {
    const fabric = fabricRef.current;
    if (!fabric) return;
    if (drawingRef.current) {
      fabric.remove(drawingRef.current.ghost);
      drawingRef.current = null;
      fabric.requestRenderAll();
    }
  }, [imageFilename]);

  // ---- Esc during a two-click drawing cancels it
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      if (!drawingRef.current) return;
      const fabric = fabricRef.current;
      if (!fabric) return;
      fabric.remove(drawingRef.current.ghost);
      drawingRef.current = null;
      fabric.requestRenderAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- Sync selection from the store to Fabric, for the keyboard shortcuts
  // that change the selection without touching the canvas.
  useEffect(() => {
    const fabric = fabricRef.current;
    if (!fabric) return;
    if (isSyncingRef.current) return;
    const wantedIds = new Set(selection);
    const active = fabric.getActiveObjects();
    const activeIds = new Set(
      active.map((o) => (isLabeledRect(o) ? o.__bboxId : null)).filter((v): v is string => Boolean(v))
    );
    if (setEquals(wantedIds, activeIds)) return;
    isSyncingRef.current = true;
    fabric.discardActiveObject();
    if (wantedIds.size === 1) {
      const id = [...wantedIds][0]!;
      const obj = rectsByIdRef.current.get(id);
      if (obj) fabric.setActiveObject(obj);
    } else if (wantedIds.size > 1) {
      const objects: LabeledRect[] = [];
      for (const id of wantedIds) {
        const obj = rectsByIdRef.current.get(id);
        if (obj) objects.push(obj);
      }
      if (objects.length > 0) {
        const sel = new ActiveSelection(objects, { canvas: fabric });
        fabric.setActiveObject(sel);
      }
    }
    isSyncingRef.current = false;
    fabric.requestRenderAll();
  }, [selection]);

  // ---- Mouse, wheel and object handlers. Registered once; they read the refs
  // above instead of closing over render-scoped values.
  useEffect(() => {
    const fabric = fabricRef.current;
    if (!fabric) return;

    // Two-click drawing in draw mode:
    // 1st click (mouse:up) records the first corner and creates a ghost rect
    // mouse:move resizes the ghost from that corner to the cursor
    // 2nd click (mouse:up) turns the ghost into a real box
    // Cancelled by Esc, by changing mode, or by changing image.
    const onMouseDown = (_e: TPointerEventInfo<TPointerEvent>): void => {
      // In draw mode mouse:down does not start a ghost: drawing is two-click
      // and handled in mouse:up, which also avoids reacting to an accidental
      // drag.
    };

    const onMouseMove = (e: TPointerEventInfo<TPointerEvent>): void => {
      const drawing = drawingRef.current;
      if (drawing && modeRef.current === 'draw') {
        const loaded = loadedRef.current;
        if (!loaded) return;
        const raw = fabric.getScenePoint(e.e);
        // Clamp the cursor to the image bounds: the ghost stops at the edge
        // instead of extending past it.
        const ptr = clampPointToImage(raw, loaded);
        const x = Math.min(ptr.x, drawing.start.x);
        const y = Math.min(ptr.y, drawing.start.y);
        const w = Math.abs(ptr.x - drawing.start.x);
        const h = Math.abs(ptr.y - drawing.start.y);
        drawing.ghost.set({ left: x, top: y, width: w, height: h });
        fabric.requestRenderAll();
      }
    };

    const onMouseUp = (e: TPointerEventInfo<TPointerEvent>): void => {
      if (modeRef.current !== 'draw') return;
      const loaded = loadedRef.current;
      if (!loaded) return;
      const ptr = fabric.getScenePoint(e.e);
      if (!isInsideImage(ptr, loaded)) return;

      const drawing = drawingRef.current;
      if (drawing === null) {
        // First click: record the corner and create the ghost.
        const color = colorForClass(classesRef.current, currentClassIdRef.current);
        const ghost = new Rect({
          originX: 'left',
          originY: 'top',
          left: ptr.x,
          top: ptr.y,
          width: 0,
          height: 0,
          fill: hexToRgba(color, 0.15),
          stroke: color,
          strokeWidth: 2 / fabric.getZoom(),
          strokeUniform: true,
          selectable: false,
          evented: false,
          objectCaching: false
        });
        fabric.add(ghost);
        drawingRef.current = { start: new Point(ptr.x, ptr.y), ghost };
        fabric.requestRenderAll();
        return;
      }

      // Second click: turn the ghost into a real box.
      const ghost = drawing.ghost;
      const w = ghost.width ?? 0;
      const h = ghost.height ?? 0;
      const screenW = w * fabric.getZoom();
      const screenH = h * fabric.getZoom();
      fabric.remove(ghost);
      drawingRef.current = null;
      if (screenW < MIN_DRAW_SCREEN_PX || screenH < MIN_DRAW_SCREEN_PX) {
        fabric.requestRenderAll();
        return;
      }
      const left = ghost.left ?? 0;
      const top = ghost.top ?? 0;
      const geom = clampGeometry01({
        xCenter: (left + w / 2) / loaded.width,
        yCenter: (top + h / 2) / loaded.height,
        width: w / loaded.width,
        height: h / loaded.height
      });
      const newBbox: BBoxLocal = {
        id: nextBboxId(),
        classId: currentClassIdRef.current,
        ...geom
      };
      const dp = dispatchRef.current;
      dp({ type: 'APPLY_OP', op: { kind: 'create', bboxes: [newBbox] } });
      // Stay in Draw mode so several boxes can be drawn in a row. The
      // selection is cleared because boxes are evented:false while drawing;
      // the user picks them up again after switching to Select.
      dp({ type: 'SET_SELECTION', ids: [] });
    };

    const onWheel = (e: TPointerEventInfo<WheelEvent>): void => {
      const ev = e.e;
      if (!ev.ctrlKey) return;
      ev.preventDefault();
      ev.stopPropagation();
      const factor = ev.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = clampZoom(fabric.getZoom() * factor);
      fabric.zoomToPoint(new Point(ev.offsetX, ev.offsetY), newZoom);
      const vt = fabric.viewportTransform;
      const v: ViewState = { zoom: newZoom, panX: vt?.[4] ?? 0, panY: vt?.[5] ?? 0 };
      lastViewSentRef.current = v;
      dispatchRef.current({ type: 'SET_VIEW', view: v });
      adjustStrokeWidths(rectsByIdRef.current, newZoom);
      fabric.requestRenderAll();
    };

    const onObjectModified = (e: { target?: FabricObject }): void => {
      if (isSyncingRef.current) return;
      const target = e.target;
      if (!target) return;
      const loaded = loadedRef.current;
      if (!loaded) return;

      if (target.type === 'activeselection' || target.type === 'activeSelection') {
        const sel = target as unknown as { _objects?: FabricObject[] };
        const children = sel._objects ?? [];
        for (const child of children) {
          if (!isLabeledRect(child)) continue;
          dispatchMove(child, loaded, dispatchRef.current, bboxesRef.current);
        }
        return;
      }

      if (!isLabeledRect(target)) return;
      const id = target.__bboxId;
      const before = bboxesRef.current.find((b) => b.id === id);
      if (!before) return;
      const sx = target.scaleX ?? 1;
      const sy = target.scaleY ?? 1;
      const w = (target.width ?? 0) * sx;
      const h = (target.height ?? 0) * sy;
      const left = target.left ?? 0;
      const top = target.top ?? 0;
      const newGeom = clampGeometry01({
        xCenter: (left + w / 2) / loaded.width,
        yCenter: (top + h / 2) / loaded.height,
        width: w / loaded.width,
        height: h / loaded.height
      });
      const isResize = sx !== 1 || sy !== 1;
      target.set({ scaleX: 1, scaleY: 1, width: w, height: h });
      target.setCoords();
      const fromGeom = {
        xCenter: before.xCenter,
        yCenter: before.yCenter,
        width: before.width,
        height: before.height
      };
      if (geomEquals(fromGeom, newGeom)) return;
      dispatchRef.current({
        type: 'APPLY_OP',
        op: { kind: isResize ? 'resize' : 'move', id, from: fromGeom, to: newGeom }
      });
    };

    const onSelectionChanged = (): void => {
      if (isSyncingRef.current) return;
      const active = fabric.getActiveObjects();
      const ids: string[] = [];
      for (const o of active) {
        if (isLabeledRect(o)) ids.push(o.__bboxId);
      }
      dispatchRef.current({ type: 'SET_SELECTION', ids });
    };

    // Clamp while dragging, so a box cannot leave the image mid-drag. Without
    // this the clamp would only happen on object:modified (mouse release) and
    // the box would visibly snap back.
    const onObjectMoving = (e: { target?: FabricObject }): void => {
      const target = e.target;
      if (!target || !isLabeledRect(target)) return;
      const loaded = loadedRef.current;
      if (!loaded) return;
      const w = (target.width ?? 0) * (target.scaleX ?? 1);
      const h = (target.height ?? 0) * (target.scaleY ?? 1);
      const left = target.left ?? 0;
      const top = target.top ?? 0;
      const clampedLeft = Math.max(0, Math.min(loaded.width - w, left));
      const clampedTop = Math.max(0, Math.min(loaded.height - h, top));
      if (left !== clampedLeft || top !== clampedTop) {
        target.set({ left: clampedLeft, top: clampedTop });
        target.setCoords();
      }
    };

    // Clamp while resizing: the rect edges cannot leave the image. After
    // Fabric applies the scaling we check for overflow and, if needed, reduce
    // the scale and shift left/top for the handles that move the opposite
    // corner.
    const onObjectScaling = (e: { target?: FabricObject }): void => {
      const target = e.target;
      if (!target || !isLabeledRect(target)) return;
      const loaded = loadedRef.current;
      if (!loaded) return;
      const baseW = target.width ?? 0;
      const baseH = target.height ?? 0;
      const sx = target.scaleX ?? 1;
      const sy = target.scaleY ?? 1;
      const w = baseW * sx;
      const h = baseH * sy;
      const left = target.left ?? 0;
      const top = target.top ?? 0;

      // Shrink or shift whatever crosses an image edge.
      let newLeft = left;
      let newTop = top;
      let newW = w;
      let newH = h;

      // Right edge: left + w beyond the image means w must shrink.
      if (left + w > loaded.width) newW = Math.max(1, loaded.width - left);
      // Bottom edge: top + h beyond the image means h must shrink.
      if (top + h > loaded.height) newH = Math.max(1, loaded.height - top);
      // Left edge: a negative left shifts right and shrinks w.
      if (left < 0) {
        newW = Math.max(1, w + left);
        newLeft = 0;
      }
      // Top edge: a negative top shifts down and shrinks h.
      if (top < 0) {
        newH = Math.max(1, h + top);
        newTop = 0;
      }

      if (newW !== w || newH !== h || newLeft !== left || newTop !== top) {
        target.set({
          left: newLeft,
          top: newTop,
          scaleX: newW / baseW,
          scaleY: newH / baseH
        });
        target.setCoords();
      }
    };

    fabric.on('mouse:down', onMouseDown);
    fabric.on('mouse:move', onMouseMove);
    fabric.on('mouse:up', onMouseUp);
    fabric.on('mouse:wheel', onWheel);
    fabric.on('object:moving', onObjectMoving);
    fabric.on('object:scaling', onObjectScaling);
    fabric.on('object:modified', onObjectModified);
    fabric.on('selection:created', onSelectionChanged);
    fabric.on('selection:updated', onSelectionChanged);
    fabric.on('selection:cleared', onSelectionChanged);

    return () => {
      fabric.off('mouse:down', onMouseDown);
      fabric.off('mouse:move', onMouseMove);
      fabric.off('mouse:up', onMouseUp);
      fabric.off('mouse:wheel', onWheel);
      fabric.off('object:moving', onObjectMoving);
      fabric.off('object:scaling', onObjectScaling);
      fabric.off('object:modified', onObjectModified);
      fabric.off('selection:created', onSelectionChanged);
      fabric.off('selection:updated', onSelectionChanged);
      fabric.off('selection:cleared', onSelectionChanged);
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-[#1f1f23] relative min-w-0">
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas ref={canvasElRef} className="block absolute inset-0" />
        {showRulers && (
          <>
            <canvas
              ref={topRulerRef}
              className="absolute top-0 right-0 pointer-events-none"
              style={{ left: `${RULER_LEFT_SIZE}px`, height: `${RULER_TOP_SIZE}px` }}
              aria-hidden
            />
            <canvas
              ref={leftRulerRef}
              className="absolute left-0 bottom-0 pointer-events-none"
              style={{ top: `${RULER_TOP_SIZE}px`, width: `${RULER_LEFT_SIZE}px` }}
              aria-hidden
            />
            <div
              className="absolute top-0 left-0 bg-black/80 border-r border-b border-white/10 pointer-events-none"
              style={{ width: `${RULER_LEFT_SIZE}px`, height: `${RULER_TOP_SIZE}px` }}
              aria-hidden
            />
          </>
        )}
        {status === 'empty' && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-300">
            {t('canvas.empty')}
          </div>
        )}
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-300 pointer-events-none">
            {t('canvas.loading')}
          </div>
        )}
        {status === 'error' && errorMessage && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-sm text-red-300 text-center">
            {errorMessage}
          </div>
        )}
      </div>
      {status === 'ready' && (
        <div className="flex-none h-8 flex items-center px-4 text-xs text-gray-300 bg-black/30 border-t border-black/40 gap-3">
          <span>{plural(t, bboxes.length, 'canvas.boxCount.one', 'canvas.boxCount.other')}</span>
          {selection.length > 0 && (
            <span>· {t('canvas.selectedCount', { count: selection.length })}</span>
          )}
          <span className="ml-auto">
            {t('canvas.zoom', { percent: Math.round(view.zoom * 100) })}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------- helpers ----------

function computeFitView(
  canvasW: number,
  canvasH: number,
  imgW: number,
  imgH: number,
  padX: number = 0,
  padY: number = 0
): ViewState {
  const innerW = canvasW - padX;
  const innerH = canvasH - padY;
  if (innerW <= 0 || innerH <= 0 || imgW <= 0 || imgH <= 0) {
    return { zoom: 1, panX: padX, panY: padY };
  }
  const zoom = Math.min(innerW / imgW, innerH / imgH);
  const panX = padX + (innerW - imgW * zoom) / 2;
  const panY = padY + (innerH - imgH * zoom) / 2;
  return { zoom, panX, panY };
}

function applyView(fabric: Canvas, view: ViewState): void {
  const z = view.zoom;
  fabric.setViewportTransform([z, 0, 0, z, view.panX, view.panY]);
}

function sameView(a: ViewState, b: ViewState | null): boolean {
  if (!b) return false;
  return (
    Math.abs(a.zoom - b.zoom) < 1e-6 &&
    Math.abs(a.panX - b.panX) < 1e-3 &&
    Math.abs(a.panY - b.panY) < 1e-3
  );
}

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function adjustStrokeWidths(rects: Map<string, LabeledRect>, zoom: number): void {
  const sw = 2 / zoom;
  const fs = Math.max(8, 11 / zoom);
  rects.forEach((rect) => {
    rect.set({ strokeWidth: sw });
    rect.__label.set({ fontSize: fs });
  });
}

function applyMode(fabric: Canvas, rects: Map<string, LabeledRect>, mode: EditMode): void {
  if (mode === 'select') {
    fabric.selection = true;
    fabric.defaultCursor = 'default';
    fabric.hoverCursor = 'move';
    rects.forEach((r) => r.set({ selectable: true, evented: true }));
  } else {
    // draw
    fabric.discardActiveObject();
    fabric.selection = false;
    fabric.defaultCursor = 'crosshair';
    fabric.hoverCursor = 'crosshair';
    rects.forEach((r) => r.set({ selectable: false, evented: false }));
  }
}

function syncBboxes(
  fabric: Canvas,
  rects: Map<string, LabeledRect>,
  bboxes: BBoxLocal[],
  classes: string[],
  loaded: LoadedImage,
  guard: React.MutableRefObject<boolean>
): void {
  guard.current = true;
  const wantedIds = new Set(bboxes.map((b) => b.id));
  const enableCaching = bboxes.length <= MAX_BBOX_FOR_CACHING;
  const zoom = fabric.getZoom();
  const sw = 2 / zoom;
  const labelFs = Math.max(8, 11 / zoom);
  const isSelectMode = fabric.selection === true;

  for (const [id, rect] of rects) {
    if (!wantedIds.has(id)) {
      fabric.remove(rect);
      fabric.remove(rect.__label);
      rects.delete(id);
    }
  }

  for (const b of bboxes) {
    const color = colorForClass(classes, b.classId);
    const labelText = labelTextFor(classes, b.classId);
    const pxW = b.width * loaded.width;
    const pxH = b.height * loaded.height;
    const pxX = b.xCenter * loaded.width - pxW / 2;
    const pxY = b.yCenter * loaded.height - pxH / 2;

    const existing = rects.get(b.id);
    if (existing) {
      existing.set({
        left: pxX,
        top: pxY,
        width: pxW,
        height: pxH,
        scaleX: 1,
        scaleY: 1,
        stroke: color,
        cornerColor: color,
        strokeWidth: sw,
        objectCaching: enableCaching
      });
      existing.__classId = b.classId;
      existing.__label.set({
        text: labelText,
        left: pxX,
        top: Math.max(0, pxY - labelFs - 4),
        fontSize: labelFs,
        backgroundColor: color
      });
      existing.setCoords();
    } else {
      // Critical: originX/originY must be 'left'/'top'. Fabric 7 defaults Rect
      // and Text to 'center', which makes (left, top) the centre. pxX/pxY are
      // the top-left corner of the box, so without forcing the origin the rect
      // would be drawn offset by (pxW/2, pxH/2).
      const rect = new Rect({
        originX: 'left',
        originY: 'top',
        left: pxX,
        top: pxY,
        width: pxW,
        height: pxH,
        fill: 'transparent',
        stroke: color,
        strokeWidth: sw,
        strokeUniform: true,
        cornerSize: 8,
        cornerColor: color,
        cornerStyle: 'rect',
        transparentCorners: false,
        lockRotation: true,
        objectCaching: enableCaching,
        selectable: isSelectMode,
        evented: isSelectMode
      }) as LabeledRect;
      rect.__bboxId = b.id;
      rect.__classId = b.classId;
      rect.setControlsVisibility({ mtr: false });
      const label = new FabricText(labelText, {
        originX: 'left',
        originY: 'top',
        left: pxX,
        top: Math.max(0, pxY - labelFs - 4),
        fontSize: labelFs,
        fill: '#ffffff',
        backgroundColor: color,
        fontFamily: 'sans-serif',
        selectable: false,
        evented: false,
        objectCaching: enableCaching,
        padding: 1
      });
      rect.__label = label;
      fabric.add(rect);
      fabric.add(label);
      rects.set(b.id, rect);
    }
  }
  guard.current = false;
}

function isInsideImage(p: { x: number; y: number }, loaded: LoadedImage): boolean {
  return p.x >= 0 && p.y >= 0 && p.x <= loaded.width && p.y <= loaded.height;
}

function clampPointToImage(p: { x: number; y: number }, loaded: LoadedImage): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(loaded.width, p.x)),
    y: Math.max(0, Math.min(loaded.height, p.y))
  };
}

function geomEquals(
  a: { xCenter: number; yCenter: number; width: number; height: number },
  b: typeof a
): boolean {
  return (
    Math.abs(a.xCenter - b.xCenter) < 1e-6 &&
    Math.abs(a.yCenter - b.yCenter) < 1e-6 &&
    Math.abs(a.width - b.width) < 1e-6 &&
    Math.abs(a.height - b.height) < 1e-6
  );
}

function setEquals<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function hexToRgba(hex: string, alpha: number): string {
  const v = hex.replace('#', '');
  const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---- Pixel grid + rulers ----

// Major step: the smallest multiple of GRID_STEP that leaves at least
// minScreenPx of on-screen spacing, so ruler labels never overlap. Allowed
// multipliers: 1, 2, 5, 10, 20, 50 and up.
function chooseMajorMultiple(zoom: number, minScreenPx: number): number {
  const candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  for (const k of candidates) {
    if (k * GRID_STEP * zoom >= minScreenPx) return k;
  }
  return 1000;
}

function drawPixelGrid(
  ctx: CanvasRenderingContext2D,
  vt: number[],
  _imgW: number,
  _imgH: number,
  canvasW: number,
  canvasH: number
): void {
  const zoom = vt[0] ?? 1;
  const panX = vt[4] ?? 0;
  const panY = vt[5] ?? 0;
  const step = GRID_STEP;
  // Visible range in scene space. It covers the whole viewport rather than
  // being clamped to the image, so the grid continues into the letterbox.
  const sceneXMin = -panX / zoom;
  const sceneXMax = (canvasW - panX) / zoom;
  const sceneYMin = -panY / zoom;
  const sceneYMax = (canvasH - panY) / zoom;
  const firstX = Math.ceil(sceneXMin / step) * step;
  const firstY = Math.ceil(sceneYMin / step) * step;

  // Critical: with `enableRetinaScaling` (on by default) Fabric initialises
  // the context with `setTransform(dpr, 0, 0, dpr, 0, 0)` and then applies the
  // viewport transform on top while rendering. Inside `after:render` the
  // current transform can therefore be DPR-only or DPR + viewport, depending
  // on when Fabric restored it. Forcing exactly DPR-only here makes the
  // coordinates passed to fillRect CSS pixels, the same unit as panX, panY,
  // zoom and canvasW. Resetting to the identity matrix would be wrong on HiDPI
  // displays: the lines would land in device pixels and anchor to the window
  // edge (panX/dpr is not panX) instead of to the image.
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  for (let sx = firstX; sx <= sceneXMax; sx += step) {
    const px = Math.round(sx * zoom + panX);
    if (px < 0 || px > canvasW) continue;
    ctx.fillRect(px, 0, 1, canvasH);
  }
  for (let sy = firstY; sy <= sceneYMax; sy += step) {
    const py = Math.round(sy * zoom + panY);
    if (py < 0 || py > canvasH) continue;
    ctx.fillRect(0, py, canvasW, 1);
  }
  ctx.restore();
}

function setupRulerCanvas(
  c: HTMLCanvasElement,
  cssW: number,
  cssH: number
): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1;
  const targetW = Math.max(1, Math.round(cssW * dpr));
  const targetH = Math.max(1, Math.round(cssH * dpr));
  if (c.width !== targetW) c.width = targetW;
  if (c.height !== targetH) c.height = targetH;
  c.style.width = `${cssW}px`;
  c.style.height = `${cssH}px`;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function drawRulers(
  topCanvas: HTMLCanvasElement,
  leftCanvas: HTMLCanvasElement,
  vt: number[],
  imgW: number,
  imgH: number,
  canvasW: number,
  canvasH: number
): void {
  const zoom = vt[0] ?? 1;
  const panX = vt[4] ?? 0;
  const panY = vt[5] ?? 0;

  // Shared steps: minor = GRID_STEP (one per grid line), major = k * GRID_STEP
  // with k chosen to leave at least RULER_MIN_MAJOR_PX of on-screen spacing.
  const minor = GRID_STEP;
  const major = chooseMajorMultiple(zoom, RULER_MIN_MAJOR_PX) * GRID_STEP;

  const bg = 'rgba(20,20,28,0.92)';
  const tickColor = '#cdd0d6';
  const imageBandColor = 'rgba(120,180,255,0.18)';
  const borderColor = 'rgba(255,255,255,0.18)';

  // The rulers start after the corner box: the top one after RULER_LEFT_SIZE,
  // the left one after RULER_TOP_SIZE. Tick coordinates are shifted to match.
  // ----- Top ruler (cssW x RULER_TOP_SIZE) -----
  const topW = Math.max(0, canvasW - RULER_LEFT_SIZE);
  const topH = RULER_TOP_SIZE;
  if (topW > 0) {
    const topCtx = setupRulerCanvas(topCanvas, topW, topH);
    if (topCtx) {
      topCtx.clearRect(0, 0, topW, topH);
      topCtx.fillStyle = bg;
      topCtx.fillRect(0, 0, topW, topH);
      // Blue band: horizontal extent of the image, in ruler-canvas coordinates.
      if (imgW > 0) {
        const x0 = Math.max(0, panX - RULER_LEFT_SIZE);
        const x1 = Math.min(topW, imgW * zoom + panX - RULER_LEFT_SIZE);
        if (x1 > x0) {
          topCtx.fillStyle = imageBandColor;
          topCtx.fillRect(x0, 0, x1 - x0, topH);
        }
      }
      topCtx.fillStyle = borderColor;
      topCtx.fillRect(0, topH - 1, topW, 1);
      topCtx.fillStyle = tickColor;
      topCtx.font = '10px monospace';
      topCtx.textBaseline = 'top';
      // Visible range in scene space. The ruler starts at canvas-x
      // RULER_LEFT_SIZE, so the first visible sceneX is
      // (RULER_LEFT_SIZE - panX) / zoom.
      const sceneXMin = (RULER_LEFT_SIZE - panX) / zoom;
      const sceneXMax = (canvasW - panX) / zoom;
      // Minor ticks
      const firstMinor = Math.ceil(sceneXMin / minor) * minor;
      for (let sx = firstMinor; sx <= sceneXMax; sx += minor) {
        const px = Math.round(sx * zoom + panX - RULER_LEFT_SIZE);
        if (px < 0 || px > topW) continue;
        const isMajor = Math.abs(sx / major - Math.round(sx / major)) < 1e-6;
        if (isMajor) continue;
        topCtx.fillRect(px, topH - 5, 1, 4);
      }
      // Major ticks, with a label.
      const firstMajor = Math.ceil(sceneXMin / major) * major;
      for (let sx = firstMajor; sx <= sceneXMax; sx += major) {
        const px = Math.round(sx * zoom + panX - RULER_LEFT_SIZE);
        if (px < 0 || px > topW) continue;
        topCtx.fillRect(px, topH - 11, 1, 10);
        topCtx.fillText(formatTick(sx), px + 2, 2);
      }
    }
  }

  // ----- Left ruler (RULER_LEFT_SIZE x cssH) -----
  const leftW = RULER_LEFT_SIZE;
  const leftH = Math.max(0, canvasH - RULER_TOP_SIZE);
  if (leftH > 0) {
    const leftCtx = setupRulerCanvas(leftCanvas, leftW, leftH);
    if (leftCtx) {
      leftCtx.clearRect(0, 0, leftW, leftH);
      leftCtx.fillStyle = bg;
      leftCtx.fillRect(0, 0, leftW, leftH);
      if (imgH > 0) {
        const y0 = Math.max(0, panY - RULER_TOP_SIZE);
        const y1 = Math.min(leftH, imgH * zoom + panY - RULER_TOP_SIZE);
        if (y1 > y0) {
          leftCtx.fillStyle = imageBandColor;
          leftCtx.fillRect(0, y0, leftW, y1 - y0);
        }
      }
      leftCtx.fillStyle = borderColor;
      leftCtx.fillRect(leftW - 1, 0, 1, leftH);
      leftCtx.fillStyle = tickColor;
      leftCtx.font = '10px monospace';
      leftCtx.textBaseline = 'middle';
      const sceneYMin = (RULER_TOP_SIZE - panY) / zoom;
      const sceneYMax = (canvasH - panY) / zoom;
      const firstMinor = Math.ceil(sceneYMin / minor) * minor;
      for (let sy = firstMinor; sy <= sceneYMax; sy += minor) {
        const py = Math.round(sy * zoom + panY - RULER_TOP_SIZE);
        if (py < 0 || py > leftH) continue;
        const isMajor = Math.abs(sy / major - Math.round(sy / major)) < 1e-6;
        if (isMajor) continue;
        leftCtx.fillRect(leftW - 5, py, 4, 1);
      }
      const firstMajor = Math.ceil(sceneYMin / major) * major;
      for (let sy = firstMajor; sy <= sceneYMax; sy += major) {
        const py = Math.round(sy * zoom + panY - RULER_TOP_SIZE);
        if (py < 0 || py > leftH) continue;
        leftCtx.fillRect(leftW - 11, py, 10, 1);
        // Horizontal label: textBaseline=middle centres the text on the tick,
        // and it is left-aligned inside the ruler with 2px of padding.
        leftCtx.fillText(formatTick(sy), 2, py);
      }
    }
  }
}

function formatTick(v: number): string {
  // Abbreviate to "k" past 10000, otherwise print the plain integer.
  const r = Math.round(v);
  if (Math.abs(r) >= 10000) return `${Math.round(r / 1000)}k`;
  return String(r);
}

function dispatchMove(
  child: LabeledRect,
  loaded: LoadedImage,
  dispatch: ReturnType<typeof useDataset>['dispatch'],
  bboxes: BBoxLocal[]
): void {
  const id = child.__bboxId;
  const before = bboxes.find((b) => b.id === id);
  if (!before) return;
  // getCenterPoint() returns the absolute coordinates of the object centre,
  // independent of originX/originY and accounting for a parent group
  // (multi-select / ActiveSelection). Do not use calcTransformMatrix()[4]/[5]:
  // with origin 'left'/'top' those are the top-left corner, not the centre.
  const center = child.getCenterPoint();
  const w = (child.width ?? 0) * (child.scaleX ?? 1);
  const h = (child.height ?? 0) * (child.scaleY ?? 1);
  const newGeom = clampGeometry01({
    xCenter: center.x / loaded.width,
    yCenter: center.y / loaded.height,
    width: w / loaded.width,
    height: h / loaded.height
  });
  const fromGeom = {
    xCenter: before.xCenter,
    yCenter: before.yCenter,
    width: before.width,
    height: before.height
  };
  if (geomEquals(fromGeom, newGeom)) return;
  dispatch({
    type: 'APPLY_OP',
    op: { kind: 'move', id, from: fromGeom, to: newGeom }
  });
}
