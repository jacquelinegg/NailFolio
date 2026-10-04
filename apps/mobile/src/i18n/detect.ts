import { localeFromCountry, DEFAULT_LOCALE, type Locale } from "./config";

/**
 * Resolves the device's country from its public IP.
 *
 * The web app can read `x-vercel-ip-country` in middleware, but a native app
 * has no such header, so the lookup happens here over HTTPS instead.
 *
 * Never throws and always resolves: detection is a nicety, and a network
 * failure must not stop the app from starting. The device's own locale is the
 * next signal the provider tries, so a failed lookup is not a dead end.
 */
export async function detectCountryCode(timeoutMs = 4000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://ipapi.co/json/", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as { country_code?: unknown };
    return typeof payload.country_code === "string" ? payload.country_code : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** IP country first, then the device locale, then English. */
export async function detectDeviceLocale(): Promise<Locale> {
  const country = await detectCountryCode();
  if (country) return localeFromCountry(country);

  const deviceLocale = Intl.DateTimeFormat().resolvedOptions().locale?.toLowerCase();
  const primary = deviceLocale?.split("-")[0];
  return primary === "bg" ? "bg" : DEFAULT_LOCALE;
}
