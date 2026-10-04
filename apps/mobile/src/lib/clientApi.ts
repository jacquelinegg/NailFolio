/**
 * Typed HTTP client for the *client* funnel (the artist's customer, not the
 * artist).
 *
 * Deliberately separate from `./api.ts`, which is the artist half: those routes
 * are gated on the `x-artist-secret` shared secret, while everything here is the
 * public, zero-install surface a customer reaches through a share link. Keeping
 * them apart stops a client token from ever being confused with the artist
 * secret.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { config, getApiUrl } from "../config";
import { debugLog } from "../utils/debugLogs";
import { generatePalette } from "@/lib/palette";
import type { Artist, ArtistAwareDesign, ComplexityLevel, Look, NailOfTheDayDesign, PriceEstimate, SessionStatusView } from "@/lib/types";

export class ClientApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
    this.code = code;
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: T & { error?: { code?: string; message?: string } } = {} as T & { error?: { code?: string; message?: string } };
  try {
    payload = JSON.parse(text) as T & { error?: { code?: string; message?: string } };
  } catch {
    payload = {} as T & { error?: { code?: string; message?: string } };
  }

  if (!response.ok) {
    console.error("[Mobile NOTD] API error", {
      status: response.status,
      body: text.slice(0, 1000),
      code: payload.error?.code,
      message: payload.error?.message,
    });
    throw new ClientApiError(
      response.status,
      payload.error?.code ?? "REQUEST_FAILED",
      payload.error?.message ?? `Request failed with HTTP ${response.status}.`,
    );
  }

  return payload;
}

let supabase: SupabaseClient | null = null;

/** Anon-key client, used only for the public artist directory. */
function anonClient(): SupabaseClient | null {
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null;
  supabase ??= createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabase;
}

// ---------------------------------------------------------------------------
// Artist directory
// ---------------------------------------------------------------------------

export async function listArtists(): Promise<Artist[]> {
  const client = anonClient();
  if (!client) return [];

  const { data, error } = await client
    .from("artists")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new ClientApiError(0, "ARTISTS_UNAVAILABLE", error.message);
  return (data ?? []) as Artist[];
}

// ---------------------------------------------------------------------------
// Step 1 — hand photo
// ---------------------------------------------------------------------------

export interface UploadHandPhotoInput {
  uri: string;
  fileName: string;
  mimeType: string;
}

async function fetchWithTimeout(url: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 30000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ClientApiError(0, "NETWORK_TIMEOUT", "The request took too long. Check your internet connection.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function uploadHandPhoto(input: UploadHandPhotoInput): Promise<string> {
  console.log("[Mobile NOTD] uploadHandPhoto start", { uri: input.uri, fileName: input.fileName, mimeType: input.mimeType });

  const url = getApiUrl("/api/hand-photo");

  return new Promise((resolve, reject) => {
    console.log("[Mobile NOTD] uploadHandPhoto sending via xhr");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.responseType = "json";

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        console.log("[Mobile NOTD] uploadHandPhoto progress", { percent: Math.round((event.loaded / event.total) * 100) });
      }
    });

    xhr.addEventListener("load", () => {
      console.log("[Mobile NOTD] uploadHandPhoto xhr response", { status: xhr.status, statusText: xhr.statusText });
      if (xhr.status < 200 || xhr.status >= 300) {
        const errorText = typeof xhr.responseText === "string" ? xhr.responseText.slice(0, 500) : JSON.stringify(xhr.response).slice(0, 500);
        console.error("[Mobile NOTD] uploadHandPhoto xhr failed", { status: xhr.status, body: errorText });
        reject(new Error(`Upload failed with HTTP ${xhr.status}: ${errorText}`));
        return;
      }

      const payload = xhr.response;
      console.log("[Mobile NOTD] uploadHandPhoto resolved", { url: payload?.url });
      resolve(payload?.url);
    });

    xhr.addEventListener("error", () => {
      console.error("[Mobile NOTD] uploadHandPhoto xhr error");
      reject(new Error("Upload failed due to a network error."));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload was aborted."));
    });

    const form = new FormData();
    form.append("file", {
      uri: input.uri,
      name: input.fileName,
      type: input.mimeType,
    } as any);

    xhr.send(form);
  });
}

// ---------------------------------------------------------------------------
// Step 2 — AI surprise in the artist's style, then the try-on render
// ---------------------------------------------------------------------------

/**
 * The artist's public portfolio.
 *
 * Read straight from Supabase with the anon key rather than through the artist
 * API: `looks` has a public read policy, and the artist routes are gated on the
 * shared artist secret that a client must never hold.
 */
export async function listLooks(artistId: string): Promise<Look[]> {
  const client = anonClient();
  if (!client) return [];

  const { data, error } = await client
    .from("looks")
    .select("*")
    .eq("artist_id", artistId)
    .order("created_at", { ascending: false });

  if (error) throw new ClientApiError(0, "LOOKS_UNAVAILABLE", error.message);
  return (data ?? []) as Look[];
}

/**
 * `lookId` anchors the design to one portfolio look, so a client who picked a
 * look gets that look back rather than a blend of the artist's whole catalogue.
 */
export async function generateSurprise(artistId: string, lookId?: string | null): Promise<ArtistAwareDesign> {
  const response = await fetchWithTimeout(getApiUrl("/api/surprise"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artistId, lookId: lookId ?? null }),
  });
  return (await unwrap<{ design: ArtistAwareDesign }>(response)).design;
}

/**
 * Mirrors the web "Nail of the Day" spin: the same `/api/generate-design`
 * endpoint, the same request shape, so both surfaces reveal the same design.
 */
const DESIGN_CACHE = new Map<string, { design: NailOfTheDayDesign; nailImageUrl: string | null }>();

export async function generateNailOfTheDay(
  shape: string,
  tags: string[],
  salt: number,
): Promise<{ design: NailOfTheDayDesign; nailImageUrl: string | null }> {
  const cacheKey = `${shape}::${tags.sort().join(",")}::${salt}`;
  const cached = DESIGN_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  console.log("[Mobile NOTD API] generateNailOfTheDay start", { shape, tags, salt });
  const started = Date.now();
  try {
    const response = await fetchWithTimeout(getApiUrl("/api/generate-design"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shape, tags, salt }),
    });
    console.log("[Mobile NOTD API] response status", response.status, "in", Date.now() - started, "ms");
    const payload = await unwrap<{ design: NailOfTheDayDesign; nailImageUrl: string | null }>(response);
    console.log("[Mobile NOTD API] payload keys", Object.keys(payload), "in", Date.now() - started, "ms");
    const design = payload.design ?? ({} as NailOfTheDayDesign);
    if (!design || !("name" in (design ?? {}))) {
      throw new Error("Design payload was empty.");
    }
    const result = { design, nailImageUrl: payload.nailImageUrl ?? null };
    DESIGN_CACHE.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error("[Mobile NOTD API] generateNailOfTheDay failed", error, "in", Date.now() - started, "ms");
    console.warn("[Mobile NOTD API] falling back to local design generator");
    const fallback = buildLocalFallback(shape, tags, salt);
    return fallback;
  }
}

function buildLocalFallback(shape: string, tags: string[], salt: number): { design: NailOfTheDayDesign; nailImageUrl: string | null } {
  const seed = hashString([shape, ...tags, salt].join("|"));
  const palette = generatePalette(seed);
  const pattern = pickLocalPattern(seed);
  const finish = pickLocalFinish(seed);
  const design: NailOfTheDayDesign = {
    name: `${pattern.replace(/_/g, " ")} ${shape}`,
    description: `A ${finish} ${shape} manicure with ${pattern.replace(/_/g, " ")} texture.`,
    imagePrompt: `Single detached ${shape} nail with ${pattern.replace(/_/g, " ")} art in ${finish} finish; palette ${palette.slice(0, 4).join(", ")}.`,
    pattern,
    finish,
    colors: palette,
    tags,
    shape,
    complexity: "medium",
    layers: buildLocalLayers(pattern, palette, finish),
    texture: buildLocalTexture(pattern, finish),
    motifs: [],
  };
  return { design, nailImageUrl: null };
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function pickLocalPattern(seed: number): string {
  const patterns = ["french", "gradient", "glitter_accent", "chrome_accent", "matte_overlay", "gloss_highlight", "geometric", "dots", "marble", "watercolor", "fishnet", "sparkle", "lace", "chrome_heart", "galaxy", "paint_brush", "gloss_band", "metallic_stripe", "checker", "floral", "abstract", "minimalist", "retro", "art_deco", "gradient_glow", "matte_chrome", "glitter_rain", "starry_night"];
  return patterns[seed % patterns.length] ?? "gradient";
}

function pickLocalFinish(seed: number): string {
  const finishes = ["glossy", "matte", "metallic", "chrome", "pearl", "shimmer", "jelly", "sheer", "satin", "velvet", "iridescent", "holographic", "matte_metallic", "gloss_chrome", "pearl_shimmer", "cream"];
  return finishes[seed % finishes.length] ?? "glossy";
}

function buildLocalLayers(pattern: string, colors: string[], finish: string) {
  const accent = colors[1] ?? "#D4B8B1";
  const secondary = colors[2] ?? "#B99FA9";
  const base = { type: "fill", colors: [colors[0] ?? "#E8D5CE"], opacity: 1 } as const;
  const layers = [base];
  if (pattern === "french") layers.push({ type: "stroke", pattern: "french_tip", colors: [colors[1] ?? "#FFFFFF"], opacity: 0.95, width: 6 } as const);
  if (pattern === "gradient") layers.push({ type: "fill", colors, opacity: 1 } as const);
  if (pattern === "glitter_accent" || finish === "shimmer") layers.push({ type: "fill", pattern: "glitter", colors: [colors[1] ?? "#FFD700"], opacity: 0.7 } as const);
  if (pattern === "chrome_accent" || finish === "chrome") layers.push({ type: "fill", pattern: "chrome_band", colors: [colors[1] ?? "#C0C0C0"], opacity: 0.85 } as const);
  if (pattern === "matte_overlay" || finish === "matte") layers.push({ type: "fill", pattern: "matte_overlay", colors: [colors[1] ?? "#F5E6E0"], opacity: 0.9 } as const);
  if (pattern === "gloss_highlight" || finish === "glossy") layers.push({ type: "fill", pattern: "gloss_highlight", colors: [colors[1] ?? "#FFFFFF"], opacity: 0.9 } as const);
  if (pattern === "fishnet") layers.push({ type: "pattern", pattern: "fishnet", colors: [accent, secondary], opacity: 0.85 } as const);
  if (pattern === "sparkle") layers.push({ type: "pattern", pattern: "sparkle", colors: [accent, secondary], opacity: 0.9 } as const);
  if (pattern === "dots") layers.push({ type: "pattern", pattern: "dots", colors: [accent], opacity: 0.9 } as const);
  if (pattern === "geometric") layers.push({ type: "pattern", pattern: "geometric", colors: [accent], opacity: 0.85 } as const);
  if (pattern === "lace") layers.push({ type: "pattern", pattern: "lace", colors: [accent], opacity: 0.8 } as const);
  if (pattern === "metallic_stripe") layers.push({ type: "pattern", pattern: "metallic_stripe", colors: [accent], opacity: 0.9 } as const);
  if (pattern === "gloss_band") layers.push({ type: "pattern", pattern: "gloss_band", colors: [colors[1] ?? "#FFFFFF"], opacity: 0.9 } as const);
  if (["checker", "dots", "geometric", "lace", "metallic_stripe", "gloss_band"].includes(pattern)) layers.push({ type: "pattern", pattern, colors: [accent], opacity: 0.85 } as const);
  if (["floral", "abstract", "minimalist", "retro", "art_deco", "gradient_glow", "matte_chrome", "glitter_rain", "starry_night"].includes(pattern)) layers.push({ type: "fill", pattern, colors: colors.slice(0, 2), opacity: 0.85 } as const);
  return layers;
}

function buildLocalTexture(pattern: string, finish: string): string {
  if (pattern === "marble") return "marble";
  if (pattern === "watercolor" || pattern === "galaxy") return "watercolor";
  if (finish === "matte" || finish === "matte_overlay" || finish === "matte_chrome" || finish === "matte_metallic") return "matte";
  if (finish === "metallic" || finish === "metallic_stripe" || finish === "chrome" || finish === "gloss_chrome" || finish === "iridescent" || finish === "holographic") return "chrome";
  if (finish === "glossy" || finish === "gloss_highlight" || finish === "gloss_band" || finish === "jelly" || finish === "sheer" || finish === "satin" || finish === "velvet" || finish === "pearl_shimmer") return "gloss";
  if (finish === "shimmer" || finish === "pearl" || finish === "cream") return "gloss";
  if (pattern === "fishnet" || pattern === "sparkle" || pattern === "glitter" || pattern === "glitter_accent" || pattern === "glitter_rain" || pattern === "starry_night") return "gloss";
  if (pattern === "gradient_glow") return "gloss";
  return "smooth";
}

export async function renderTryOn(handUrl: string, refImageUrl: string): Promise<string> {
  const response = await fetchWithTimeout(getApiUrl("/api/render"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handUrl, refImageUrl }),
  });
  return (await unwrap<{ url: string }>(response)).url;
}

// ---------------------------------------------------------------------------
// Step 3 — booking request
// ---------------------------------------------------------------------------

export interface CreateSessionInput {
  artistId: string;
  clientHandImageUrl: string;
  renderedResultUrl: string | null;
  generatedPrompt: string;
  priceEstimate: PriceEstimate;
  usedTags: string[];
  complexity: ComplexityLevel;
  selectedLookId: string | null;
  requestedAppointmentTime: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
}

export async function createSession(input: CreateSessionInput): Promise<string> {
  const response = await fetch(getApiUrl("/api/sessions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await unwrap<{ token: string }>(response)).token;
}

// ---------------------------------------------------------------------------
// Status tracking — the customer only ever holds the opaque token
// ---------------------------------------------------------------------------

export async function fetchSessionStatus(token: string): Promise<SessionStatusView> {
  const response = await fetch(getApiUrl(`/api/sessions/${token}`), { cache: "no-store" });
  return (await unwrap<{ session: SessionStatusView }>(response)).session;
}

export type CounterResponse = "accept_counter" | "decline_counter";

export async function respondToCounter(
  token: string,
  action: CounterResponse,
): Promise<SessionStatusView> {
  const response = await fetch(getApiUrl(`/api/sessions/${token}/respond`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  return (await unwrap<{ session: SessionStatusView }>(response)).session;
}

// ---------------------------------------------------------------------------
// Deep-link resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a `/confirm/<token>` share link to a full artist.
 *
 * Mirrors the web route's two-step lookup: try `share_token` or `handle` first,
 * and only fall back to the default artist when the link does not resolve. The
 * public read policy on `artists` makes this safe with the anon key.
 */
export async function resolveArtistByToken(token: string): Promise<Artist | null> {
  const client = anonClient();
  if (!client) return null;

  const normalised = token.trim().toLowerCase();

  const { data, error } = await client
    .from("artists")
    .select("*")
    .or(`share_token.eq.${normalised},handle.eq.${normalised}`)
    .limit(1);

  if (error) return null;
  const match = (data ?? [])[0] as Artist | undefined;
  if (match) return match;

  // Unknown or expired link: fall back to the seeded artist when configured.
  if (!config.artistId) return null;

  const { data: fallback } = await client
    .from("artists")
    .select("*")
    .eq("id", config.artistId)
    .limit(1);

  return ((fallback ?? [])[0] as Artist | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// Style search
// ---------------------------------------------------------------------------

export interface StyleSearchMatch {
  artistId: string;
  score: number;
  matchedTags: string[];
}

export interface StyleSearchResult {
  summary: string;
  baseTags: string[];
  techniqueTags: string[];
  matches: (StyleSearchMatch & {
    displayName: string;
    handle: string;
    basePrice: number;
    shareToken: string | null;
  })[];
}

/**
 * Analyses a reference photo and scores it against every artist's real portfolio.
 *
 * React Native's FormData takes the `{ uri, name, type }` shape for file parts,
 * so the picker result is passed straight through — no base64 round trip needed
 * on the client side.
 */
export async function searchByStyle(input: {
  uri: string;
  fileName: string;
  mimeType: string;
}): Promise<StyleSearchResult> {
  const form = new FormData();
  form.append("file", {
    uri: input.uri,
    name: input.fileName,
    type: input.mimeType,
  } as unknown as Blob);

  const response = await fetch(getApiUrl("/api/search"), {
    method: "POST",
    body: form,
  });
  return unwrap<StyleSearchResult>(response);
}

// ---------------------------------------------------------------------------
// Runtime translation of dynamic content
// ---------------------------------------------------------------------------

/**
 * Proxied through the Next.js app rather than calling Gemini directly: the API
 * key is server-only and must never enter the Expo bundle.
 *
 * Never throws — the caller gets the original strings back if translation is
 * unavailable, so a text can always render in some language.
 */
export async function translateTexts(
  texts: readonly string[],
  target: "en" | "bg",
  source = "auto",
): Promise<string[]> {
  if (texts.length === 0) return [];

  try {
    const response = await fetch(getApiUrl("/api/translate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, target, source }),
    });
    if (!response.ok) return [...texts];

    const payload = (await response.json()) as { translations?: unknown };
    if (!Array.isArray(payload.translations)) return [...texts];

    // Guard against a short or reordered array from the model.
    return payload.translations.map((value, index) =>
      typeof value === "string" && value.trim().length > 0 ? value : (texts[index] ?? ""),
    );
  } catch {
    return [...texts];
  }
}
