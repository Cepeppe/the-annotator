/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/**/*.{ts,tsx}'
  ],
  // Dark mode is driven by a `.dark` class that themeManager puts on <html>.
  // The `app-*` tokens are CSS variables whose concrete value changes with the
  // theme, through the `.dark` override in `src/renderer/index.css`. This keeps
  // every component free of `dark:` modifiers.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'app-bg': 'var(--color-app-bg)',
        'app-surface': 'var(--color-app-surface)',
        'app-border': 'var(--color-app-border)',
        'app-text': 'var(--color-app-text)',
        'app-text-muted': 'var(--color-app-text-muted)',
        'app-accent': 'var(--color-app-accent)',
        'app-canvas-bg': 'var(--color-app-canvas-bg)',
        'app-row-current': 'var(--color-app-row-current)',
        'app-thumb-placeholder': 'var(--color-app-thumb-placeholder)'
      }
    }
  },
  plugins: []
};
