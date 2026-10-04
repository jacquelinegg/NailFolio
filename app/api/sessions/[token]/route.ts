import { NextResponse } from "next/server";

import { jsonError, requireString, withErrorHandling } from "@/lib/api";
import { getSessionByToken, toSessionStatusView } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/sessions/[token]
 * -> { session: SessionStatusView }
 *
 * Read through the service role on purpose: the client has no account, and the
 * token is the only credential it holds.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  return withErrorHandling(async () => {
    const { token: rawToken } = await context.params;
    const token = requireString(rawToken, "token", { max: 64 });

    const session = await getSessionByToken(token);
    if (!session) {
      return jsonError(404, "SESSION_NOT_FOUND", "This booking link is not valid.");
    }

    return NextResponse.json({ session: toSessionStatusView(session) });
  });
}
