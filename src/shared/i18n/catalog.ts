import { en } from './en';
import { it } from './it';
import type { Locale } from './types';

/** Every string the UI can show is addressed by one of these keys. */
export type TranslationKey = keyof typeof en;

export type Catalog = Record<TranslationKey, string>;

/**
 * Compile-time guard: a locale that misses a key, or invents one, fails
 * `tsc --noEmit` here instead of silently rendering a raw key at runtime.
 */
const itCatalog: Catalog = it;

export const CATALOGS: Record<Locale, Catalog> = {
  en,
  it: itCatalog
};
