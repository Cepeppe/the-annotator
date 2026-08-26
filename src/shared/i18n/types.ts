export const LOCALES = ['en', 'it'] as const;

export type Locale = (typeof LOCALES)[number];

/** Locale used whenever nothing else can be resolved. */
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * What the user picks in Settings. `system` follows the operating system
 * language and falls back to {@link DEFAULT_LOCALE} when it is not supported.
 */
export type LanguagePreference = Locale | 'system';

export const DEFAULT_LANGUAGE_PREFERENCE: LanguagePreference = 'system';

/** Values that can be interpolated into a message placeholder. */
export type TranslationParams = Record<string, string | number>;

/** BCP 47 tag used for date and number formatting in each locale. */
export const INTL_LOCALE: Record<Locale, string> = {
  en: 'en-US',
  it: 'it-IT'
};
