"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getDictionary, type Dictionary } from "./getDictionary";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  type Locale,
} from "./config";

interface LocaleContextValue {
  /** The locale actually in use. */
  locale: Locale;
  /** Translation catalogue for the active locale. */
  t: Dictionary;
  /** Switches language and persists the choice as a manual override. */
  setLocale: (next: Locale) => void;
  /** False until the stored override has been read, to avoid a flash of the wrong language. */
  ready: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** Matches the lifetime the middleware gives the cookie, so the two agree. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    // Safari in private mode throws on access; fall back to the auto-detected locale.
    return null;
  }
}

/**
 * Publishes the locale where the server can see it.
 *
 * Most of the page copy is rendered by server components, which read this
 * cookie through `getServerDictionary()`. Their output is already in the
 * streamed HTML, so changing React state cannot reach it — a client-only
 * switch translated the header and the client studios while every
 * server-rendered section stayed in the old language. The cookie is the
 * channel back to the server, and `router.refresh()` makes it re-render.
 */
function writeLocaleCookie(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.cookie =
    `${LOCALE_COOKIE}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

export function LocaleProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: ReactNode;
  /** Locale chosen by the server from the request (IP country or Accept-Language). */
  initialLocale?: Locale;
}) {
  const router = useRouter();

  // Always start from the server value so the first client render matches the
  // markup that was streamed, then upgrade to the stored override after mount.
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStoredLocale();
    setReady(true);
    if (!stored) return;

    setLocaleState(stored);

    // The stored choice outranks the cookie, but the server has already
    // rendered from the cookie. Sync it and re-render, otherwise a refresh
    // would show the detected language again. The re-render feeds the new
    // cookie back as `initialLocale`, so this converges after one pass.
    if (stored !== initialLocale) {
      writeLocaleCookie(stored);
      router.refresh();
    }
  }, [initialLocale, router]);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      } catch {
        // Storage is unavailable; the choice still applies for this session.
      }
      writeLocaleCookie(next);
      if (typeof document !== "undefined") {
        document.documentElement.lang = next;
      }
      // Client components pick the new locale up from state on their own. The
      // server-rendered sections need an explicit round trip.
      router.refresh();
    },
    [router],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: getDictionary(locale), setLocale, ready }),
    [locale, setLocale, ready],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used inside a <LocaleProvider>.");
  }
  return context;
}
