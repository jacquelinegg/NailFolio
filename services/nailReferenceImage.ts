import { randomUUID } from "node:crypto";

import { serverEnv } from "@/lib/env";
import { STORAGE_BUCKETS } from "@/lib/types";
import { uploadImage } from "@/lib/supabase";

export interface NailReferenceImageInput {
  name: string;
  description: string;
  designPrompt: string;
  variation?: number;
  singleNail?: boolean;
}

export interface NailReferenceImageOptions {
  provider?: "gemini" | "openai" | "local" | "placeholder";
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  uploadImpl?: typeof uploadImage;
}

export class NailReferenceImageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "NailReferenceImageError";
  }
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function buildImagePrompt(input: NailReferenceImageInput, singleNail = false): string {
  const designBlock = [
    `Design name: ${input.name}.`,
    `Description: ${input.description}.`,
    `Art direction: ${input.designPrompt}.`,
  ].join(" ");

  if (singleNail) {
    return [
      "2D flat pattern texture, no 3D, no people, no hands, no fingers, no body parts",
      "abstract design, fabric texture, brush strokes, watercolor, ink, geometric shapes",
      "metallic foil, glitter, chrome, marble, mineral texture",
      "botanical: petals, leaves, flowers",
      "vibrant colors, jewel tones, neon, metallic gold, silver",
      "seamless tileable, flat rectangle, no shape, no curvature",
      "no nail, no nail shape, no anatomy, no person, no human",
      designBlock,
    ]
      .join(" ")
      .slice(0, 1800);
  }

  return [
    "2D flat pattern texture, no 3D, no people, no hands, no fingers, no body parts",
    "abstract design, fabric texture, brush strokes, watercolor, ink, geometric shapes",
    "metallic foil, glitter, chrome, marble, mineral texture",
    "botanical: petals, leaves, flowers",
    "vibrant colors, jewel tones, neon, metallic gold, silver",
    "seamless tileable, flat rectangle, no shape, no curvature",
    "no nail, no nail shape, no anatomy, no person, no human",
    designBlock,
  ]
    .join(" ")
    .slice(0, 1800);
}

/** Generate and persist a public reference photo that YouCam can fetch. */
export async function generateNailReferenceImage(
  input: NailReferenceImageInput,
  options: NailReferenceImageOptions = {},
): Promise<string | null> {
  const provider = options.provider ?? serverEnv.imageProvider;
  if (provider === "placeholder") return null;
  const prompt = buildImagePrompt(input, input.singleNail ?? false);
  const variation = input.variation ?? hashString(`${input.name}|${input.designPrompt}`) % 1_000_000_000;
  console.log(`[nailReferenceImage] provider=${provider} variation=${variation}`);

  const apiKey = options.apiKey ?? (provider === "gemini" ? serverEnv.geminiApiKey : serverEnv.openaiApiKey);
  if (!apiKey) return null;

  const model = options.model ?? (provider === "gemini" ? serverEnv.geminiImageModel : serverEnv.openaiImageModel);
  const endpoint = provider === "gemini"
    ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
    : "https://api.openai.com/v1/images/generations";
  const headers: Record<string, string> = provider === "gemini"
    ? { "Content-Type": "application/json", "x-goog-api-key": apiKey }
    : { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
  const body = provider === "gemini"
    ? {
        contents: [{ role: "user", parts: [{ text: `${prompt} Variation ${variation}.` }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "3:4", imageSize: "1K" } },
      }
    : { model, prompt: `${prompt} Variation ${variation}.`, size: "1024x1536", quality: "high", n: 1 };

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    throw new NailReferenceImageError("Image generation request failed.", { cause: error });
  }

  const payload = await response.json().catch(() => null) as {
    candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
    data?: { b64_json?: string }[];
    error?: { message?: string };
  } | null;
  if (!response.ok) {
    throw new NailReferenceImageError(payload?.error?.message ?? `Image provider returned HTTP ${response.status}.`);
  }

  const imageData = provider === "gemini"
    ? payload?.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).find((part) => part.inlineData?.data)?.inlineData
    : payload?.data?.[0]?.b64_json ? { mimeType: "image/png", data: payload.data[0].b64_json } : undefined;
  if (!imageData?.data) throw new NailReferenceImageError("Image provider returned no image data.");

  const mimeType = imageData.mimeType?.toLowerCase();
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
  if (!mimeType || !["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
    throw new NailReferenceImageError(`Image provider returned unsupported type "${mimeType ?? "unknown"}".`);
  }

  const bytes = Buffer.from(imageData.data, "base64");
  if (!bytes.length || bytes.length > 12 * 1024 * 1024) {
    throw new NailReferenceImageError("Generated reference image is empty or exceeds the 12MB limit.");
  }
  const file = new Blob([new Uint8Array(bytes)], { type: mimeType }) as File;
  const stored = await (options.uploadImpl ?? uploadImage)(file, {
    bucket: STORAGE_BUCKETS.portfolioLooks,
    path: `generated/nail-of-the-day/${randomUUID()}.${extension}`,
  });
  return stored.publicUrl;
}

