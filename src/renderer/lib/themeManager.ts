import type { AppTheme } from '@shared/types';

/**
 * Adds or removes the `dark` class on <html>. Tailwind runs in `class` strategy
 * (see `tailwind.config.js`) and the CSS variables in `index.css` map the
 * semantic tokens for each theme. Idempotent, and a no-op without a document.
 */
export function applyTheme(theme: AppTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.dataset['theme'] = theme;
}

export function readCurrentTheme(): AppTheme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}
