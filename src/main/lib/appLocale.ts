import {
  DEFAULT_LANGUAGE_PREFERENCE,
  DEFAULT_LOCALE,
  resolveLocale,
  translate,
  type LanguagePreference,
  type Locale,
  type TranslationKey,
  type TranslationParams
} from '../../shared/i18n';

/**
 * Locale of the main process. It mirrors the renderer: both read the same
 * `language` user setting at boot, and the renderer pushes every later change
 * over IPC, so the native menu, the folder picker and the messages built here
 * stay in the language the user selected.
 *
 * This module deliberately does not import `electron`: it is pulled in by
 * modules that run under Vitest in a plain Node environment. The caller passes
 * the system locale tag (`app.getLocale()`) instead.
 */
let currentLocale: Locale = DEFAULT_LOCALE;

export function getMainLocale(): Locale {
  return currentLocale;
}

export function setLanguagePreference(
  preference: LanguagePreference = DEFAULT_LANGUAGE_PREFERENCE,
  systemTag?: string | null
): Locale {
  currentLocale = resolveLocale(preference, systemTag);
  return currentLocale;
}

/** Translator bound to the current main-process locale. */
export function mt(key: TranslationKey, params?: TranslationParams): string {
  return translate(currentLocale, key, params);
}
