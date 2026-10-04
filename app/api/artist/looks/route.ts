import { NextResponse } from "next/server";

import { jsonError, requireUuid, withErrorHandling } from "@/lib/api";
import { MissingEnvError, serverEnv } from "@/lib/env";
import { createPortfolioLook, listLooksForArtist, uploadPortfolioLook } from "@/lib/supabase";
import { isComplexityLevel, isKnownTag, normaliseTag } from "@/lib/tags";
import type { ComplexityLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

function isAuthorised(request: Request): boolean {
  try {
    return (request.headers.get("x-artist-secret") ?? "") === serverEnv.artistApiSecret;
  } catch (error) {
    if (error instanceof MissingEnvError) return false;
    throw error;
  }
}

/** GET /api/artist/looks?artistId=<uuid> — portfolio grid for the mobile app. */
export async function GET(request: Request) {
  if (!isAuthorised(request)) {
    return jsonError(401, "UNAUTHORIZED", "Invalid artist API secret.");
  }

  return withErrorHandling(async () => {
    const artistId = new URL(request.url).searchParams.get("artistId") ?? "";
    const looks = await listLooksForArtist(requireUuid(artistId, "artistId"));
    return NextResponse.json({ looks });
  });
}

/**
 * POST /api/artist/looks (multipart/form-data)
 * body: { artistId, file, tags: '["nude","chrome_pearl"]', complexityLevel?, basePrice? }
 *
 * Tags are validated against the shared dictionary (`lib/tags.ts`), so anything
 * the AI generator can price is guaranteed to be in the catalogue.
 */
export async function POST(request: Request) {
  if (!isAuthorised(request)) {
    return jsonError(401, "UNAUTHORIZED", "Invalid artist API secret.");
  }

  return withErrorHandling(async () => {
    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    const artistId = requireUuid(formData?.get("artistId"), "artistId");

    if (!(file instanceof File) || file.size === 0) {
      return jsonError(400, "INVALID_REQUEST", "Attach a portfolio photo as `file`.");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return jsonError(400, "FILE_TOO_LARGE", "Portfolio photos must be under 12MB.");
    }

    let tags: string[];
    try {
      const raw = formData?.get("tags");
      const parsed = typeof raw === "string" && raw ? (JSON.parse(raw) as unknown) : [];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return jsonError(400, "INVALID_TAGS", "Select at least one style tag.");
      }
      tags = [...new Set(parsed.map((tag) => normaliseTag(String(tag))))];
    } catch {
      return jsonError(400, "INVALID_TAGS", "`tags` must be a JSON array of tag strings.");
    }

    const unknownTags = tags.filter((tag) => !isKnownTag(tag));
    if (unknownTags.length > 0) {
      return jsonError(400, "INVALID_TAGS", `Unknown tags: ${unknownTags.join(", ")}.`);
    }

    const rawComplexity = String(formData?.get("complexityLevel") ?? "");
    const complexityLevel = isComplexityLevel(rawComplexity) ? (rawComplexity as ComplexityLevel) : null;

    const rawPrice = Number(formData?.get("basePrice"));
    const basePrice = Number.isFinite(rawPrice) && rawPrice > 0 ? Math.round(rawPrice * 100) / 100 : undefined;

    const stored = await uploadPortfolioLook(file, artistId);
    const look = await createPortfolioLook({
      artistId,
      imageUrl: stored.publicUrl,
      tags,
      basePrice,
      complexityLevel,
    });

    return NextResponse.json({ look }, { status: 201 });
  });
}
