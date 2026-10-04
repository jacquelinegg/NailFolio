import { NextResponse } from "next/server";

import {
  jsonError,
  optionalString,
  readJsonBody,
  requireEmail,
  requireFutureTimestamp,
  requireHttpUrl,
  requirePhone,
  requireString,
  requireUuid,
  withErrorHandling,
} from "@/lib/api";
import { createBookingSession, generateSessionToken, getArtistById } from "@/lib/supabase";
import { isComplexityLevel, normaliseTag } from "@/lib/tags";
import type { ComplexityLevel, CreateSessionInput, PriceEstimate, PriceLineItem } from "@/lib/types";
import { buildPriceEstimate, pricingConfigFromArtist } from "@/services/pricing";

interface CreateSessionRequest {
  artistId?: unknown;
  clientHandImageUrl?: unknown;
  renderedResultUrl?: unknown;
  generatedPrompt?: unknown;
  selectedLookId?: unknown;
  priceEstimate?: unknown;
  usedTags?: unknown;
  complexity?: unknown;
  requestedAppointmentTime?: unknown;
  clientName?: unknown;
  clientPhone?: unknown;
  clientEmail?: unknown;
}

const VALID_LINE_ITEM_KINDS: ReadonlySet<string> = new Set(["base", "technique", "ai_complexity"]);

function parsePriceEstimate(value: unknown): PriceEstimate {
  const input = (value ?? {}) as Partial<PriceEstimate>;
  const rawItems = Array.isArray(input.lineItems) ? input.lineItems : [];

  const lineItems: PriceLineItem[] = rawItems.map((item, index) => {
    const label = requireString(item?.label, `priceEstimate.lineItems[${index}].label`, { max: 120 });
    const amount = Number(item?.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`priceEstimate.lineItems[${index}].amount must be a non-negative number.`);
    }
    const kind = String(item?.kind ?? "technique");
    if (!VALID_LINE_ITEM_KINDS.has(kind)) {
      throw new Error(`priceEstimate.lineItems[${index}].kind is invalid.`);
    }
    return { label, amount, kind: kind as PriceLineItem["kind"] };
  });

  if (lineItems.length === 0) {
    throw new Error("priceEstimate.lineItems must contain at least one item.");
  }

  const durationMins = Number(input.durationMins);
  if (!Number.isFinite(durationMins) || durationMins <= 0) {
    throw new Error("priceEstimate.durationMins must be a positive number.");
  }

  const declaredTotal = Number(input.total);
  const computedTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const total = Number.isFinite(declaredTotal) ? Math.round(declaredTotal * 100) / 100 : Math.round(computedTotal * 100) / 100;

  return { lineItems, total, durationMins: Math.round(durationMins) };
}

/**
 * POST /api/sessions — "Confirm My Look & Book" dispatcher.
 * Creates a `pending` session and returns the token the client tracks at /status/[token].
 *
 * The receipt is re-derived from the submitted line items (never trusted as a
 * client-supplied number) and cross-checked against the artist's own price table,
 * so a tampered payload can never underpay the artist.
 */
export async function POST(request: Request) {
  return withErrorHandling(async () => {
    const body = await readJsonBody<CreateSessionRequest>(request);

    const artistId = requireUuid(body.artistId, "artistId");
    const artist = await getArtistById(artistId);
    if (!artist) {
      return jsonError(404, "ARTIST_NOT_FOUND", "This artist link is no longer available.");
    }

    let priceEstimate: PriceEstimate;
    try {
      priceEstimate = parsePriceEstimate(body.priceEstimate);
    } catch (error) {
      return jsonError(400, "INVALID_PRICE_ESTIMATE", error instanceof Error ? error.message : "Invalid price estimate.");
    }

    // When the client sends the design tags, recompute the receipt server-side
    // from the artist's own price table. A tampered payload can never underpay.
    const usedTags = Array.isArray(body.usedTags)
      ? body.usedTags.map((tag) => normaliseTag(requireString(tag, "usedTags[]", { max: 40 })))
      : null;
    if (usedTags) {
      priceEstimate = buildPriceEstimate({
        config: pricingConfigFromArtist(artist),
        usedTags,
        complexity: isComplexityLevel(String(body.complexity)) ? (String(body.complexity) as ComplexityLevel) : "medium",
      });
    }

    const input: CreateSessionInput = {
      artistId,
      token: generateSessionToken(),
      clientHandImageUrl: requireHttpUrl(body.clientHandImageUrl, "clientHandImageUrl"),
      renderedResultUrl: body.renderedResultUrl ? requireHttpUrl(body.renderedResultUrl, "renderedResultUrl") : null,
      generatedPrompt: optionalString(body.generatedPrompt, "generatedPrompt", 4_000),
      selectedLookId: body.selectedLookId ? requireUuid(body.selectedLookId, "selectedLookId") : null,
      priceEstimate,
      requestedAppointmentTime: requireFutureTimestamp(body.requestedAppointmentTime, "requestedAppointmentTime"),
      clientName: requireString(body.clientName, "clientName", { max: 120 }),
      clientPhone: requirePhone(body.clientPhone, "clientPhone"),
      clientEmail: body.clientEmail ? requireEmail(body.clientEmail) : null,
    };

    const session = await createBookingSession(input);

    return NextResponse.json({ token: session.token, status: session.status }, { status: 201 });
  });
}
