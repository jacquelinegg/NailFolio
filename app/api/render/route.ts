import { NextResponse } from "next/server";

import { jsonError, readJsonBody, requireHttpUrl, withErrorHandling } from "@/lib/api";
import { uploadRender } from "@/lib/supabase";
import { transferNailArt, toYouCamHttpError, YouCamError } from "@/services/youcamService";

export const runtime = "nodejs";
/** create + poll budget is 30s inside the service; leave headroom for the mirror upload. */
export const maxDuration = 60;

const MAX_RENDER_BYTES = 12 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 20_000;

interface RenderRequest {
  handUrl?: unknown;
  refImageUrl?: unknown;
  sessionToken?: unknown;
}

/**
 * POST /api/render  { handUrl, refImageUrl, sessionToken? }
 * -> { url, providerUrl }
 *
 * Runs the YouCam AI-nail transfer, then mirrors the output into the `renders`
 * bucket: provider result URLs expire, while the booking (and the artist's feed)
 * must keep showing the design for weeks.
 */
export async function POST(request: Request) {
  return withErrorHandling(async () => {
    const body = await readJsonBody<RenderRequest>(request);
    const handUrl = requireHttpUrl(body.handUrl, "handUrl");
    const refImageUrl = requireHttpUrl(body.refImageUrl, "refImageUrl");
    const referenceHost = new URL(refImageUrl).hostname.toLowerCase();
    if (["localhost", "127.0.0.1", "::1"].includes(referenceHost)) {
      return jsonError(422, "LOCAL_REFERENCE_NOT_PUBLIC", "The locally generated preview is visible only on this computer. A public reference image is required for hand try-on.");
    }
    const sessionToken =
      typeof body.sessionToken === "string" && body.sessionToken ? body.sessionToken : "pending";

    try {
      const providerUrl = await transferNailArt(handUrl, refImageUrl, { signal: request.signal });

      const mirrored = await mirrorRender(providerUrl, sessionToken);
      return NextResponse.json({ url: mirrored ?? providerUrl, providerUrl });
    } catch (error) {
      if (error instanceof YouCamError) {
        const { status, message } = toYouCamHttpError(error);
        return jsonError(status, error.code, message);
      }
      throw error;
    }
  });
}

/** Best-effort copy of the provider result into our own storage. */
async function mirrorRender(providerUrl: string, sessionToken: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(providerUrl, { signal: controller.signal });
    if (!response.ok) return null;

    const blob = await response.blob();
    if (blob.size === 0 || blob.size > MAX_RENDER_BYTES) return null;

    const extension = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
    const stored = await uploadRender(blob, sessionToken, extension);
    return stored.publicUrl;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
