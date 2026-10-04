import { NextResponse } from "next/server";

import { jsonError, jsonOk, corsPreflightResponse, withErrorHandling } from "@/lib/api";
import { completeJson } from "@/services/llmClient";
import { generateNailReferenceImage } from "@/services/nailReferenceImage";
import { generatePalette } from "@/lib/palette";
import { serverEnv } from "@/lib/env";
import type { NailOfTheDayDesign } from "@/lib/types";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:8081",
  "http://192.168.0.100:3000",
  "http://192.168.0.100:8081",
] as const;

function pickOrigin(origin: string | null): string {
  return origin && ALLOWED_ORIGINS.includes(origin as (typeof ALLOWED_ORIGINS)[number]) ? origin : ALLOWED_ORIGINS[0];
}

const PATTERNS = [
  "french",
  "gradient",
  "glitter_accent",
  "chrome_accent",
  "matte_overlay",
  "gloss_highlight",
  "geometric",
  "dots",
  "marble",
  "watercolor",
  "fishnet",
  "sparkle",
  "lace",
  "chrome_heart",
  "galaxy",
  "paint_brush",
  "gloss_band",
  "metallic_stripe",
  "checker",
  "floral",
  "abstract",
  "minimalist",
  "retro",
  "art_deco",
  "gradient_glow",
  "matte_chrome",
  "glitter_rain",
  "starry_night",
] as const;

const FINISHES = [
  "cream",
  "glossy",
  "matte",
  "metallic",
  "chrome",
  "pearl",
  "shimmer",
  "jelly",
  "sheer",
  "satin",
  "velvet",
  "iridescent",
  "holographic",
  "matte_metallic",
  "gloss_chrome",
  "pearl_shimmer",
  "paint_brush",
  "gloss_highlight",
  "matte_overlay",
  "metallic_stripe",
] as const;

const SHAPES = ["almond", "coffin_ballerina", "square", "stiletto", "oval", "squoval", "round", "lipstick"] as const;

const GEMINI_DESIGN_SYSTEM_PROMPT = `You are a bold, avant-garde nail-art director. Invent a striking, unforgettable, 2D flat design for one artificial nail. Be daring, unconventional, and visually arresting. Mix unexpected color combinations, mixed finishes, metallic foil, holographic shift, chrome, glitter, marble veins, watercolor bleeds, geometric lines, lace filigree, aura glow, cat-eye stripe, french tip contrast, paint brush strokes, gloss highlight, matte overlay, metallic stripe, brush stroke texture, gloss band. Use color theory: complementary, analogous, triadic, split-complementary, tetradic, or monochromatic with a daring accent. The nail should look like a small piece of art, not a generic swatch. IMPORTANT: This is a 2D flat design, not 3D. No dimensional effects, no embossing, no raised decorations, no 3D shapes. Return one JSON object with exactly these keys: name, description, imagePrompt, pattern, finish, colors, complexity, motifs. Use the key "description" exactly. imagePrompt is a rich visual prompt for a local diffusion model: describe one detached single nail tip, its shape, base color, finish, artwork, motif placement, linework and lighting. NEVER describe a hand, fingers, skin, a full manicure or a photo of a person. Make the nail itself visually interesting, not a generic color swatch. Use one clear focal illustration and a few refined supporting details. Coordinate the palette and motifs as one concept; avoid random stickers and crowding. name is a short design title; description is one concise salon description. pattern must be one of: ${PATTERNS.join(", ")}. finish must be one of: ${FINISHES.join(", ")}. colors must be 2-4 colors in #RRGGBB format. complexity must be medium or complex. imagePrompt must be 40-100 words and include explicit placement/scale for every focal detail. motifs must contain 3-5 objects with kind (star, flower, heart, butterfly, pearl, bow, flame, leaf, sparkle, gem, cherry, citrus, strawberry, rainbow), role (focal, support, micro), x/y in 24-94, size 2.5-10, color #RRGGBB, and optional rotation -45..45.`;

const MOTIF_KINDS = ["star", "flower", "heart", "butterfly", "pearl", "bow", "flame", "leaf", "sparkle", "gem", "cherry", "citrus", "strawberry", "rainbow"] as const;

interface Motif {
  kind: typeof MOTIF_KINDS[number];
  role: "focal" | "support" | "micro";
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
}

interface AiDesignResponse {
  name: string;
  description: string;
  imagePrompt: string;
  pattern: string;
  finish: string;
  colors: string[];
  complexity: string;
  motifs: unknown[];
}

function normaliseMotifs(value: unknown, colors: string[]): Motif[] {
  if (!Array.isArray(value)) return [];
  const motifs: Motif[] = [];
  for (const candidate of value) {
    if (motifs.length >= 5) break;
    if (!candidate || typeof candidate !== "object") continue;
    const motif = candidate as Partial<Motif>;
    if (
      !MOTIF_KINDS.includes(motif.kind as typeof MOTIF_KINDS[number]) ||
      !Number.isFinite(motif.x) ||
      !Number.isFinite(motif.y) ||
      !Number.isFinite(motif.size)
    ) continue;

    motifs.push({
      kind: motif.kind as typeof MOTIF_KINDS[number],
      x: Math.min(72, Math.max(28, motif.x as number)),
      y: Math.min(94, Math.max(24, motif.y as number)),
      size: Math.min(10, Math.max(2.5, motif.size as number)),
      color: typeof motif.color === "string" && /^#[0-9a-f]{6}$/i.test(motif.color)
        ? motif.color
        : colors[motifs.length % colors.length] ?? "#FFFFFF",
      rotation: Number.isFinite(motif.rotation) ? Math.min(45, Math.max(-45, motif.rotation as number)) : 0,
      role: ["focal", "support", "micro"].includes(motif.role as string)
        ? motif.role as "focal" | "support" | "micro"
        : motifs.length === 0 ? "focal" : motifs.length > 3 ? "micro" : "support",
    });
  }
  return motifs;
}

function pickFromHash(hash: number, options: readonly string[]): string {
  return options[Math.abs(hash) % options.length] ?? options[0] ?? "";
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildLayers(pattern: string, palette: string[], complexity: string, seed: number, finish: string) {
  const base = { type: "fill" as const, colors: [palette[0] ?? "#E8D5CE"], opacity: 1 };
  const layers: { type: "fill" | "stroke" | "pattern" | "shape" | "filter"; pattern?: string; colors?: string[]; opacity?: number; width?: number }[] = [base];
  if (pattern === "french") layers.push({ type: "stroke", pattern: "french_tip", colors: [palette[1] ?? "#FFFFFF"], opacity: 0.95, width: 6 });
  if (pattern === "gradient") layers.push({ type: "fill", colors: palette, opacity: 1 });
  if (pattern === "glitter_accent" || finish === "shimmer") layers.push({ type: "fill", pattern: "glitter", colors: [palette[1] ?? "#FFD700"], opacity: 0.7 });
  if (pattern === "chrome_accent" || finish === "chrome") layers.push({ type: "fill", pattern: "chrome_band", colors: [palette[1] ?? "#C0C0C0"], opacity: 0.85 });
  if (pattern === "matte_overlay" || finish === "matte") layers.push({ type: "fill", pattern: "matte_overlay", colors: [palette[1] ?? "#F5E6E0"], opacity: 0.9 });
  if (pattern === "gloss_highlight" || finish === "glossy") layers.push({ type: "fill", pattern: "gloss_highlight", colors: [palette[1] ?? "#FFFFFF"], opacity: 0.9 });
  if (pattern === "fishnet") layers.push({ type: "pattern", pattern: "fishnet", colors: [palette[1] ?? "#D4B8B1", palette[2] ?? "#B99FA9"], opacity: 0.85 });
  if (pattern === "sparkle") layers.push({ type: "pattern", pattern: "sparkle", colors: [palette[1] ?? "#D4B8B1", palette[2] ?? "#B99FA9"], opacity: 0.9 });
  if (pattern === "dots") layers.push({ type: "pattern", pattern: "dots", colors: [palette[1] ?? "#D4B8B1"], opacity: 0.9 });
  if (pattern === "geometric") layers.push({ type: "pattern", pattern: "geometric", colors: [palette[1] ?? "#D4B8B1"], opacity: 0.85 });
  if (pattern === "lace") layers.push({ type: "pattern", pattern: "lace", colors: [palette[1] ?? "#D4B8B1"], opacity: 0.8 });
  if (pattern === "metallic_stripe") layers.push({ type: "pattern", pattern: "metallic_stripe", colors: [palette[1] ?? "#D4B8B1"], opacity: 0.9 });
  if (pattern === "gloss_band") layers.push({ type: "pattern", pattern: "gloss_band", colors: [palette[1] ?? "#FFFFFF"], opacity: 0.9 });
  if (["checker", "dots", "geometric", "lace", "metallic_stripe", "gloss_band"].includes(pattern)) layers.push({ type: "pattern", pattern, colors: [palette[1] ?? "#D4B8B1"], opacity: 0.85 });
  if (["floral", "abstract", "minimalist", "retro", "art_deco", "gradient_glow", "matte_chrome", "glitter_rain", "starry_night"].includes(pattern)) layers.push({ type: "fill", pattern, colors: palette.slice(0, 2), opacity: 0.85 });
  return layers;
}

function buildTexture(pattern: string, finish: string): string {
  if (pattern === "marble") return "marble";
  if (pattern === "watercolor" || pattern === "galaxy") return "watercolor";
  if (finish === "matte" || finish === "matte_overlay" || finish === "matte_chrome" || finish === "matte_metallic") return "matte";
  if (finish === "metallic" || finish === "metallic_stripe" || finish === "chrome" || finish === "gloss_chrome" || finish === "iridescent" || finish === "holographic") return "chrome";
  if (finish === "glossy" || finish === "gloss_highlight" || finish === "gloss_band" || finish === "jelly" || finish === "sheer" || finish === "satin" || finish === "velvet" || finish === "pearl_shimmer") return "gloss";
  if (finish === "shimmer" || finish === "pearl" || finish === "cream") return "gloss";
  if (pattern === "fishnet" || pattern === "sparkle" || pattern === "glitter" || pattern === "glitter_accent" || pattern === "glitter_rain" || pattern === "starry_night") return "gloss";
  if (pattern === "gradient_glow") return "gloss";
  return "smooth";
}

function fallbackMotifs(pattern: string, palette: string[], seed: number): Motif[] {
  const kinds = ["star", "flower", "heart", "pearl", "sparkle", "bow", "flame", "leaf", "gem", "cherry", "citrus", "strawberry", "rainbow"] as const;
  return Array.from({ length: 5 }, (_, i) => ({
    kind: kinds[(seed + i) % kinds.length]!,
    role: i === 0 ? "focal" : i === 1 ? "support" : i === 2 ? "support" : "micro",
    x: 20 + ((seed * 7 + i * 17) % 60),
    y: 20 + ((seed * 11 + i * 23) % 60),
    size: 3 + ((seed + i) % 7),
    color: palette[(seed + i) % palette.length] ?? "#FFFFFF",
    rotation: ((seed + i) * 13) % 45,
  }));
}

function applyReplacements(value: string, customPrompt: string, field: string): string {
  const regex = new RegExp(`replace ${field} ([a-z_0-9]+) with ([a-z_0-9]+)`, "i");
  const match = regex.exec(customPrompt);
  if (!match || !match[1] || !match[2]) return value;
  return value.replace(new RegExp(match[1], "i"), match[2]);
}

function applyMotifReplacements(motifs: Motif[], customPrompt: string): Motif[] {
  const regex = new RegExp(`replace motif ([a-z_]+) with ([a-z_]+)`, "i");
  const match = regex.exec(customPrompt);
  if (!match) return motifs;
  return motifs.map((motif) =>
    motif.kind.toLowerCase() === match[1]?.toLowerCase()
      ? { ...motif, kind: match[2]?.toLowerCase() as Motif["kind"] }
      : motif,
  );
}

function normaliseAiDesign(generated: unknown, shape: string, tags: string[], customPrompt: string, salt: number): NailOfTheDayDesign | null {
  if (!generated || typeof generated !== "object") return null;
  const design = generated as Partial<AiDesignResponse>;
  if (!design.name || !design.pattern || !design.finish || !Array.isArray(design.colors)) return null;

  const baseSeed = hashString([shape, ...tags, salt].join("|"));
  const motifs = normaliseMotifs(design.motifs, design.colors);

  return {
    name: design.name,
    description: design.description ?? design.name,
    imagePrompt: design.imagePrompt ?? design.description ?? design.name,
    pattern: applyReplacements(design.pattern, customPrompt, "pattern"),
    finish: applyReplacements(design.finish, customPrompt, "finish"),
    colors: design.colors.slice(0, 4),
    complexity: ["simple", "medium", "complex"].includes(design.complexity ?? "medium") ? (design.complexity ?? "medium") as "simple" | "medium" | "complex" : "medium",
    shape,
    tags,
    layers: buildLayers(design.pattern, design.colors.slice(0, 4), design.complexity ?? "medium", baseSeed, design.finish),
    texture: buildTexture(design.pattern, design.finish),
    motifs: applyMotifReplacements(motifs, customPrompt),
  };
}

function normaliseShape(shape: unknown): string {
  const allowed = new Set(SHAPES);
  const normalised = typeof shape === "string" ? shape.toLowerCase().replace(/[^a-z0-9_]/g, "") : "";
  return allowed.has(normalised as typeof SHAPES[number]) ? normalised : "almond";
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function buildDesign(shape: string, tags: string[], customPrompt?: string, salt?: number) {
  const baseSeed = hashString([shape, ...tags, salt ?? 0].join("|"));
  const variationSeed = hashString([shape, ...tags, customPrompt ?? "", salt ?? 0].join("|"));
  const primaryTag = tags[0] ?? "calm";
  const pattern = pickFromHash(baseSeed, PATTERNS);
  const finish = pickFromHash(baseSeed + 1, FINISHES);
  const palette = generatePalette(baseSeed, customPrompt);
  const complexity = (pickFromHash(baseSeed % 3, ["simple", "medium", "complex"] as const) as "simple" | "medium" | "complex");
  const promptSuffix = customPrompt ? " — " + customPrompt.trim() : "";
  const replacedPattern = applyReplacements(pattern, customPrompt ?? "", "pattern");
  const replacedFinish = applyReplacements(finish, customPrompt ?? "", "finish");
  const motifs = applyMotifReplacements(fallbackMotifs(replacedPattern, palette, variationSeed), customPrompt ?? "");
  const name = pickFromHash(baseSeed + 2, [
    capitalize(primaryTag) + " " + replacedFinish.replace(/_/g, " "),
    capitalize(primaryTag) + " " + replacedPattern.replace(/_/g, " "),
    "Velvet " + replacedPattern.replace(/_/g, " "),
    "Crystal " + replacedFinish.replace(/_/g, " "),
    "Neon " + replacedPattern.replace(/_/g, " "),
    "Midnight " + replacedFinish.replace(/_/g, " "),
    "Golden " + replacedPattern.replace(/_/g, " "),
    "Ethereal " + replacedFinish.replace(/_/g, " "),
    "Noir " + replacedPattern.replace(/_/g, " "),
    "Phantom " + replacedFinish.replace(/_/g, " "),
    "Celestial " + replacedPattern.replace(/_/g, " "),
    "Shadow " + replacedPattern.replace(/_/g, " "),
    "Lunar " + replacedFinish.replace(/_/g, " "),
    "Cosmic " + replacedPattern.replace(/_/g, " "),
    "Electric " + replacedFinish.replace(/_/g, " "),
    "Silk " + replacedFinish.replace(/_/g, " "),
    "Aurora " + replacedPattern.replace(/_/g, " "),
    "Abyss " + replacedFinish.replace(/_/g, " "),
    "Zen " + capitalize(primaryTag),
    "Void " + replacedPattern.replace(/_/g, " "),
    "Rebel " + replacedFinish.replace(/_/g, " "),
    "Dream " + replacedPattern.replace(/_/g, " "),
    "Mirage " + replacedFinish.replace(/_/g, " "),
    "Glitch " + replacedPattern.replace(/_/g, " "),
    "Warp " + replacedFinish.replace(/_/g, " "),
    "Neon " + capitalize(primaryTag) + " " + replacedFinish.replace(/_/g, " "),
    "Midnight " + capitalize(primaryTag) + " " + replacedPattern.replace(/_/g, " "),
    "Velvet " + replacedFinish.replace(/_/g, " ") + " " + replacedPattern.replace(/_/g, " "),
    "Crystal " + replacedPattern.replace(/_/g, " ") + " " + replacedFinish.replace(/_/g, " "),
    "Golden " + replacedFinish.replace(/_/g, " ") + " " + replacedPattern.replace(/_/g, " "),
    "Neon Zen Void",
    "Crystal Moon Glow",
    "Midnight Rose Ember",
    "Golden Lotus Mirage",
    "Velvet Thunder Storm",
    "Phantom Angel Dust",
    "Celestial Dragon Fire",
    "Shadow Diamond Rain",
    "Lunar Eclipse Dream",
    "Cosmic Butterfly Wings",
    "Electric Soul Shimmer",
    "Silk Road Sunset",
    "Aurora Borealis Pearl",
    "Abyss Star Whisper",
    "Zen Garden Silence",
    "Voidwalker Horizon",
    "Rebel Heart Beat",
    "Dreamcatcher Spirit",
    "Glitch in the Matrix",
    "Warp Speed Beauty",
    "Neon Nights Jazz",
    "Midnight Sun Drama",
    "Velvet Rope Vogue",
    "Crystal Clear Vision",
  ]) + promptSuffix;
  const description = "A " + replacedFinish + " " + shape + " manicure with " + replacedPattern.replace(/_/g, " ") + " texture, finished in a " + replacedFinish + " sheen.";
  const imagePrompt = "Single detached " + shape + "-shaped press-on nail. " + replacedPattern.replace(/_/g, " ") + " art in " + replacedFinish + " gel polish; palette " + palette.slice(0, 4).join(", ") + "; focal details " + motifs.map((motif) => motif.kind).join(", ") + ". Elegant salon nail art, no hands or fingers.";
  const layers = buildLayers(replacedPattern, palette, complexity, variationSeed, replacedFinish);
  const texture = buildTexture(replacedPattern, replacedFinish);

  return {
    name,
    description,
    imagePrompt,
    pattern: replacedPattern,
    finish: replacedFinish,
    colors: palette,
    tags,
    shape,
    complexity: complexity as "simple" | "medium" | "complex",
    layers,
    texture,
    motifs,
  };
}

async function createNailImage(design: NailOfTheDayDesign, variation: number): Promise<string | null> {
  console.log("[API /api/generate-design] createNailImage start", design.name, "variation", variation);
  try {
    return await generateNailReferenceImage({
      name: design.name,
      description: design.description,
      designPrompt: design.imagePrompt ?? design.description,
      variation,
      singleNail: true,
    });
  } catch (error) {
    console.warn("[API /api/generate-design] Local nail artwork unavailable; using SVG-only design.", error);
    return null;
  }
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return corsPreflightResponse(origin);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  try {
    let imageProvider = "gemini";
    try {
      imageProvider = serverEnv.imageProvider;
    } catch (error) {
      console.warn("[API /api/generate-design] imageProvider unavailable, defaulting to gemini:", error);
    }
    console.log("[API /api/generate-design] POST hit, imageProvider=", imageProvider);

    return await withErrorHandling(async () => {
      const body = (await request.json().catch(() => ({}))) as {
        shape?: string;
        tags?: unknown;
        customPrompt?: string;
        salt?: number;
      };

      const shape = normaliseShape(body.shape);
      const tags = Array.isArray(body.tags)
        ? body.tags.filter((tag): tag is string => typeof tag === "string" && /^[a-z_]{1,40}$/i.test(tag)).slice(0, 8)
        : [];
      const customPrompt = typeof body.customPrompt === "string" ? body.customPrompt.trim().slice(0, 500) : "";
      const salt = typeof body.salt === "number" ? body.salt : Date.now();

      console.log("[API /api/generate-design] Request body:", { shape, tags, customPrompt: customPrompt?.slice(0, 100), salt });

      console.log("[API /api/generate-design] Trying Gemini for design generation...");
      let design: NailOfTheDayDesign | null = null;
      let aiGenerated = false;
      let nailImageUrl: string | null = null;
      try {
        const generated = await completeJson<AiDesignResponse>(
          [
            {
              role: "system",
              content: GEMINI_DESIGN_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: "Create today's manicure. Nail shape: " + shape + ". Style tags: " + (tags.join(", ") || "surprise me") + ". Variation: " + salt + ". " + (customPrompt ? "Client preference: " + customPrompt : "Choose a distinctive palette and art pattern."),
            },
          ],
          { temperature: 0.9, maxOutputTokens: 900, requireKeys: ["name", "description", "imagePrompt", "pattern", "finish", "colors", "complexity", "motifs"] },
        );
        console.log("[API /api/generate-design] Gemini raw response:", JSON.stringify(generated).slice(0, 500));
        const normalized = normaliseAiDesign(generated, shape, tags, customPrompt, salt);
        console.log("[API /api/generate-design] Gemini normalized:", normalized ? { name: normalized.name, pattern: normalized.pattern, finish: normalized.finish, colors: normalized.colors } : null);
        if (normalized) {
          design = normalized;
          aiGenerated = true;
          console.log("[API /api/generate-design] Gemini design generated:", design.name);
        } else {
          console.warn("[API /api/generate-design] Gemini design normalization failed");
        }
      } catch (error) {
        console.warn("[API /api/generate-design] Gemini design generation failed:", error);
        console.warn("[API /api/generate-design] Gemini error details:", {
          message: error instanceof Error ? error.message : null,
          stack: error instanceof Error ? error.stack : null,
        });
      }

    design = buildDesign(shape, tags, customPrompt, salt);
    console.log("[API /api/generate-design] Using local design builder for", design.name);

      const safeDesign = design!;
      console.log("[API /api/generate-design] Generating nail image...");
      try {
        nailImageUrl = await createNailImage(safeDesign, salt);
        console.log("[API /api/generate-design] Nail image generated:", nailImageUrl?.slice(0, 100));
      } catch (error) {
        console.warn("[API /api/generate-design] Nail image generation failed:", error);
        console.warn("[API /api/generate-design] Nail image error details:", {
          message: error instanceof Error ? error.message : null,
          stack: error instanceof Error ? error.stack : null,
        });
      }

      console.log("[API /api/generate-design] Response:", {
        aiGenerated,
        designName: safeDesign.name,
        designPattern: safeDesign.pattern,
        designFinish: safeDesign.finish,
        colors: safeDesign.colors,
        nailImageUrl: nailImageUrl?.slice(0, 100) ?? null,
      });
      return jsonOk({ design: safeDesign, aiGenerated, nailImageUrl } satisfies { design: NailOfTheDayDesign; aiGenerated: boolean; nailImageUrl: string | null }, 200, origin);
    }, origin);
  } catch (error) {
    console.error("[API /api/generate-design] top-level failure:", error);
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return jsonError(500, "INTERNAL_ERROR", message, origin);
  }
}
