/**
 * Locale definitions shared by the web app and the middleware.
 *
 * Kept dependency-free and free of React/Next imports so it can run in the
 * Edge middleware, in server components, and in client components alike.
 */

export const LOCALES = ["bg", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie the middleware writes and the client reads on the first paint. */
export const LOCALE_COOKIE = "nailfolio_locale";

/** localStorage key holding an explicit, user-chosen language. */
export const LOCALE_STORAGE_KEY = "nailfolio.locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Maps a country code to a locale. Only Bulgaria is a first-class locale
 * today; every other country falls back to English.
 */
export function localeFromCountry(country: string | null | undefined): Locale {
  if (!country) return DEFAULT_LOCALE;
  return country.trim().toUpperCase() === "BG" ? "bg" : "en";
}

/**
 * Resolves the initial locale from request signals, most reliable first.
 * `x-vercel-ip-country` is set by Vercel's edge network; `accept-language` is
 * the only signal available in local development.
 */
export function detectLocale(headers: {
  get(name: string): string | null;
}): Locale {
  const country = headers.get("x-vercel-ip-country");
  if (country) return localeFromCountry(country);

  const accepted = headers.get("accept-language");
  if (!accepted) return DEFAULT_LOCALE;

  // Honour explicit quality weights so `en;q=0.9,bg;q=1.0` still picks Bulgarian.
  const ranked = accepted
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const quality = qParam ? Number.parseFloat(qParam.split("=")[1] ?? "") : 1;
      return { tag: tag.trim().toLowerCase(), quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const entry of ranked) {
    const primary = entry.tag.split("-")[0];
    if (isLocale(primary)) return primary;
  }

  return DEFAULT_LOCALE;
}
