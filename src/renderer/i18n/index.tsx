import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import {
  DEFAULT_LOCALE,
  createTranslator,
  formatDateTime,
  formatNumber,
  translate,
  type Locale,
  type TranslateFn,
  type TranslationKey,
  type TranslationParams
} from '@shared/i18n';

/**
 * Active locale for the whole renderer.
 *
 * It lives in a module variable rather than only in React state because a few
 * call sites are outside the component tree (the ErrorBoundary class, plain
 * helper functions in AppLayout). React consumers subscribe through
 * {@link I18nProvider} and re-render when the value changes.
 */
let currentLocale: Locale = DEFAULT_LOCALE;
const subscribers = new Set<(locale: Locale) => void>();

export function getLocale(): Locale {
  return currentLocale;
}

/** Applies the locale everywhere and updates the `lang` attribute of the page. */
export function setLocale(locale: Locale): void {
  if (locale === currentLocale) return;
  currentLocale = locale;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
  for (const notify of subscribers) notify(locale);
}

/** Translator usable outside React. Prefer {@link useT} inside components. */
export function t(key: TranslationKey, params?: TranslationParams): string {
  return translate(currentLocale, key, params);
}

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({ children }: { children: ReactNode }): JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(currentLocale);

  useEffect(() => {
    subscribers.add(setLocaleState);
    // The locale may have changed between the initial render and this effect.
    setLocaleState(currentLocale);
    return () => {
      subscribers.delete(setLocaleState);
    };
  }, []);

  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT(): TranslateFn {
  const locale = useLocale();
  return useMemo(() => createTranslator(locale), [locale]);
}

export function useNumberFormat(): (value: number, options?: Intl.NumberFormatOptions) => string {
  const locale = useLocale();
  return useCallback(
    (value, options) => formatNumber(locale, value, options),
    [locale]
  );
}

export function useDateTimeFormat(): (iso: string) => string {
  const locale = useLocale();
  return useCallback((iso: string) => formatDateTime(locale, iso), [locale]);
}
