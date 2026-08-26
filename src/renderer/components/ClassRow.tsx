import { useEffect, useRef, useState } from 'react';
import { classNameToColor } from '@shared/colorPalette';
import { useT } from '../i18n';

interface ClassRowProps {
  classId: number;
  name: string;
  count: number;
  isCurrent: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (newName: string) => Promise<void> | void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function ClassRow({
  classId,
  name,
  count,
  isCurrent,
  canMoveUp,
  canMoveDown,
  onSelect,
  onDelete,
  onRename,
  onMoveUp,
  onMoveDown
}: ClassRowProps): JSX.Element {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const color = classNameToColor(name).hex;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  const commit = async (): Promise<void> => {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed === name) {
      setEditing(false);
      setDraft(name);
      return;
    }
    setEditing(false);
    await onRename(trimmed);
  };

  return (
    <div
      className={`group flex items-center gap-1 px-2 py-1.5 cursor-pointer border-b border-app-border/50 ${
        isCurrent ? 'bg-app-accent/10' : 'hover:bg-app-bg'
      }`}
      onClick={() => {
        if (!editing) onSelect();
      }}
    >
      <span
        className="inline-block w-3.5 h-3.5 rounded-full border border-black/20 flex-none"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            void commit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setEditing(false);
              setDraft(name);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 text-sm border border-app-border rounded px-1 py-0.5"
        />
      ) : (
        <span
          className="flex-1 min-w-0 truncate text-sm"
          title={t('classRow.renameHint', { name })}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          {name}
        </span>
      )}
      <span className="text-xs text-app-text-muted flex-none w-6 text-right tabular-nums">
        {classId}
      </span>
      <span className="text-xs text-app-text-muted flex-none w-12 text-right tabular-nums">
        {count}
      </span>
      <div className="flex-none flex items-center opacity-0 group-hover:opacity-100">
        <button
          type="button"
          title={t('classRow.moveUp.title')}
          disabled={!canMoveUp}
          onClick={(e) => {
            e.stopPropagation();
            if (canMoveUp) onMoveUp();
          }}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-app-bg disabled:opacity-30 disabled:cursor-not-allowed text-app-text"
          aria-label={t('classRow.moveUp.aria')}
        >
          ↑
        </button>
        <button
          type="button"
          title={t('classRow.moveDown.title')}
          disabled={!canMoveDown}
          onClick={(e) => {
            e.stopPropagation();
            if (canMoveDown) onMoveDown();
          }}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-app-bg disabled:opacity-30 disabled:cursor-not-allowed text-app-text"
          aria-label={t('classRow.moveDown.aria')}
        >
          ↓
        </button>
        <button
          type="button"
          title={t('classRow.rename.title')}
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-app-bg text-app-text"
          aria-label={t('classRow.rename.aria')}
        >
          ✏️
        </button>
        <button
          type="button"
          title={t('classRow.delete.title', { name })}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 text-red-700"
          aria-label={t('classRow.delete.aria')}
        >
          🗑
        </button>
      </div>
    </div>
  );
}
