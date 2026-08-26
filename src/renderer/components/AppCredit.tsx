import { useT } from '../i18n';

// The author's GitHub profile, not the repository: this is a byline.
const AUTHOR_URL = 'https://github.com/Cepeppe';

/**
 * Authorship credit, bottom right. The link is `target="_blank"`, which the
 * main process turns into `shell.openExternal` through its window-open handler:
 * the page opens in the default browser and never inside the app window.
 *
 * This is the only outbound link in the tool, and it only ever opens when the
 * user clicks it: nothing here is requested on its own.
 */
export function AppCredit({ className = '' }: { className?: string }): JSX.Element {
  const t = useT();
  return (
    <a
      href={AUTHOR_URL}
      target="_blank"
      rel="noreferrer"
      title={`${t('credit.openProfile')}: ${AUTHOR_URL}`}
      className={`inline-flex items-center gap-1.5 text-[11px] text-app-text-muted hover:text-app-accent hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-app-accent rounded-sm ${className}`}
    >
      <svg
        viewBox="0 0 16 16"
        width="12"
        height="12"
        aria-hidden="true"
        fill="currentColor"
        className="flex-none"
      >
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
      {t('credit.developedBy')}
    </a>
  );
}
