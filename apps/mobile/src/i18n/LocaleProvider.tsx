import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { isLocale, LOCALE_STORAGE_KEY, type Locale } from "./config";
import { detectDeviceLocale } from "./detect";
import { getDictionary, type Dictionary } from "./getDictionary";

interface LocaleContextValue {
  locale: Locale;
  t: Dictionary;
  setLocale: (next: Locale) => void;
  /** False while the stored override and IP detection are still in flight. */
  ready: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // A stored choice is an explicit decision and short-circuits detection.
      let stored: string | null = null;
      try {
        stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
      } catch {
        stored = null;
      }

      if (cancelled) return;
      if (isLocale(stored)) {
        setLocaleState(stored);
        setReady(true);
        return;
      }

      const detected = await detectDeviceLocale();
      if (cancelled) return;
      setLocaleState(detected);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void AsyncStorage.setItem(LOCALE_STORAGE_KEY, next).catch(() => {
      // Persistence is best-effort; the choice still applies this session.
    });
  }, []);

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
