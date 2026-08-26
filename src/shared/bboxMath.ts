import type { BBoxGeometry, BBoxYolo } from './types';

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const EPS = 0.001;
const MIN_DIM = 0.001;

export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function isWithinTolerance(value: number): boolean {
  return value >= -EPS && value <= 1 + EPS;
}

export function yoloToPixelTopLeft(bbox: BBoxYolo, imgWidth: number, imgHeight: number): PixelRect {
  const width = bbox.width * imgWidth;
  const height = bbox.height * imgHeight;
  const x = bbox.xCenter * imgWidth - width / 2;
  const y = bbox.yCenter * imgHeight - height / 2;
  return { x, y, width, height };
}

export function pixelTopLeftToYolo(
  rect: PixelRect,
  imgWidth: number,
  imgHeight: number,
  classId: number
): BBoxYolo {
  const w = rect.width / imgWidth;
  const h = rect.height / imgHeight;
  const xCenter = (rect.x + rect.width / 2) / imgWidth;
  const yCenter = (rect.y + rect.height / 2) / imgHeight;
  return {
    classId,
    xCenter: clamp01(xCenter),
    yCenter: clamp01(yCenter),
    width: clamp01(w),
    height: clamp01(h)
  };
}

/**
 * Forces a normalized YOLO geometry back inside [0,1] after a move or a resize:
 * the size is kept (shrunk only if it does not fit) and the centre is shifted
 * so the box stays within the image bounds.
 */
export function clampGeometry01(geom: BBoxGeometry): BBoxGeometry {
  const width = Math.min(1, Math.max(MIN_DIM, geom.width));
  const height = Math.min(1, Math.max(MIN_DIM, geom.height));
  const halfW = width / 2;
  const halfH = height / 2;
  const xCenter = Math.min(1 - halfW, Math.max(halfW, geom.xCenter));
  const yCenter = Math.min(1 - halfH, Math.max(halfH, geom.yCenter));
  return { xCenter, yCenter, width, height };
}

/**
 * Converts a pixel rectangle (top-left + size) into a normalized YOLO geometry,
 * clamping it on the fly. Used after a resize through a Fabric.js handle.
 */
export function pixelRectToGeometry(rect: PixelRect, imgWidth: number, imgHeight: number): BBoxGeometry {
  const width = rect.width / imgWidth;
  const height = rect.height / imgHeight;
  const xCenter = (rect.x + rect.width / 2) / imgWidth;
  const yCenter = (rect.y + rect.height / 2) / imgHeight;
  return clampGeometry01({ xCenter, yCenter, width, height });
}
