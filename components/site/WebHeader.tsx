"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LanguageToggle } from "@/lib/i18n/LanguageToggle";

const LINKS = [
  { href: "/", key: "home" },
  { href: "/artists", key: "artists" },
  { href: "/search", key: "search" },
  { href: "/nail-of-the-day", key: "nailOfTheDay" },
  { href: "/book", key: "book" },
] as const;

/**
 * The one header, rendered once in the root layout.
 *
 * It used to be duplicated across six routes, each with its own hardcoded
 * highlight, so every navigation change meant six edits. Deriving the active
 * link from the pathname removes the duplication and makes the highlight
 * correct on any page the header did not know about.
 *
 * The chrome stays near-transparent so the sparkle field reads through it,
 * matching the artist app's header. On narrow screens the links scroll
 * horizontally instead of stacking into three rows.
 */
export function WebHeader() {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <header className="site-header">
      <div className="mx-auto flex max-w-1100 items-center justify-between gap-4 px-5 py-3 md:py-4">
        <Link
          href="/"
          className="shrink-0 font-[var(--font-serif)] text-2xl tracking-wide md:text-[28px]"
        >
          NailFolio
        </Link>

        <nav className="site-nav text-sm">
          {LINKS.map((item) => {
            // Exact match for the home page, prefix match for the rest, so
            // `/artists` stays lit while visiting `/artists/...`.
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "whitespace-nowrap text-pearl-50"
                    : "whitespace-nowrap text-blush-300/80 transition hover:text-pearl-50"
                }
              >
                {t.nav[item.key]}
              </Link>
            );
          })}
          <LanguageToggle />
        </nav>
      </div>
    </header>
  );
}
