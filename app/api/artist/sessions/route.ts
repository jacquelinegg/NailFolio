import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { MissingEnvError, serverEnv } from "@/lib/env";
import { listSessionsForArtist, toArtistSessionView } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const expectedSecret = serverEnv.artistApiSecret;

    const artistSecret = request.headers.get("x-artist-secret") ?? "";
    if (artistSecret !== expectedSecret) {
      return jsonError(401, "UNAUTHORIZED", "Invalid artist API secret.");
    }

    const artistId = new URL(request.url).searchParams.get("artistId");
    if (!artistId || !/^[0-9a-f-]{36}$/i.test(artistId)) {
      return jsonError(400, "INVALID_REQUEST", "artistId query parameter must be a UUID.");
    }

    const sessions = await listSessionsForArtist(artistId);
    return NextResponse.json({ sessions: sessions.map(toArtistSessionView) });
  } catch (error) {
    if (error instanceof MissingEnvError) {
      return jsonError(500, "NOT_CONFIGURED", "ARTIST_API_SECRET is not configured on the server.");
    }

    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return jsonError(500, "INTERNAL_ERROR", message);
  }
}
