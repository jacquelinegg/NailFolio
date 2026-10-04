/**
 * Typed HTTP client for the artist app.
 * All endpoints live on the Next.js app (service role) and are gated by
 * `x-artist-secret`, which matches ARTIST_API_SECRET on the server.
 */

import { config, getApiUrl } from "../config";
import type { ArtistSessionView, ComplexityLevel, Look, SessionStatus, SessionStatusView } from "@/lib/types";

export class ArtistApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ArtistApiError";
    this.status = status;
    this.code = code;
  }
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return { "x-artist-secret": config.artistSecret, ...extra };
}

async function unwrap<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: { code?: string; message?: string } };

  if (!response.ok) {
    throw new ArtistApiError(
      response.status,
      payload.error?.code ?? "REQUEST_FAILED",
      payload.error?.message ?? `Request failed with HTTP ${response.status}.`,
    );
  }
  return payload;
}

function artistParams(): Record<string, string> {
  return config.artistId ? { artistId: config.artistId } : {};
}

export async function fetchLooks(): Promise<Look[]> {
  const response = await fetch(getApiUrl("/api/artist/looks", artistParams()), {
    headers: headers(),
  });
  return (await unwrap<{ looks: Look[] }>(response)).looks;
}

export interface UploadLookInput {
  uri: string;
  fileName: string;
  mimeType: string;
  tags: string[];
  complexityLevel: ComplexityLevel | null;
  basePrice?: number;
  generateImage?: boolean;
}

export async function uploadLook(input: UploadLookInput): Promise<Look> {
  const form = new FormData();
  if (config.artistId) form.append("artistId", config.artistId);
  form.append("tags", JSON.stringify(input.tags));
  if (input.complexityLevel) form.append("complexityLevel", input.complexityLevel);
  if (input.basePrice) form.append("basePrice", String(input.basePrice));
  if (input.generateImage) form.append("generateImage", "true");
  form.append("file", {
    uri: input.uri,
    name: input.fileName,
    type: input.mimeType,
  });

  const response = await fetch(getApiUrl("/api/artist/looks"), {
    method: "POST",
    headers: headers(),
    body: form,
  });
  return (await unwrap<{ look: Look }>(response)).look;
}

export async function fetchSessions(): Promise<ArtistSessionView[]> {
  const response = await fetch(getApiUrl("/api/artist/sessions", artistParams()), {
    headers: headers(),
  });
  return (await unwrap<{ sessions: ArtistSessionView[] }>(response)).sessions;
}

export type SessionAction = "approve" | "counter" | "decline";

export interface SessionActionInput {
  token: string;
  action: SessionAction;
  price?: number;
  appointmentTime?: string;
  notes?: string;
}

export async function actOnSession(input: SessionActionInput): Promise<SessionStatusView> {
  const response = await fetch(getApiUrl("/api/artist/sessions/action"), {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return (await unwrap<{ session: SessionStatusView }>(response)).session;
}

export const statusLabel: Record<SessionStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  counter_offer: "Counter-offer",
  rejected: "Declined",
};
