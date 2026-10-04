import { useEffect, useState } from "react";

import { translateTexts } from "../lib/clientApi";
import { useLocale } from "../i18n/LocaleProvider";

/**
 * Translates dynamic content into the active language.
 *
 * Only unbounded, database- or AI-authored text belongs here — design
 * descriptions, bios, anything with no fixed wording. UI chrome stays in the
 * catalogues, where it renders instantly and identically every time.
 *
 * Returns the source text until the translation lands, then swaps in place.
 * Because the helper never throws, a failure simply keeps the original.
 */
export function useDynamicTranslation(texts: readonly string[]): string[] {
  const { locale, ready } = useLocale();
  const [translated, setTranslated] = useState<string[]>(() => [...texts]);

  // Serialised so an inline array literal does not retrigger on every render.
  const key = JSON.stringify(texts);

  useEffect(() => {
    if (!ready) return;
    const source = JSON.parse(key) as string[];

    let cancelled = false;
    setTranslated([...source]);

    if (source.every((text) => text.trim().length === 0)) return;

    void translateTexts(source, locale, "en").then((next) => {
      if (!cancelled) setTranslated(next);
    });

    return () => {
      cancelled = true;
    };
  }, [key, locale, ready]);

  return translated;
}
