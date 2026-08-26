import { CATALOGS, type TranslationKey } from './catalog';
import {
  DEFAULT_LOCALE,
  INTL_LOCALE,
  LOCALES,
  type LanguagePreference,
  type Locale,
  type TranslationParams
} from './types';

export {
  DEFAULT_LANGUAGE_PREFERENCE,
  DEFAULT_LOCALE,
  INTL_LOCALE,
  LOCALES
} from './types';
export type { LanguagePreference, Locale, TranslationParams } from './types';
export type { Catalog, TranslationKey } from './catalog';

const PLACEHOLDER_RE = /\{(\w+)\}/g;

export type TranslateFn = (key: TranslationKey, params?: TranslationParams) => string;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === 'system' || isLocale(value);
}

/**
 * Turns a stored preference into a concrete locale. `systemTag` is whatever the
 * platform reports (`navigator.language` in the renderer, `app.getLocale()` in
 * the main process); only its primary subtag matters, so both `it` and `it-CH`
 * resolve to Italian. Anything unsupported falls back to {@link DEFAULT_LOCALE}.
 */
export function resolveLocale(
  preference: LanguagePreference,
  systemTag?: string | null
): Locale {
  if (isLocale(preference)) return preference;
  const primary = (systemTag ?? '').toLowerCase().split(/[-_]/)[0];
  return isLocale(primary) ? primary : DEFAULT_LOCALE;
}

/**
 * Looks a key up in `locale`, falls back to English, and substitutes every
 * `{placeholder}` found in the message. An unknown placeholder is left as-is so
 * a typo is visible instead of silently swallowed.
 */
export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: TranslationParams
): string {
  const message = CATALOGS[locale][key] ?? CATALOGS[DEFAULT_LOCALE][key] ?? key;
  if (!params) return message;
  return message.replace(PLACEHOLDER_RE, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export function createTranslator(locale: Locale): TranslateFn {
  return (key, params) => translate(locale, key, params);
}

/**
 * Picks between the `.one` and `.other` variants of a message. English and
 * Italian share the same rule (exactly one vs. anything else), so a single
 * comparison covers both catalogs; `count` is always available as a placeholder.
 */
export function plural(
  t: TranslateFn,
  count: number,
  oneKey: TranslationKey,
  otherKey: TranslationKey,
  params?: TranslationParams
): string {
  return t(count === 1 ? oneKey : otherKey, { count, ...params });
}

export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], options).format(value);
}

export function formatDateTime(locale: Locale, iso: string): string {
  try {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
