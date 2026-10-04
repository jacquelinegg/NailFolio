"use client";

import { LOCALES, type Locale } from "./config";
import { useLocale } from "./LocaleProvider";

/**
 * Compact BG | EN toggle for the header. The active language is filled and
 * marked with `aria-pressed`; the inactive one stays dimmed so the current
 * choice is obvious at a glance.
 */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      role="group"
      aria-label={t.language.label}
      className={`inline-flex items-center gap-1 rounded-full border border-blush-300/20 bg-ink-900/60 p-0.5 ${className}`}
    >
      {LOCALES.map((code: Locale) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-pressed={active}
            lang={code}
            className={
              active
                ? "cursor-pointer rounded-full bg-blush-300 px-2.5 py-1 text-xs font-semibold text-ink-900 transition"
                : "cursor-pointer rounded-full px-2.5 py-1 text-xs text-blush-300/70 transition hover:text-blush-300"
            }
          >
            {code === "bg" ? t.language.bg : t.language.en}
          </button>
        );
      })}
    </div>
  );
}
