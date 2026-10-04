import bg from "../../../../locales/bg.json";
import en from "../../../../locales/en.json";

import type { Locale } from "./config";

const DICTIONARIES = { bg, en } as const;

/** The English catalogue defines the message shape. */
export type Dictionary = typeof en;

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? en;
}
