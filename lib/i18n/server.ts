import { cookies } from "next/headers";

import { isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { getDictionary, type Dictionary } from "./getDictionary";

/**
 * Server-side counterpart to `useLocale`, for server components that render
 * copy. Reads the same detection cookie the middleware writes.
 *
 * The cookie is also how a manual choice reaches the server: `setLocale` in
 * `LocaleProvider` writes it and then calls `router.refresh()`. Without that
 * round trip this function would keep returning the detected locale while the
 * client components had already switched, and the page would end up speaking
 * two languages at once.
 */
export async function getServerLocale(): Promise<Locale> {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(stored) ? stored : "en";
}

export async function getServerDictionary(): Promise<Dictionary> {
  return getDictionary(await getServerLocale());
}
