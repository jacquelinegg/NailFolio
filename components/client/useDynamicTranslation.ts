"use client";

import { useEffect, useState } from "react";

import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * Translates dynamic, database- or AI-authored text into the active language.
 *
 * The web counterpart of the artist app's hook of the same name. UI chrome stays
 * in `locales/*.json`; only unbounded text — model summaries, artist copy —
 * belongs here, where a static catalogue cannot reach.
 *
 * Entries are `undefined` until they are translated, so the caller can apply its
 * own display fallback: returning the raw source would flash an untranslated
 * `chrome_pearl` slug where a reader expects "Chrome Pearl". Prose falls back to
 * the source string, which is correct; a slug needs formatting first. A failed
 * translation stays `undefined` rather than blanking the text.
 */
export function useDynamicTranslation(texts: readonly string[]): (string | undefined)[] {
  const { locale, ready } = useLocale();
  const [translated, setTranslated] = useState<(string | undefined)[]>(() =>
    texts.map(() => undefined),
  );

  // Serialised so an inline array literal does not retrigger on every render.
  const key = JSON.stringify(texts);

  useEffect(() => {
    const source = JSON.parse(key) as string[];

    let cancelled = false;
    setTranslated(source.map(() => undefined));

    if (!ready) return;
    if (source.every((text) => text.trim().length === 0)) return;

    // Dynamic content is authored in English. When the reader is already on
    // English there is nothing to translate, so no request is made at all —
    // this also keeps the hook free of network calls in tests.
    if (locale === "en") return;

    void (async () => {
      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: source, target: locale, source: "en" }),
        });
        if (!response.ok) return;

        const payload = (await response.json()) as { translations?: unknown };
        if (!Array.isArray(payload.translations)) return;

        const next = payload.translations.map((value) =>
          typeof value === "string" && value.trim().length > 0 ? value : undefined,
        );
        if (!cancelled) setTranslated(next);
      } catch {
        // Keep the caller's fallback; a missing translation must not blank the page.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, locale, ready]);

  return translated;
}
