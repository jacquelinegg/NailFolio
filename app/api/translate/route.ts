import { NextResponse } from "next/server";

import { jsonError, readJsonBody, requireString, withErrorHandling } from "@/lib/api";
import { translateTexts, TRANSLATION_TARGETS, type TranslationTarget } from "@/services/translator";

export const runtime = "nodejs";
export const maxDuration = 30;

interface TranslateRequest {
  texts?: unknown;
  target?: unknown;
  source?: unknown;
}

const MAX_TEXTS = 40;

/**
 * POST /api/translate  { texts: string[], target: "en" | "bg", source?: string }
 * -> { translations: string[] }
 *
 * The LLM call is proxied through the server on purpose: `GEMINI_API_KEY` is
 * server-only and must never reach the browser or the Expo bundle.
 *
 * Open to the public because it only spends the caller's own quota and carries
 * no user data beyond the text submitted. It degrades to echoing the input
 * rather than erroring, so a translation outage never breaks a screen.
 */
export async function POST(request: Request) {
  return withErrorHandling(async () => {
    const body = await readJsonBody<TranslateRequest>(request);

    if (!Array.isArray(body.texts)) {
      return jsonError(400, "INVALID_REQUEST", "texts must be an array of strings.");
    }
    if (body.texts.length > MAX_TEXTS) {
      return jsonError(400, "INVALID_REQUEST", `texts may contain at most ${MAX_TEXTS} items.`);
    }

    const texts = body.texts.map((value, index) =>
      requireString(value, `texts[${index}]`, { max: 2_000, min: 0 }),
    );

    const target = requireString(body.target, "target", { max: 8 });
    if (!(TRANSLATION_TARGETS as readonly string[]).includes(target)) {
      return jsonError(400, "INVALID_REQUEST", `target must be one of: ${TRANSLATION_TARGETS.join(", ")}.`);
    }

    const source = typeof body.source === "string" ? body.source.slice(0, 16) : "auto";

    const result = await translateTexts(texts, {
      target: target as TranslationTarget,
      source,
    });

    return NextResponse.json(result);
  });
}
