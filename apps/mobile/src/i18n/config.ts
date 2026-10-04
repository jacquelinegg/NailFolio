/**
 * Locale definitions for the artist app.
 *
 * Mirrors `lib/i18n/config.ts` in the web app. The catalogue keys and the
 * BG/EN mapping stay in sync deliberately; the two apps are separate builds
 * with separate dependencies, so the small duplication is cheaper than wiring
 * a cross-package import into Metro.
 */

export const LOCALES = ["bg", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** AsyncStorage key holding an explicit, user-chosen language. */
export const LOCALE_STORAGE_KEY = "nailfolio.locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Only Bulgaria maps to Bulgarian; everything else is English. */
export function localeFromCountry(country: string | null | undefined): Locale {
  if (!country) return DEFAULT_LOCALE;
  return country.trim().toUpperCase() === "BG" ? "bg" : "en";
}
