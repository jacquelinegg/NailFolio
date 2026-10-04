/**
 * Domain types shared by the client web app, the API routes and (mirrored) the
 * artist mobile app. Keep in sync with `supabase/schema.sql`.
 */

export type ComplexityLevel = "low" | "medium" | "high";

export type SessionStatus = "pending" | "confirmed" | "counter_offer" | "rejected";

export const STORAGE_BUCKETS = {
  handPhotos: "hand-photos",
  portfolioLooks: "portfolio-looks",
  renders: "renders",
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/**
 * Row types are declared as `type` aliases (not interfaces) on purpose: only
 * aliases get an implicit index signature, which is what
 * `SupabaseClient<Database>` requires to infer the schema generics.
 */
export type Look = {
  id: string;
  artist_id: string;
  image_url: string;
  tags: string[];
  base_price: number;
  complexity_level: ComplexityLevel | null;
  created_at: string;
};

export type BookingSession = {
  id: string;
  token: string;
  artist_id: string;
  client_hand_image_url: string | null;
  /** Generated alias of `client_hand_image_url` (see migration 0002). */
  client_hand_url: string | null;
  rendered_result_url: string | null;
  generated_prompt: string | null;
  estimated_price: number | null;
  estimated_duration_mins: number | null;
  requested_appointment_time: string | null;
  /** Generated alias of `requested_appointment_time` (see migration 0002). */
  scheduled_at: string | null;
  status: SessionStatus;
  artist_notes: string | null;
  counter_price: number | null;
  counter_appointment_time: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  selected_look_id: string | null;
  /** Full itemised receipt from `services/pricing.ts`. */
  price_estimate: PriceEstimate | null;
  created_at: string;
  updated_at: string;
};

/** Writable columns of `sessions` (generated aliases and `updated_at` excluded). */
export type SessionInsert = {
  token: string;
  artist_id: string;
  status?: SessionStatus;
  client_hand_image_url?: string | null;
  rendered_result_url?: string | null;
  generated_prompt?: string | null;
  selected_look_id?: string | null;
  price_estimate?: PriceEstimate | null;
  estimated_price?: number | null;
  estimated_duration_mins?: number | null;
  requested_appointment_time?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  artist_notes?: string | null;
  counter_price?: number | null;
  counter_appointment_time?: string | null;
  id?: string;
  created_at?: string;
};

export type SessionUpdate = Partial<Omit<BookingSession, "id" | "client_hand_url" | "scheduled_at">>;

/** Richer view for the artist's own feed: includes who booked and what they asked for. */
export type ArtistSessionView = SessionStatusView & {
  id: string;
  artistId: string;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  clientHandImageUrl: string | null;
  generatedPrompt: string | null;
  selectedLookId: string | null;
};

/** Payload the client sends when dispatching a booking request. */
export type CreateSessionInput = {
  artistId: string;
  token: string;
  clientHandImageUrl: string;
  renderedResultUrl?: string | null;
  generatedPrompt?: string | null;
  selectedLookId?: string | null;
  priceEstimate: PriceEstimate;
  requestedAppointmentTime: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string | null;
};

/** Compact, client-safe view of a session used by the status tracker. */
export type SessionStatusView = {
  token: string;
  status: SessionStatus;
  estimatedPrice: number | null;
  estimatedDurationMins: number | null;
  requestedAppointmentTime: string | null;
  counterPrice: number | null;
  counterAppointmentTime: string | null;
  renderedResultUrl: string | null;
  artistNotes: string | null;
  priceEstimate: PriceEstimate | null;
  createdAt: string;
  updatedAt: string;
};

/** Itemised receipt rendered before the client dispatches a booking. */
export interface PriceLineItem {
  label: string;
  amount: number;
  /** Base manicure is always present; the rest are technique / AI add-ons. */
  kind: "base" | "technique" | "ai_complexity";
}

export interface PriceEstimate {
  lineItems: PriceLineItem[];
  total: number;
  durationMins: number;
}

export interface ArtistAwareDesign {
  /** Natural-language design concept synthesised from the artist's own tags. */
  description: string;
  /** Prompt forwarded to the render service. */
  prompt: string;
  /** Portfolio look used as the visual reference for the transfer. */
  refImageUrl: string;
  /** Tags the LLM combined, in order. */
  usedTags: string[];
  estimate: PriceEstimate;
  /**
   * Complexity the design was priced at. Sent back with the booking so the
   * server re-derives the receipt from the same inputs the client was shown,
   * rather than defaulting every design to one level.
   */
  complexity: ComplexityLevel;
  /**
   * Portfolio look the client picked before generating. Null when the design came
   * from the "surprise me" path, which picks its own reference from the whole
   * catalogue. Carried on the design so the booking can attribute the request to
   * the look the client actually chose, rather than re-deriving it later.
   */
  sourceLookId?: string | null;
}

/**
 * A single "Nail of the Day" design, as returned by `/api/generate-design`.
 * Shared between the web reveal and the artist app so both render the same
 * spin from the same payload.
 */
export interface NailOfTheDayDesign {
  name: string;
  description: string;
  pattern: string;
  finish: string;
  colors: string[];
  tags: string[];
  shape: string;
  complexity: "simple" | "medium" | "complex";
  texture: string;
  layers: {
    type: "fill" | "stroke" | "pattern" | "shape" | "filter";
    pattern?: string;
    colors?: string[];
    opacity?: number;
    blend?: "normal" | "multiply" | "screen" | "overlay";
    shapes?: string[];
    filter?: string;
    width?: number;
    dashArray?: string;
  }[];
  motifs: {
    kind: string;
    x: number;
    y: number;
    size: number;
    color: string;
    rotation: number;
    role: "focal" | "support" | "micro";
  }[];
  imagePrompt?: string;
}

export type Artist = {
  id: string;
  auth_user_id: string | null;
  display_name: string;
  handle: string;
  /** Shareable link segment used by `/confirm/[token]`. */
  share_token: string | null;
  base_price: number;
  technique_prices: Record<string, number>;
  duration_by_complexity: Record<string, number>;
  created_at: string;
};

/** Canonical Supabase JSON shape for the tables in `supabase/schema.sql`. */
export type Database = {
  public: {
    Tables: {
      artists: {
        Row: Artist;
        Insert: Omit<Artist, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Artist, "id">>;
        Relationships: [];
      };
      looks: {
        Row: Look;
        Insert: Omit<Look, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<Look, "id">>;
        Relationships: [];
      };
      sessions: {
        Row: BookingSession;
        Insert: SessionInsert;
        Update: SessionUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      session_status: SessionStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
