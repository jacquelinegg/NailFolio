/**
 * Step 1 — Supabase configuration & helper client.
 *
 * Three factories, one per execution context:
 * - `getBrowserSupabaseClient()`  — client components / the zero-install web app.
 * - `getServerSupabaseClient()`   — React Server Components (cookie-scoped session);
 *   implemented in `@/lib/supabase-server` and loaded lazily to keep this module
 *   free of `next/headers`, which cannot be bundled for the browser.
 * - `getAdminSupabaseClient()`    — route handlers / server actions (service role,
 *   bypasses RLS). Never import this from a client component: the key is not
 *   exposed to the browser and `serverEnv` will throw if you try.
 *
 * Plus typed Storage helpers for the `hand-photos`, `portfolio-looks` and
 * `renders` buckets created by `supabase/schema.sql`.
 */

import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { publicEnv, serverEnv } from "@/lib/env";
import { STORAGE_BUCKETS, type Artist, type ArtistSessionView, type BookingSession, type ComplexityLevel, type CreateSessionInput, type Database, type Look, type SessionStatus, type SessionStatusView, type SessionUpdate, type StorageBucket } from "@/lib/types";
import { FALLBACK_BASE_PRICE } from "@/services/pricing";

/**
 * The fully-resolved client type. Derived from `createClient<Database>` so every
 * factory (browser, cookie-scoped server, service-role admin) returns exactly the
 * same type, including PostgREST version generics.
 */
export type NailFolioSupabaseClient = ReturnType<typeof createClient<Database>>;

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export class SupabaseStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseStorageError";
  }
}

/* -------------------------------------------------------------------------- */
/* Clients                                                                     */
/* -------------------------------------------------------------------------- */

let browserClient: NailFolioSupabaseClient | undefined;

/** Memoised anon client for client components and realtime subscriptions. */
export function getBrowserSupabaseClient(): NailFolioSupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("getBrowserSupabaseClient() called on the server. Use getServerSupabaseClient().");
  }
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  }
  return browserClient;
}

export async function getServerSupabaseClient(): Promise<NailFolioSupabaseClient> {
  // Imported lazily via a separate module so this file stays safe to bundle
  // for the browser: see `@/lib/supabase-server`.
  const { createCookieSupabaseClient } = await import("@/lib/supabase-server");
  return createCookieSupabaseClient();
}

let adminClient: NailFolioSupabaseClient | undefined;

/** Service-role client for privileged server-side work (uploads, token lookups). */
export function getAdminSupabaseClient(): NailFolioSupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("getAdminSupabaseClient() must never run in the browser.");
  }
  if (!adminClient) {
    adminClient = createClient<Database>(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

/* -------------------------------------------------------------------------- */
/* Storage helpers                                                             */
/* -------------------------------------------------------------------------- */

export interface UploadOptions {
  /** Storage bucket; defaults to the bucket implied by the helper you call. */
  bucket?: StorageBucket;
  /** Explicit object path. When omitted a deterministic-ish random path is built. */
  path?: string;
  /** Overwrite an existing object at the same path instead of failing. */
  upsert?: boolean;
}

export interface UploadResult {
  bucket: StorageBucket;
  path: string;
  publicUrl: string;
}

function buildObjectPath(prefix: string, file: File): string {
  const extension = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
    : ".jpg";
  const safePrefix = prefix.replace(/[^a-zA-Z0-9/_-]/g, "-").replace(/\/+$/, "");
  return `${safePrefix}/${crypto.randomUUID()}${extension}`;
}

function assertUploadable(file: File): void {
  if (!(file instanceof Blob) || file.size === 0) {
    throw new SupabaseStorageError("No file supplied.");
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new SupabaseStorageError(
      `Unsupported image type "${file.type}". Allowed: ${ALLOWED_MIME_TYPES.join(", ")}.`,
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new SupabaseStorageError(
      `Image is ${(file.size / 1024 / 1024).toFixed(1)}MB; the limit is ${
        MAX_IMAGE_BYTES / 1024 / 1024
      }MB.`,
    );
  }
}

/**
 * Uploads an image and returns its public URL.
 * Uses the service-role client, so the RLS policies on `storage.objects` do not
 * apply (the bucket is still private-by-default at the Postgres level).
 */
export async function uploadImage(
  file: File,
  { bucket, path, upsert = false }: UploadOptions & { bucket: StorageBucket; path: string },
): Promise<UploadResult> {
  assertUploadable(file);

  const supabase = getAdminSupabaseClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert, cacheControl: "3600" });

  if (error) {
    console.error("[hand-photo] Supabase storage upload error", { bucket, path, error: error.message });
    throw new SupabaseStorageError(`Upload to "${bucket}" failed: ${error.message}`);
  }

  return { bucket, path, publicUrl: getPublicUrl(bucket, path) };
}

/** Client hand photo captured by the zero-install flow. */
export async function uploadHandPhoto(file: File, sessionToken?: string): Promise<UploadResult> {
  try {
    return uploadImage(file, {
      bucket: STORAGE_BUCKETS.handPhotos,
      path: buildObjectPath(sessionToken ? `sessions/${sessionToken}` : "hand-photos", file),
    });
  } catch (error) {
    console.error("[hand-photo] Supabase upload failed", error);
    throw error;
  }
}

/** Portfolio look uploaded from the artist mobile app. */
export async function uploadPortfolioLook(file: File, artistId: string): Promise<UploadResult> {
  return uploadImage(file, {
    bucket: STORAGE_BUCKETS.portfolioLooks,
    path: buildObjectPath(`artists/${artistId}`, file),
  });
}

/** AI render returned by YouCam, cached so it survives provider URL expiry. */
export async function uploadRender(file: Blob, sessionToken: string, extension = "jpg"): Promise<UploadResult> {
  const wrapped = new File([file], `${sessionToken}.${extension}`, { type: file.type || "image/jpeg" });
  return uploadImage(wrapped, {
    bucket: STORAGE_BUCKETS.renders,
    path: buildObjectPath(`sessions/${sessionToken}`, wrapped),
  });
}

/** Absolute URL for an object in a public bucket. */
export function getPublicUrl(bucket: StorageBucket, path: string): string {
  return getAdminSupabaseClient().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * Time-limited signed URL for a private bucket. YouCam must be able to fetch the
 * hand photo and the portfolio reference, so prefer this when buckets are private.
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  path: string,
  expiresInSeconds = 3_600,
): Promise<string> {
  try {
    const { data, error } = await getAdminSupabaseClient()
      .storage.from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      console.error("[hand-photo] Supabase createSignedUrl error", { bucket, path, error: error.message });
      throw new SupabaseStorageError(`Could not sign "${bucket}/${path}": ${error.message}`);
    }
    return data.signedUrl;
  } catch (error) {
    console.error("[hand-photo] getSignedUrl failed", { bucket, path, error });
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Convenience queries                                                         */
/* -------------------------------------------------------------------------- */

/** Booking session resolved from a shareable `/confirm/[token]` link. */
export async function getSessionByToken(token: string) {
  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load session: ${error.message}`);
  }
  return data;
}

/** Portfolio used by the style-aware AI generator. */
export async function listLooksForArtist(artistId: string) {
  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase
    .from("looks")
    .select("*")
    .eq("artist_id", artistId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load looks: ${error.message}`);
  }
  return data;
}

/** Public directory of every artist on the platform, newest first. */
export async function listArtists(): Promise<Artist[]> {
  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase
    .from("artists")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load artists: ${error.message}`);
  }
  return data ?? [];
}

/** Artist profile: baseline price, per-technique modifiers, duration table. */
export async function getArtistById(artistId: string) {
  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase
    .from("artists")
    .select("*")
    .eq("id", artistId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load artist: ${error.message}`);
  }
  return data;
}

/** Resolves the artist behind a `/confirm/[token]` share link. */
export async function getArtistByShareToken(shareToken: string) {
  const normalised = shareToken.trim().toLowerCase();
  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase
    .from("artists")
    .select("*")
    .or(`share_token.eq.${normalised},handle.eq.${normalised}`)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve artist token: ${error.message}`);
  }
  return data;
}

/** Inserts a portfolio look tagged from the shared tag dictionary. */
export async function createPortfolioLook(input: {
  artistId: string;
  imageUrl: string;
  tags: string[];
  basePrice?: number;
  complexityLevel?: ComplexityLevel | null;
}): Promise<Look> {
  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase
    .from("looks")
    .insert({
      artist_id: input.artistId,
      image_url: input.imageUrl,
      tags: input.tags,
      base_price: input.basePrice ?? FALLBACK_BASE_PRICE,
      complexity_level: input.complexityLevel ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save look: ${error.message}`);
  }
  return data;
}

export async function deletePortfolioLook(lookId: string): Promise<void> {
  const supabase = getAdminSupabaseClient();
  const { error } = await supabase.from("looks").delete().eq("id", lookId);
  if (error) {
    throw new Error(`Failed to delete look: ${error.message}`);
  }
}

/** Booking feed for the artist mobile app, newest first. */
export async function listSessionsForArtist(artistId: string, limit = 50): Promise<BookingSession[]> {
  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("artist_id", artistId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load booking requests: ${error.message}`);
  }
  return data;
}

/* -------------------------------------------------------------------------- */
/* Sessions                                                                    */
/* -------------------------------------------------------------------------- */

/** URL-safe, unguessable token used both as the session id and the share key. */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let token = "";
  for (const byte of bytes) {
    token += (byte % 36).toString(36);
  }
  return token;
}

/** Creates a `pending` booking session. Called from the checkout dispatcher. */
export async function createBookingSession(input: CreateSessionInput): Promise<BookingSession> {
  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      token: input.token,
      artist_id: input.artistId,
      status: "pending",
      client_hand_image_url: input.clientHandImageUrl,
      rendered_result_url: input.renderedResultUrl ?? null,
      generated_prompt: input.generatedPrompt ?? null,
      selected_look_id: input.selectedLookId ?? null,
      price_estimate: input.priceEstimate,
      estimated_price: input.priceEstimate.total,
      estimated_duration_mins: input.priceEstimate.durationMins,
      requested_appointment_time: input.requestedAppointmentTime,
      client_name: input.clientName,
      client_phone: input.clientPhone,
      client_email: input.clientEmail ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create booking session: ${error.message}`);
  }
  return data;
}

/**
 * Artist or client status transition. `expectedStatus` makes counter-offers and
 * approvals safe against a double-tap or a stale mobile screen.
 */
export async function updateSessionStatus(
  token: string,
  patch: SessionUpdate,
  expectedStatus?: SessionStatus,
): Promise<BookingSession> {
  const supabase = getAdminSupabaseClient();
  let query = supabase.from("sessions").update(patch).eq("token", token);
  if (expectedStatus) {
    query = query.eq("status", expectedStatus);
  }
  const { data, error } = await query.select("*").maybeSingle();

  if (error) {
    throw new Error(`Failed to update session: ${error.message}`);
  }
  if (!data) {
    throw new Error(
      expectedStatus
        ? `Session is no longer "${expectedStatus}".`
        : "Session not found.",
    );
  }
  return data;
}

/** Projects a session row onto the shape the anonymous status page may see. */
export function toSessionStatusView(session: BookingSession): SessionStatusView {
  return {
    token: session.token,
    status: session.status,
    estimatedPrice: session.estimated_price,
    estimatedDurationMins: session.estimated_duration_mins,
    requestedAppointmentTime: session.requested_appointment_time,
    counterPrice: session.counter_price,
    counterAppointmentTime: session.counter_appointment_time,
    renderedResultUrl: session.rendered_result_url,
    artistNotes: session.artist_notes,
    priceEstimate: session.price_estimate,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };
}

/** Projects a session row onto the shape the artist app may see. */
export function toArtistSessionView(session: BookingSession): ArtistSessionView {
  return {
    ...toSessionStatusView(session),
    id: session.id,
    artistId: session.artist_id,
    clientName: session.client_name,
    clientPhone: session.client_phone,
    clientEmail: session.client_email,
    clientHandImageUrl: session.client_hand_image_url,
    generatedPrompt: session.generated_prompt,
    selectedLookId: session.selected_look_id,
  };
}
