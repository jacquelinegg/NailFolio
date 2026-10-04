/**
 * AI Design Generator — produces artist-aware manicure designs.
 *
 * Flow:
 *  1. Optionally analyze an inspiration image via Gemini Vision to synthesize
 *     a design that matches the outfit/style.
 *  2. Cross-reference with the artist's supported tag dictionary.
 *  3. Fall back to randomized generation if no image is provided.
 *  4. Convert to an ArtistAwareDesign for the client + render pipeline.
 *
 * Uses:
 *  - `llmClient.ts` for Gemini Vision analysis.
 *  - `manicureGenerator.ts` for structured randomization fallback.
 *  - `youcamService.ts` for realistic rendering (via `/api/render`).
 */

import { completeJson } from "@/services/llmClient";
import { getArtistById } from "@/lib/supabase";
import { serverEnv } from "@/lib/env";
import {
  type ArtistAwareDesign,
  type ComplexityLevel,
  type Look,
  type PriceEstimate,
  type PriceLineItem,
} from "@/lib/types";
import { ALL_STYLE_TAGS, BASE_STYLE_TAGS, COMPLEXITY_LEVELS, TECHNIQUE_TAGS, isKnownTag, normaliseTag } from "@/lib/tags";
import { generateManicure } from "./manicureGenerator";
import { buildPriceEstimate, pricingConfigFromArtist } from "./pricing";
import { generateNailReferenceImage } from "./nailReferenceImage";

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

export class AiGeneratorError extends Error {
  readonly code: "LOOK_NOT_FOUND" | "NO_PORTFOLIO" | "GENERATION_FAILED" | "VISION_FAILED";

  constructor(code: AiGeneratorError["code"], message: string) {
    super(message);
    this.name = "AiGeneratorError";
    this.code = code;
  }
}

/* -------------------------------------------------------------------------- */
/* Vision analysis                                                             */
/* -------------------------------------------------------------------------- */

interface DesignSpec {
  base_style: string;
  techniques: string[];
  suggested_colors: string[];
  complexity_level: ComplexityLevel;
  description: string;
}

const SYSTEM_PROMPT = `You are a nail art stylist. Analyze the inspiration image and the artist's supported tag vocabulary to produce a precise, deterministic design specification.

Rules:
- Base style must be one of: ${BASE_STYLE_TAGS.join(", ")}.
- Techniques must be from: ${TECHNIQUE_TAGS.join(", ")}.
- Complexity must be one of: ${COMPLEXITY_LEVELS.join(", ")}.
- Return only JSON matching the contract. No markdown, no extra text.`;

const USER_PROMPT = (artistTags: readonly string[]) => `Analyze this inspiration image and suggest a nail design that matches its vibe and colors.

Supported tags for this artist: ${artistTags.join(", ")}

Return JSON with these exact keys:
{
  "base_style": "one of the supported base styles",
  "techniques": ["array of supported technique tags"],
  "suggested_colors": ["#HEX values matching the image palette"],
  "complexity_level": "low | medium | high",
  "description": "1-2 sentences explaining why this design suits the outfit and artist style"
}`;

export async function analyzeInspirationImage(
  imageBase64: string,
  mimeType: string,
  artistId: string,
): Promise<DesignSpec> {
  const artist = await getArtistById(artistId);
  if (!artist) {
    throw new AiGeneratorError("NO_PORTFOLIO", "Artist not found.");
  }

  const artistTags = Array.from(new Set((artist as unknown as { tags?: string[] }).tags ?? ALL_STYLE_TAGS)).filter(
    (tag) => isKnownTag(normaliseTag(tag)),
  );

  const supportedTags = artistTags.length > 0 ? artistTags : ALL_STYLE_TAGS;

  try {
    const spec = await completeJson<DesignSpec>(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT(supportedTags) },
      ],
      {
        images: [{ base64: imageBase64, mimeType }],
        temperature: 0.7,
        maxOutputTokens: 400,
        requireKeys: ["base_style", "techniques", "suggested_colors", "complexity_level", "description"],
      },
    );

    const normalised: DesignSpec = {
      base_style: normaliseTag(spec.base_style),
      techniques: spec.techniques.map(normaliseTag).filter((t) => isKnownTag(t)),
      suggested_colors: spec.suggested_colors.filter((c) => /^#[0-9A-Fa-f]{6}$/.test(c)),
      complexity_level: COMPLEXITY_LEVELS.includes(spec.complexity_level) ? spec.complexity_level : "medium",
      description: spec.description.trim() || "AI-generated design inspired by your outfit.",
    };

    if (!isKnownTag(normalised.base_style) || normalised.techniques.length === 0) {
      throw new AiGeneratorError("VISION_FAILED", "Vision analysis returned unsupported tags.");
    }

    return normalised;
  } catch (error) {
    if (error instanceof AiGeneratorError) throw error;
    throw new AiGeneratorError("VISION_FAILED", "Gemini Vision analysis failed.");
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

interface GenerateArtistAwareDesignOptions {
  artistId: string;
  anchorLookId?: string | null;
  /** Optional inspiration image for vision-based design synthesis. */
  inspirationImage?: { base64: string; mimeType: string } | null;
}

/**
 * Generates an artist-aware manicure design. If an inspiration image is provided,
 * uses Gemini Vision to synthesize a matching design; otherwise falls back to
 * randomized generation grounded in the artist's portfolio.
 */
export async function generateArtistAwareDesign(
  options: GenerateArtistAwareDesignOptions,
): Promise<ArtistAwareDesign> {
  const { artistId, anchorLookId, inspirationImage } = options;

  const artist = await getArtistById(artistId);
  if (!artist) {
    throw new AiGeneratorError("NO_PORTFOLIO", "Artist not found.");
  }

  let anchorLook: Look | null = null;
  let portfolioReference: Look | null = null;
  if (anchorLookId) {
    const { listLooksForArtist } = await import("@/lib/supabase");
    const looks = await listLooksForArtist(artistId);
    anchorLook = looks.find((l) => l.id === anchorLookId) ?? null;
    if (!anchorLook) {
      throw new AiGeneratorError("LOOK_NOT_FOUND", `Look ${anchorLookId} not found for this artist.`);
    }
  } else {
    try {
      const { listLooksForArtist } = await import("@/lib/supabase");
      portfolioReference = (await listLooksForArtist(artistId))[0] ?? null;
    } catch {
      portfolioReference = null;
    }
  }

  let designSpec: DesignSpec | null = null;
  if (inspirationImage && serverEnv.imageProvider !== "local") {
    try {
      designSpec = await analyzeInspirationImage(inspirationImage.base64, inspirationImage.mimeType, artistId);
    } catch {
      designSpec = null;
    }
  }

  const complexity = designSpec?.complexity_level ?? anchorLook?.complexity_level ?? "medium";
  const usedTags = designSpec
    ? [...new Set([...designSpec.techniques, designSpec.base_style])]
    : anchorLook?.tags ?? [];
  let description: string;
  let prompt: string;
  let sourceLookId: string | null = anchorLookId ?? null;

  if (designSpec) {
    description = designSpec.description;
    prompt = buildVisionPrompt(designSpec);
    sourceLookId = null;
  } else {
    const manicure = generateManicure();
    description = manicure.description;
    prompt = buildYouCamPrompt(manicure);
  }

  let refImageUrl = anchorLook?.image_url ?? "";
  if (!refImageUrl && serverEnv.imageProvider !== "local") {
    try {
      refImageUrl = await generateNailReferenceImage({
        name: "Custom salon manicure",
        description,
        designPrompt: prompt,
      }) ?? "";
    } catch (error) {
      console.warn("[AI Design] Photoreal reference generation failed.", error);
    }
  }
  refImageUrl ||= portfolioReference?.image_url ?? "";

  const estimate = buildPriceEstimate({
    config: pricingConfigFromArtist(artist),
    usedTags,
    complexity,
  });

  return {
    description,
    prompt,
    refImageUrl,
    usedTags,
    estimate,
    complexity,
    sourceLookId,
  };
}

/**
 * Converts a vision-based design spec into a YouCam-compatible prompt.
 */
function buildVisionPrompt(spec: DesignSpec): string {
  const techniqueStr = spec.techniques.length > 0 ? spec.techniques.join(" and ") : "artistic";
  const colorStr = spec.suggested_colors.length > 0 ? spec.suggested_colors.join(", ") : "coordinated palette";

  return `${spec.base_style} base nails with ${techniqueStr} technique. Colors: ${colorStr}. ${spec.description}`;
}

/**
 * Converts a structured manicure config into a YouCam-compatible prompt.
 */
function buildYouCamPrompt(manicure: ReturnType<typeof generateManicure>): string {
  const nailDescriptions = Object.entries(manicure.nails)
    .map(([finger, config]) => {
      const fingerName = {
        thumb: "thumb",
        index: "index finger",
        middle: "middle finger",
        ring: "ring finger",
        pinky: "pinky finger",
      }[finger];

      return `${fingerName}: ${config.base} base with ${config.finish} finish, ${config.pattern} pattern`;
    })
    .join("; ");

  return `${manicure.name} manicure on ${manicure.shape} shaped nails. ${nailDescriptions}. ${manicure.description}`;
}
