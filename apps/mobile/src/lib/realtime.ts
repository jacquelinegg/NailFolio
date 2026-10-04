/**
 * Supabase Realtime listener for incoming booking requests.
 *
 * `sessions` is RLS-locked to the owning artist, so the channel only delivers
 * rows once the artist's Supabase session is attached (`supabase.auth.signIn…`).
 * Until that exists, `BookingFeed` polls `fetchSessions()` and treats this
 * subscription as a latency upgrade rather than the source of truth.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { config } from "../config";
import type { BookingSession } from "@/lib/types";

export type SessionEvent = "INSERT" | "UPDATE" | "DELETE";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null;
  client ??= createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}

export interface SubscribeOptions {
  artistId: string;
  onChange: (event: SessionEvent, session: BookingSession) => void;
  onStatusChange?: (status: "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED") => void;
}

/** Subscribes to INSERT/UPDATE on this artist's sessions. Returns an unsubscribe fn. */
export function subscribeToArtistSessions({ artistId, onChange, onStatusChange }: SubscribeOptions): () => void {
  const supabase = getClient();
  if (!supabase) return () => undefined;

  const channel: RealtimeChannel = supabase
    .channel(`artist-sessions:${artistId}`)
    .on<BookingSession>(
      "postgres_changes",
      { event: "*", schema: "public", table: "sessions", filter: `artist_id=eq.${artistId}` },
      (payload) => {
        if ((payload.eventType === "INSERT" || payload.eventType === "UPDATE" || payload.eventType === "DELETE") && payload.new) {
          onChange(payload.eventType, payload.new as BookingSession);
        }
      },
    )
    .subscribe((status) => onStatusChange?.(status as "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED"));

  return () => {
    void supabase.removeChannel(channel);
  };
}
