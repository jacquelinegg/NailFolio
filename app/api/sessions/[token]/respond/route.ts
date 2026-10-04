import { NextResponse } from "next/server";

import { jsonError, readJsonBody, requireFutureTimestamp, requireString, withErrorHandling } from "@/lib/api";
import { getSessionByToken, toSessionStatusView, updateSessionStatus } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface RespondRequest {
  action?: unknown;
  notes?: unknown;
}

const VALID_ACTIONS = new Set(["accept_counter", "decline_counter"]);

/**
 * POST /api/sessions/[token]/respond  { action, notes? }
 *
 * The client's half of the two-way approval: accept the artist's counter-offer
 * (price and/or slot become the booking) or walk away from it.
 */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  return withErrorHandling(async () => {
    const { token: rawToken } = await context.params;
    const token = requireString(rawToken, "token", { max: 64 });

    const body = await readJsonBody<RespondRequest>(request);
    const action = requireString(body.action, "action", { max: 32 });
    if (!VALID_ACTIONS.has(action)) {
      return jsonError(400, "INVALID_ACTION", "action must be accept_counter or decline_counter.");
    }

    const session = await getSessionByToken(token);
    if (!session) {
      return jsonError(404, "SESSION_NOT_FOUND", "This booking link is not valid.");
    }
    if (session.status !== "counter_offer") {
      return jsonError(409, "NOT_A_COUNTER_OFFER", "There is no counter-offer waiting on this booking.");
    }

    if (action === "decline_counter") {
      const declined = await updateSessionStatus(token, { status: "rejected" }, "counter_offer");
      return NextResponse.json({ session: toSessionStatusView(declined) });
    }

    const updated = await updateSessionStatus(
      token,
      {
        status: "confirmed",
        estimated_price: session.counter_price ?? session.estimated_price,
        requested_appointment_time: requireFutureTimestamp(
          session.counter_appointment_time ?? session.requested_appointment_time,
          "counterAppointmentTime",
        ),
        counter_price: null,
        counter_appointment_time: null,
        artist_notes: typeof body.notes === "string" ? body.notes.slice(0, 1_000) : session.artist_notes,
      },
      "counter_offer",
    );

    return NextResponse.json({ session: toSessionStatusView(updated) });
  });
}
