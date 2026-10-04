import { NextResponse } from "next/server";

import { jsonError, withErrorHandling } from "@/lib/api";
import { listArtists, listLooksForArtist } from "@/lib/supabase";
import { analyseStyleImage, rankArtistsByStyle, type StyleMatch } from "@/services/styleMatcher";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface SearchResponse {
  summary: string;
  baseTags: string[];
  techniqueTags: string[];
  matches: (StyleMatch & { displayName: string; handle: string; basePrice: number; shareToken: string | null })[];
}

async function extractMultipartFile(formData: FormData): Promise<{ data: Buffer; fileName: string; mimeType: string } | null> {
  const fileEntry = formData.get("file");
  const blobEntry = fileEntry as any;

  if (blobEntry && typeof blobEntry.arrayBuffer === "function" && "name" in blobEntry) {
    const buffer = Buffer.from(await blobEntry.arrayBuffer());
    return { data: buffer, fileName: blobEntry.name, mimeType: blobEntry.type };
  }

  if (blobEntry && typeof blobEntry.arrayBuffer === "function") {
    const buffer = Buffer.from(await blobEntry.arrayBuffer());
    const filenameField = formData.get("filename");
    const fileValue = filenameField as any;
    const fileName = fileValue && typeof fileValue.arrayBuffer === "function" && "name" in fileValue ? fileValue.name : "upload.jpg";
    const mimeType = blobEntry.type || "application/octet-stream";
    return { data: buffer, fileName, mimeType };
  }

  if (typeof fileEntry === "string") {
    const filenameField = formData.get("filename");
    const fileValue = filenameField as any;
    const fileName = fileValue && typeof fileValue.arrayBuffer === "function" && "name" in fileValue ? fileValue.name : "upload.jpg";
    const mimeTypeField = formData.get("mimeType");
    const mimeValue = mimeTypeField as any;
    const mimeType = mimeValue && typeof mimeValue.arrayBuffer === "function" && "name" in mimeValue ? mimeValue.name : "application/octet-stream";

    let base64 = fileEntry.replace(/\s/g, "");
    const dataUrlMatch = /^data:([^;]+);base64,(.+)$/i.exec(base64);
    if (dataUrlMatch) {
      base64 = dataUrlMatch[2] ?? base64;
      return { data: Buffer.from(base64, "base64"), fileName, mimeType: dataUrlMatch[1] ?? "image/png" };
    }

    return { data: Buffer.from(base64, "base64"), fileName, mimeType };
  }

  return null;
}

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    const contentType = request.headers.get("content-type") ?? "";
    console.log("[search] content-type", contentType);

    const formData = await request.formData().catch((error) => {
      console.error("[search] Failed to parse FormData", error);
      return null;
    });

    if (!formData) {
      return jsonError(400, "INVALID_REQUEST", "Attach the reference image as a `file` field.");
    }

    const extracted = await extractMultipartFile(formData);

    if (!extracted) {
      return jsonError(400, "INVALID_REQUEST", "Attach the reference image as a `file` field.");
    }

    if (extracted.data.length > MAX_UPLOAD_BYTES) {
      return jsonError(400, "FILE_TOO_LARGE", "Reference images must be under 12MB.");
    }

    const mimeType = extracted.mimeType;
    if (!ACCEPTED_TYPES.has(mimeType)) {
      return jsonError(400, "INVALID_REQUEST", "Please use a JPG, PNG or WebP image.");
    }

    const wrapped = new File([extracted.data.buffer as ArrayBuffer], extracted.fileName, { type: mimeType });

    let analysis;
    try {
      analysis = await analyseStyleImage({
        image: {
          base64: Buffer.from(await wrapped.arrayBuffer()).toString("base64"),
          mimeType: wrapped.type,
        },
      });
    } catch {
      return jsonError(502, "ANALYSIS_FAILED", "We could not read that image. Please try another.");
    }

    const artists = await listArtists().catch(() => []);

    const portfolios = await Promise.all(
      artists.map(async (artist) => ({
        id: artist.id,
        tags: (await listLooksForArtist(artist.id).catch(() => [])).flatMap((look) => look.tags),
      })),
    );

    const ranked = rankArtistsByStyle(analysis, portfolios);
    const byId = new Map(artists.map((artist) => [artist.id, artist]));

    const matches = ranked
      .map((match) => {
        const artist = byId.get(match.artistId);
        if (!artist) return null;
        return {
          ...match,
          displayName: artist.display_name,
          handle: artist.handle,
          basePrice: artist.base_price,
          shareToken: artist.share_token,
        };
      })
      .filter((match): match is NonNullable<typeof match> => match !== null)
      .slice(0, 6);

    return NextResponse.json({
      summary: analysis.summary,
      baseTags: analysis.baseTags,
      techniqueTags: analysis.techniqueTags,
      matches,
    } satisfies SearchResponse);
  });
}
