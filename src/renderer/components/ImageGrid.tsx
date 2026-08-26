import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ImageIndexEntry } from '@shared/types';
import { plural, type TranslateFn } from '@shared/i18n';
import { ImageGridItem, type ImageStatus } from './ImageGridItem';
import { EmptyState } from './EmptyState';
import { useT } from '../i18n';

interface ImageGridProps {
  datasetRoot: string;
  images: ImageIndexEntry[];
  totalImages: number;
  currentImage: string | null;
  completedSet: ReadonlySet<string>;
  searchActive: boolean;
  filterStatus: 'all' | 'pending' | 'completed';
  multiSelected: ReadonlySet<string>;
  /** Anchor file name for Shift+click range selection. */
  selectionAnchor: string | null;
  /** Plain click / Ctrl+click / Shift+click on an item. Receives the event. */
  onItemClick: (filename: string, e: ReactMouseEvent) => void;
  /** Right-click on an item, opens the context menu. */
  onItemContextMenu: (filename: string, e: ReactMouseEvent) => void;
  /** Click on the small delete button inside an item. */
  onItemDelete: (filename: string) => void;
}

const ROW_HEIGHT = 80;

function statusFor(
  entry: ImageIndexEntry,
  completedSet: ReadonlySet<string>
): ImageStatus {
  if (completedSet.has(entry.filename)) return 'completed';
  return entry.hasLabelFile ? 'pending_with_annotations' : 'pending_empty';
}

function emptyMessage(
  t: TranslateFn,
  totalImages: number,
  searchActive: boolean,
  filterStatus: 'all' | 'pending' | 'completed'
): { message: string; hint?: string } {
  if (totalImages === 0) {
    return { message: t('imageGrid.empty.noImages') };
  }
  if (searchActive) {
    return {
      message: t('imageGrid.empty.noResults'),
      hint: t('imageGrid.empty.noResults.hint')
    };
  }
  if (filterStatus === 'pending') {
    return {
      message: t('imageGrid.empty.allDone'),
      hint: t('imageGrid.empty.allDone.hint')
    };
  }
  if (filterStatus === 'completed') {
    return {
      message: t('imageGrid.empty.noneDone'),
      hint: t('imageGrid.empty.noneDone.hint')
    };
  }
  return { message: t('imageGrid.empty.nothing') };
}

export function ImageGrid({
  datasetRoot,
  images,
  totalImages,
  currentImage,
  completedSet,
  searchActive,
  filterStatus,
  multiSelected,
  selectionAnchor: _selectionAnchor,
  onItemClick,
  onItemContextMenu,
  onItemDelete
}: ImageGridProps): JSX.Element {
  const t = useT();
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: images.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8
  });

  // Keep the current row in view when it changes.
  useEffect(() => {
    if (!currentImage || images.length === 0) return;
    const idx = images.findIndex((e) => e.filename === currentImage);
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: 'auto' });
  }, [currentImage, images, virtualizer]);

  const isEmpty = images.length === 0;
  const empty = emptyMessage(t, totalImages, searchActive, filterStatus);

  const selectionCount = multiSelected.size;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none px-3 py-2 text-xs text-app-text-muted border-b border-app-border bg-app-surface flex items-center justify-between gap-2">
        <span>
          {plural(t, images.length, 'imageGrid.count.one', 'imageGrid.count.other')}
          {images.length !== totalImages ? t('imageGrid.ofTotal', { total: totalImages }) : ''}
        </span>
        {selectionCount > 0 && (
          <span className="text-app-accent font-medium">
            {plural(t, selectionCount, 'imageGrid.selected.one', 'imageGrid.selected.other')}
          </span>
        )}
      </div>
      <div ref={parentRef} className="flex-1 overflow-auto">
        {isEmpty ? (
          <EmptyState message={empty.message} hint={empty.hint} />
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: 'relative',
              width: '100%'
            }}
          >
            {virtualizer.getVirtualItems().map((vItem) => {
              const entry = images[vItem.index];
              if (!entry) return null;
              return (
                <div
                  key={entry.filename}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${vItem.size}px`,
                    transform: `translateY(${vItem.start}px)`
                  }}
                >
                  <ImageGridItem
                    datasetRoot={datasetRoot}
                    entry={entry}
                    isCurrent={entry.filename === currentImage}
                    isMultiSelected={multiSelected.has(entry.filename)}
                    status={statusFor(entry, completedSet)}
                    onSelect={onItemClick}
                    onContextMenu={onItemContextMenu}
                    onDelete={onItemDelete}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
