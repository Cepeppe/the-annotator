import { describe, expect, it } from 'vitest';
import { applyFilter } from '../searchFilter';
import type { FilterState, ImageIndexEntry } from '../types';

const IMAGES: ImageIndexEntry[] = [
  { filename: 'img_001.jpg', hasLabelFile: true },
  { filename: 'img_002.jpg', hasLabelFile: false },
  { filename: 'IMG_010.jpg', hasLabelFile: true },
  { filename: 'photo_5.png', hasLabelFile: false }
];

describe('applyFilter', () => {
  it('status=all with an empty query returns the same array reference', () => {
    const filter: FilterState = { status: 'all', searchQuery: '' };
    const out = applyFilter(IMAGES, filter, new Set());
    expect(out).toBe(IMAGES);
  });

  it('status=pending excludes the images in completedSet', () => {
    const filter: FilterState = { status: 'pending', searchQuery: '' };
    const completed = new Set(['img_001.jpg', 'photo_5.png']);
    const out = applyFilter(IMAGES, filter, completed);
    expect(out.map((e) => e.filename)).toEqual(['img_002.jpg', 'IMG_010.jpg']);
  });

  it('status=completed keeps only the images in completedSet', () => {
    const filter: FilterState = { status: 'completed', searchQuery: '' };
    const completed = new Set(['img_001.jpg', 'photo_5.png']);
    const out = applyFilter(IMAGES, filter, completed);
    expect(out.map((e) => e.filename)).toEqual(['img_001.jpg', 'photo_5.png']);
  });

  it('search is a case-insensitive substring match, so IMG finds img', () => {
    const filter: FilterState = { status: 'all', searchQuery: 'img_0' };
    const out = applyFilter(IMAGES, filter, new Set());
    expect(out.map((e) => e.filename)).toEqual([
      'img_001.jpg',
      'img_002.jpg',
      'IMG_010.jpg'
    ]);
  });

  it('applies the pending filter and the search together', () => {
    const filter: FilterState = { status: 'pending', searchQuery: 'img' };
    const completed = new Set(['img_001.jpg']);
    const out = applyFilter(IMAGES, filter, completed);
    expect(out.map((e) => e.filename)).toEqual(['img_002.jpg', 'IMG_010.jpg']);
  });
});
