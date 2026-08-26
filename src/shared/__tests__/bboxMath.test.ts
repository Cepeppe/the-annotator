import { describe, it, expect } from 'vitest';
import {
  clamp01,
  clampGeometry01,
  pixelRectToGeometry,
  pixelTopLeftToYolo,
  yoloToPixelTopLeft
} from '../bboxMath';

describe('bboxMath', () => {
  it('clamp01 limita al range [0, 1]', () => {
    expect(clamp01(-0.1)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.42)).toBe(0.42);
  });

  it('round-trip yolo <-> pixel mantiene i valori', () => {
    const bbox = {
      classId: 2,
      xCenter: 0.5,
      yCenter: 0.5,
      width: 0.25,
      height: 0.4
    };
    const px = yoloToPixelTopLeft(bbox, 1000, 800);
    expect(px.x).toBeCloseTo(375);
    expect(px.y).toBeCloseTo(240);
    expect(px.width).toBeCloseTo(250);
    expect(px.height).toBeCloseTo(320);

    const back = pixelTopLeftToYolo(px, 1000, 800, bbox.classId);
    expect(back.xCenter).toBeCloseTo(bbox.xCenter, 6);
    expect(back.yCenter).toBeCloseTo(bbox.yCenter, 6);
    expect(back.width).toBeCloseTo(bbox.width, 6);
    expect(back.height).toBeCloseTo(bbox.height, 6);
  });

  it('conversione pixel->yolo clampa i valori nel range [0, 1]', () => {
    const yolo = pixelTopLeftToYolo({ x: -5000, y: -5000, width: 10000, height: 10000 }, 1000, 1000, 0);
    expect(yolo.xCenter).toBe(0);
    expect(yolo.yCenter).toBe(0);
    expect(yolo.width).toBe(1);
    expect(yolo.height).toBe(1);
  });

  it('clampGeometry01 shifts the centre to stay inside [0,1] after a move', () => {
    // bbox 0.4×0.4 spostato fuori dal bordo destro
    const r = clampGeometry01({ xCenter: 0.95, yCenter: 0.5, width: 0.4, height: 0.4 });
    expect(r.xCenter).toBeCloseTo(0.8, 6); // 1 - 0.4/2
    expect(r.yCenter).toBeCloseTo(0.5, 6);
    expect(r.width).toBeCloseTo(0.4, 6);
    expect(r.height).toBeCloseTo(0.4, 6);
  });

  it('clampGeometry01 limita a 1 una bbox più grande del frame', () => {
    const r = clampGeometry01({ xCenter: 0.5, yCenter: 0.5, width: 1.5, height: 2 });
    expect(r.width).toBe(1);
    expect(r.height).toBe(1);
  });

  it('pixelRectToGeometry computes the geometry and clamps it after a resize', () => {
    // A rectangle that sticks out of the image at the top-left corner.
    const g = pixelRectToGeometry({ x: -50, y: -50, width: 200, height: 200 }, 1000, 1000);
    expect(g.width).toBeCloseTo(0.2, 6);
    expect(g.height).toBeCloseTo(0.2, 6);
    // Centro (-50 + 100)/1000 = 0.05, ma half-width = 0.1 → centro spostato a 0.1
    expect(g.xCenter).toBeCloseTo(0.1, 6);
    expect(g.yCenter).toBeCloseTo(0.1, 6);
  });
});
