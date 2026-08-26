import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useApi } from '../hooks/useApi';
import type { ImageIndexEntry } from '@shared/types';
import type { TranslateFn } from '@shared/i18n';
import { useT } from '../i18n';

export type ImageStatus = 'completed' | 'pending_with_annotations' | 'pending_empty';

interface ImageGridItemProps {
  datasetRoot: string;
  entry: ImageIndexEntry;
  isCurrent: boolean;
  isMultiSelected: boolean;
  status: ImageStatus;
  onSelect: (filename: string, e: ReactMouseEvent) => void;
  onContextMenu: (filename: string, e: ReactMouseEvent) => void;
  onDelete: (filename: string) => void;
}

function StatusIcon({ status, t }: { status: ImageStatus; t: TranslateFn }): JSX.Element {
  if (status === 'completed') {
    const label = t('imageGridItem.status.doneTitle');
    return (
      <span
        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] leading-none shadow"
        title={label}
        aria-label={label}
      >
        ✓
      </span>
    );
  }
  if (status === 'pending_with_annotations') {
    const label = t('imageGridItem.status.pendingWithBoxes');
    return (
      <span
        className="absolute top-1 right-1 w-3 h-3 rounded-full bg-amber-400 border border-white shadow"
        title={label}
        aria-label={label}
      />
    );
  }
  const label = t('imageGridItem.status.pendingEmpty');
  return (
    <span
      className="absolute top-1 right-1 w-3 h-3 rounded-full bg-transparent border border-app-border"
      title={label}
      aria-label={label}
    />
  );
}

function statusSubtitle(t: TranslateFn, status: ImageStatus): string {
  if (status === 'completed') return t('imageGridItem.status.done');
  if (status === 'pending_with_annotations') return t('imageGridItem.status.toDo');
  return t('imageGridItem.status.empty');
}

export function ImageGridItem({
  datasetRoot,
  entry,
  isCurrent,
  isMultiSelected,
  status,
  onSelect,
  onContextMenu,
  onDelete
}: ImageGridItemProps): JSX.Element {
  const api = useApi();
  const t = useT();
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    setThumbnail(null);
    setFailed(false);

    void api.getThumbnail(datasetRoot, entry.filename).then((r) => {
      if (!aliveRef.current) return;
      if (r.ok) {
        setThumbnail(r.dataUrl);
      } else {
        setFailed(true);
      }
    });

    return () => {
      aliveRef.current = false;
    };
  }, [api, datasetRoot, entry.filename]);

  // Multi-selection wins visually over "current", because it is the action the
  // user is composing right now. The current row is still marked by the accent
  // background.
  const bgClass = isCurrent
    ? 'bg-app-row-current'
    : isMultiSelected
      ? 'bg-app-row-current'
      : 'bg-app-surface';
  const borderClass = isMultiSelected
    ? 'border-l-4 border-l-app-accent'
    : 'border-l-4 border-l-transparent';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => onSelect(entry.filename, e)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(entry.filename, e as unknown as ReactMouseEvent);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(entry.filename, e);
      }}
      className={`group w-full h-[80px] flex items-center gap-3 px-3 text-left border-b border-app-border hover:bg-app-bg transition cursor-pointer ${bgClass} ${borderClass}`}
      title={entry.filename}
      aria-pressed={isMultiSelected || isCurrent}
    >
      <div className="relative flex-none w-[72px] h-[56px] bg-app-thumb-placeholder rounded overflow-hidden flex items-center justify-center">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : failed ? (
          <span className="text-[10px] text-app-text-muted">-</span>
        ) : (
          <span className="text-[10px] text-app-text-muted">...</span>
        )}
        <StatusIcon status={status} t={t} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-app-text truncate">{entry.filename}</div>
        <div className="text-xs text-app-text-muted mt-0.5">{statusSubtitle(t, status)}</div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(entry.filename);
        }}
        onContextMenu={(e) => e.stopPropagation()}
        className="flex-none w-7 h-7 rounded-md flex items-center justify-center text-app-text-muted opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-700 focus:opacity-100 transition"
        title={t('imageGridItem.delete.title')}
        aria-label={t('imageGridItem.delete.aria', { filename: entry.filename })}
      >
        🗑
      </button>
    </div>
  );
}
