import bg from "@/locales/bg.json";
import en from "@/locales/en.json";

import type { Locale } from "./config";

const DICTIONARIES = { bg, en } as const;

/** The English catalogue is the source of truth for the message shape. */
export type Dictionary = typeof en;

const FALLBACK: Dictionary = en;

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? FALLBACK;
}
