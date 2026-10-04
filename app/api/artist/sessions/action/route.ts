import { NextResponse } from "next/server";

import {
  jsonError,
  optionalString,
  readJsonBody,
  requireFutureTimestamp,
  requireString,
  withErrorHandling,
} from "@/lib/api";
import { MissingEnvError, serverEnv } from "@/lib/env";
import { getSessionByToken, toSessionStatusView, updateSessionStatus } from "@/lib/supabase";
import type { SessionStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ActionRequest {
  token?: unknown;
  action?: unknown;
  price?: unknown;
  appointmentTime?: unknown;
  notes?: unknown;
}

/** Approve / counter-offer / decline, driven by the artist mobile app. */
function nextStatus(action: string): SessionStatus | null {
  if (action === "approve") return "confirmed";
  if (action === "counter") return "counter_offer";
  if (action === "decline") return "rejected";
  return null;
}

/**
 * POST /api/artist/sessions/action
 * Header: `x-artist-secret: <ARTIST_API_SECRET>`
 * body: { token, action: 'approve' | 'counter' | 'decline', price?, appointmentTime?, notes? }
 *
 * Secret-gated rather than RLS-scoped because the Expo app talks to this server
 * with the service role; swap in Supabase Auth session checks once accounts land.
 */
export async function POST(request: Request) {
  let expectedSecret: string;
  try {
    expectedSecret = serverEnv.artistApiSecret;
  } catch (error) {
    if (error instanceof MissingEnvError) {
      return jsonError(500, "NOT_CONFIGURED", "ARTIST_API_SECRET is not configured on the server.");
    }
    throw error;
  }

  const providedSecret = request.headers.get("x-artist-secret") ?? "";
  if (providedSecret !== expectedSecret) {
    return jsonError(401, "UNAUTHORIZED", "Invalid artist API secret.");
  }

  return withErrorHandling(async () => {
    const body = await readJsonBody<ActionRequest>(request);
    const token = requireString(body.token, "token", { max: 64 });
    const action = requireString(body.action, "action", { max: 32 });

    const target = nextStatus(action);
    if (!target) {
      return jsonError(400, "INVALID_ACTION", "action must be approve, counter or decline.");
    }

    const session = await getSessionByToken(token);
    if (!session) {
      return jsonError(404, "SESSION_NOT_FOUND", "This booking no longer exists.");
    }
    if (session.status === "confirmed" || session.status === "rejected") {
      return jsonError(409, "ALREADY_FINAL", `This request is already ${session.status}.`);
    }

    const notes = optionalString(body.notes, "notes", 1_000);
    const patch: Parameters<typeof updateSessionStatus>[1] = { status: target };
    if (notes) patch.artist_notes = notes;

    if (action === "counter") {
      const price = Number(body.price);
      if (Number.isFinite(price) && price > 0) patch.counter_price = Math.round(price * 100) / 100;
      if (body.appointmentTime) {
        patch.counter_appointment_time = requireFutureTimestamp(body.appointmentTime, "appointmentTime");
      }
      if (patch.counter_price === undefined && patch.counter_appointment_time === undefined) {
        return jsonError(400, "EMPTY_COUNTER", "A counter-offer needs a new price, a new time, or both.");
      }
    }

    if (action === "approve" && !session.requested_appointment_time) {
      return jsonError(409, "NO_APPOINTMENT_TIME", "This request has no requested appointment time.");
    }

    const updated = await updateSessionStatus(token, patch);
    return NextResponse.json({ session: toSessionStatusView(updated) });
  });
}
