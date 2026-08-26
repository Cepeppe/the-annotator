import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface ContextMenuItem {
  /** Item label. Separators use `kind: 'separator'` and no label. */
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** 'item' (default) or 'separator'. */
  kind?: 'item' | 'separator';
  /** Visual variant; 'danger' renders destructive actions in red. */
  variant?: 'default' | 'danger';
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

const MENU_MARGIN = 4;

/**
 * Generic context menu. It repositions itself to stay inside the viewport
 * (moving up or left when the click point would overflow) and closes on Esc,
 * on an outside click and after an item is invoked.
 */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = x;
    let top = y;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (left + r.width + MENU_MARGIN > vw) left = Math.max(MENU_MARGIN, vw - r.width - MENU_MARGIN);
    if (top + r.height + MENU_MARGIN > vh) top = Math.max(MENU_MARGIN, vh - r.height - MENU_MARGIN);
    setPos({ left, top });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    const onScroll = (): void => onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
      role="presentation"
    >
      <div
        ref={ref}
        role="menu"
        style={{ left: pos.left, top: pos.top }}
        className="absolute min-w-[200px] bg-app-surface border border-app-border rounded-md shadow-xl py-1 text-sm text-app-text"
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((it, i) => {
          if (it.kind === 'separator') {
            return (
              <div key={`sep-${i}`} className="my-1 h-px bg-app-border" role="separator" />
            );
          }
          const danger = it.variant === 'danger';
          return (
            <button
              key={`${it.label}-${i}`}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                if (it.disabled) return;
                onClose();
                it.onClick?.();
              }}
              className={`w-full text-left px-3 py-1.5 hover:bg-app-bg disabled:opacity-40 disabled:cursor-not-allowed ${
                danger ? 'text-red-600' : ''
              }`}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
