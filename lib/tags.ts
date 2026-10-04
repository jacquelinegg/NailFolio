/**
 * Style tag vocabulary.
 *
 * Every look in the portfolio is described with tags from these three families.
 * The AI generator may only combine tags the artist already owns, so this file
 * is the shared catalogue used by the artist app's tag picker, the pricing
 * engine and the LLM prompt builder.
 */

import type { ComplexityLevel } from "@/lib/types";

export const BASE_STYLE_TAGS = [
  "nude",
  "milky_white",
  "black",
  "pastel",
  "red",
  "french_base",
  "bare",
] as const;

export const TECHNIQUE_TAGS = [
  "french",
  "micro_french",
  "ombre",
  "chrome_pearl",
  "glazed",
  "marble",
  "floral",
  "abstract",
  "line_art",
  "3d_gem",
  "foil",
  "aurora",
] as const;

export const COMPLEXITY_LEVELS: readonly ComplexityLevel[] = ["low", "medium", "high"] as const;

export type BaseStyleTag = (typeof BASE_STYLE_TAGS)[number];
export type TechniqueTag = (typeof TECHNIQUE_TAGS)[number];

const BASE_STYLE_SET: ReadonlySet<string> = new Set(BASE_STYLE_TAGS);
const TECHNIQUE_SET: ReadonlySet<string> = new Set(TECHNIQUE_TAGS);

/** Every tag the MVP understands, base styles first. */
export const ALL_STYLE_TAGS: readonly string[] = [...BASE_STYLE_TAGS, ...TECHNIQUE_TAGS];

export function isBaseStyleTag(tag: string): tag is BaseStyleTag {
  return BASE_STYLE_SET.has(tag);
}

export function isTechniqueTag(tag: string): tag is TechniqueTag {
  return TECHNIQUE_SET.has(tag);
}

export function isComplexityLevel(value: string): value is ComplexityLevel {
  return (COMPLEXITY_LEVELS as readonly string[]).includes(value);
}

export function normaliseTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function isKnownTag(tag: string): boolean {
  return BASE_STYLE_SET.has(tag) || TECHNIQUE_SET.has(tag);
}

/** Human-readable label for UI, e.g. `chrome_pearl` -> `Chrome Pearl`. */
export function tagLabel(tag: string): string {
  return tag
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
