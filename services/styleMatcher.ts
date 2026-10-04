/**
 * Style matching: reads a reference image and finds the artists whose real
 * portfolio can execute it.
 *
 * The design constraint mirrors the rest of the product — the model may only
 * ever return tags from `lib/tags.ts`. That vocabulary is the pricing engine's
 * input and the artist app's picker, so an invented tag would price nothing and
 * display nowhere. Everything the model says outside the vocabulary is dropped
 * before scoring.
 *
 * Scoring is a plain weighted overlap, not an embedding lookup: the tag space is
 * 18 values wide, and an exact intersection is both cheaper and more explainable
 * to the customer than a similarity vector they cannot interpret.
 */

import { ALL_STYLE_TAGS, isKnownTag, normaliseTag } from "@/lib/tags";
import { completeJson, type LlmMessage } from "./llmClient";
import type { LlmImage } from "./llmClient";

export interface StyleMatch {
  artistId: string;
  /** 0–100. */
  score: number;
  matchedTags: string[];
}

const SYSTEM_PROMPT = `You analyse nail-art photographs and describe the style so it can be matched against a salon portfolio.

You may ONLY use tags from this fixed list. Never invent, translate or reword a tag:
${ALL_STYLE_TAGS.join(", ")}

Rules:
- "base" describes the colour of the polish underneath (nude, milky_white, black, pastel, red, french_base, bare).
- "technique" describes the finish and decoration applied on top (french, micro_french, ombre, chrome_pearl, glazed, marble, floral, abstract, line_art, 3d_gem, foil, aurora).
- Pick at most 2 base tags and at most 4 technique tags.
- Only include a tag if you can actually see evidence of it in the image. An empty list is a valid and correct answer.
- Return a JSON object: {"base": string[], "technique": string[], "summary": string}.
- "summary" is one short sentence describing the look in plain language.`;

export interface AnalyseImageOptions {
  image: LlmImage;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  provider?: "gemini" | "openai";
  apiKey?: string;
  model?: string;
}

export interface StyleAnalysis {
  baseTags: string[];
  techniqueTags: string[];
  summary: string;
}

function keepKnown(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== "string") continue;
    const tag = normaliseTag(value);
    // The vocabulary check is what keeps hallucinated tags out of the pricing path.
    if (isKnownTag(tag)) seen.add(tag);
  }
  return [...seen];
}

/** Analyses a reference image into the fixed tag vocabulary. */
export async function analyseStyleImage(options: AnalyseImageOptions): Promise<StyleAnalysis> {
  const messages: LlmMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: "Describe the nail style in this image." },
  ];

  const response = await completeJson<{ base?: unknown; technique?: unknown; summary?: unknown }>(
    messages,
    {
      temperature: 0,
      maxOutputTokens: 400,
      requireKeys: ["base", "technique", "summary"],
      images: [options.image],
      signal: options.signal,
      fetchImpl: options.fetchImpl,
      provider: options.provider,
      apiKey: options.apiKey,
      model: options.model,
    },
  );

  return {
    baseTags: keepKnown(response.base).slice(0, 2),
    techniqueTags: keepKnown(response.technique).slice(0, 4),
    summary: typeof response.summary === "string" ? response.summary.trim() : "",
  };
}

/**
 * Scores every artist against the analysed tags.
 *
 * A technique match counts double: a chrome finish or a set of gems is what a
 * customer is really asking for, whereas a base colour is the easiest thing on
 * the list to approximate.
 */
export function rankArtistsByStyle(
  analysis: StyleAnalysis,
  artists: readonly { id: string; tags: string[] }[],
): StyleMatch[] {
  const wanted = new Set<string>([...analysis.baseTags, ...analysis.techniqueTags]);
  if (wanted.size === 0) return [];

  const techniqueSet = new Set(analysis.techniqueTags);

  return artists
    .map((artist) => {
      const owned = new Set(artist.tags.map(normaliseTag));
      const matched = [...wanted].filter((tag) => owned.has(tag));
      if (matched.length === 0) return null;

      const raw = matched.reduce((sum, tag) => sum + (techniqueSet.has(tag) ? 2 : 1), 0);
      const possible = [...wanted].reduce(
        (sum, tag) => sum + (techniqueSet.has(tag) ? 2 : 1),
        0,
      );

      return {
        artistId: artist.id,
        score: Math.round((raw / possible) * 100),
        matchedTags: matched,
      } satisfies StyleMatch;
    })
    .filter((match): match is StyleMatch => match !== null)
    .sort((a, b) => b.score - a.score || a.artistId.localeCompare(b.artistId));
}
