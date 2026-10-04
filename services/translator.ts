/**
 * Runtime translation for *dynamic* content, backed by the configured LLM.
 *
 * Scope: this is deliberately NOT used for UI chrome. Buttons and labels stay
 * in `locales/*.json` because they are fixed, finite and need to render
 * instantly and identically on every visit. What lands here is unbounded text
 * that was authored in one language — AI-generated design descriptions, artist
 * bios, anything coming out of the database — where a static catalogue cannot
 * possibly cover it.
 *
 * The service degrades to the original text on any failure. A missing
 * translation must never blank out a screen.
 */

import { completeJson, LlmError, type LlmMessage } from "./llmClient";

/** Locales we translate *into*. Detection maps any country onto one of these. */
export const TRANSLATION_TARGETS = ["en", "bg"] as const;

export type TranslationTarget = (typeof TRANSLATION_TARGETS)[number];

/** Language names, so the model is not left guessing a bare ISO code. */
const LANGUAGE_NAMES: Record<TranslationTarget, string> = {
  en: "English",
  bg: "Bulgarian",
};

const SYSTEM_PROMPT = `You are a translation engine for a nail-salon booking app.

Rules:
- Translate the meaning, not word for word. Use natural, idiomatic phrasing.
- Preserve every placeholder, URL, hashtag, number and currency amount exactly.
- Never translate proper nouns, brand names or @handles.
- Return one translated string per input string, in the same order.
- Return a JSON object with a "translations" array of strings.`;

export interface TranslateOptions {
  target: TranslationTarget;
  source?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  /** Injected in tests; production resolves these from the server env. */
  provider?: "gemini" | "openai";
  apiKey?: string;
  model?: string;
}

export interface TranslateResult {
  translations: string[];
  /** True when the source and target are the same, so nothing was called. */
  skipped: boolean;
}

const MAX_TEXTS = 40;
const MAX_CHARS_PER_TEXT = 2_000;

/**
 * In-process memo, so a string translated once during a browsing session is
 * never paid for twice. Deliberately not persisted: a stale cache across
 * deploys would serve outdated wording.
 */
const cache = new Map<string, string>();

function cacheKey(text: string, target: TranslationTarget): string {
  return `${target}::${text}`;
}

export function clearTranslationCache(): void {
  cache.clear();
}

/** Number of entries currently memoised. Exposed for tests. */
export function translationCacheSize(): number {
  return cache.size;
}

/**
 * Translates a batch of strings into `target`.
 *
 * Batched on purpose: one round trip for N strings is dramatically cheaper and
 * faster than N round trips, and it keeps related strings in one linguistic
 * context. Cached strings are reused and never re-sent to the model.
 */
export async function translateTexts(
  texts: readonly string[],
  options: TranslateOptions,
): Promise<TranslateResult> {
  const source = options.source ?? "auto";
  if (source.toLowerCase() === options.target) {
    return { translations: [...texts], skipped: true };
  }

  // Resolve what is already memoised before spending a call.
  const results: (string | undefined)[] = texts.map((text) => cache.get(cacheKey(text, options.target)));
  const pendingIndexes: number[] = [];
  texts.forEach((text, index) => {
    if (results[index] === undefined && text.trim().length > 0) pendingIndexes.push(index);
  });

  if (pendingIndexes.length === 0) {
    return { translations: results as string[], skipped: false };
  }

  const batch = pendingIndexes.map((index) => texts[index] as string);

  let translated: string[];
  try {
    const messages: LlmMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Translate these ${batch.length} string(s) into ${LANGUAGE_NAMES[options.target]} (ISO "${options.target}"). Source language: ${source}.\n\n${JSON.stringify(batch)}`,
      },
    ];

    const response = await completeJson<{ translations?: unknown }>(messages, {
      temperature: 0,
      maxOutputTokens: Math.max(512, batch.length * 160),
      signal: options.signal,
      fetchImpl: options.fetchImpl,
      provider: options.provider,
      apiKey: options.apiKey,
      model: options.model,
      requireKeys: ["translations"],
    });

    if (!Array.isArray(response.translations)) {
      throw new LlmError("INVALID_RESPONSE", "translations was not an array.");
    }

    translated = response.translations.map((value) => (typeof value === "string" ? value : ""));
  } catch {
    // Degrade gracefully: keep the original text rather than failing the page.
    return { translations: [...texts], skipped: false };
  }

  pendingIndexes.forEach((originalIndex, batchIndex) => {
    const value = translated[batchIndex];
    if (typeof value === "string" && value.trim().length > 0) {
      results[originalIndex] = value;
      cache.set(cacheKey(texts[originalIndex] as string, options.target), value);
    } else {
      results[originalIndex] = texts[originalIndex];
    }
  });

  return { translations: results as string[], skipped: false };
}
