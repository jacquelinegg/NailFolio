import { NextResponse } from "next/server";

import { jsonError, requireUuid, withErrorHandling } from "@/lib/api";
import { getArtistById, listLooksForArtist } from "@/lib/supabase";
import { AiGeneratorError, generateArtistAwareDesign } from "@/services/aiGenerator";
import type { ArtistAwareDesign } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:8081",
  "http://192.168.0.100:3000",
  "http://192.168.0.100:8081",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = (origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0])!;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  return withErrorHandling(async () => {
    const body = (await request.json().catch(() => ({}))) as {
      artistId?: unknown;
      lookId?: unknown;
      inspirationImage?: unknown;
    };
    const artistId = requireUuid(body.artistId, "artistId");
    const lookId = body.lookId ? requireUuid(body.lookId, "lookId") : null;

    let inspirationImage: { base64: string; mimeType: string } | undefined;
    if (body.inspirationImage && typeof body.inspirationImage === "object") {
      const img = body.inspirationImage as { base64?: unknown; mimeType?: unknown };
      if (typeof img.base64 === "string" && typeof img.mimeType === "string") {
        inspirationImage = { base64: img.base64, mimeType: img.mimeType };
      }
    }

    const artist = await getArtistById(artistId);
    if (!artist) {
      const response = jsonError(404, "ARTIST_NOT_FOUND", "This artist link is no longer available.", origin);
      Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      return response;
    }

    try {
      const design = await generateArtistAwareDesign({ artistId, anchorLookId: lookId, inspirationImage });
      const response = NextResponse.json({ design } satisfies { design: ArtistAwareDesign });
      Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      return response;
    } catch (error) {
      if (error instanceof AiGeneratorError) {
        if (error.code === "LOOK_NOT_FOUND") {
          const response = jsonError(404, "LOOK_NOT_FOUND", error.message, origin);
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
          return response;
        }
        if (error.code === "NO_PORTFOLIO") {
          const response = jsonError(409, "NO_PORTFOLIO", error.message, origin);
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
          return response;
        }
        if (error.code === "VISION_FAILED") {
          const response = jsonError(502, "VISION_FAILED", error.message, origin);
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
          return response;
        }
      }
      throw error;
    }
  }, origin);
}
