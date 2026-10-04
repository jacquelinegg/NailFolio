-- ===========================================================================
-- NailFolio — 0002_booking_fields
-- Adds the client-facing booking fields used by the web app (Step 4) plus the
-- artist share token that backs the `/confirm/[token]` link.
-- Idempotent. Run after schema.sql.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Shareable artist link: /confirm/[token]
-- The token is seeded from the handle so existing rows resolve immediately.
-- ---------------------------------------------------------------------------
ALTER TABLE artists ADD COLUMN IF NOT EXISTS share_token TEXT;

UPDATE artists
SET share_token = lower(handle)
WHERE share_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS artists_share_token_idx ON artists (share_token);

-- ---------------------------------------------------------------------------
-- Booking session: client contact details and chosen look
-- ---------------------------------------------------------------------------
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS client_name    TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS client_phone   TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS client_email   TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS selected_look_id UUID REFERENCES looks (id) ON DELETE SET NULL;

-- Full itemised receipt produced by services/pricing.ts (JSONB).
-- `estimated_price` / `estimated_duration_mins` stay as the flat numeric
-- mirrors so the artist feed can sort/filter without parsing JSON.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS price_estimate JSONB;

-- ---------------------------------------------------------------------------
-- Compatibility aliases required by the product spec.
-- Generated columns keep a single source of truth (client_hand_image_url and
-- requested_appointment_time) while exposing the spec's names.
-- ---------------------------------------------------------------------------
ALTER TABLE sessions DROP COLUMN IF EXISTS client_hand_url;
ALTER TABLE sessions ADD COLUMN client_hand_url TEXT
    GENERATED ALWAYS AS (client_hand_image_url) STORED;

ALTER TABLE sessions DROP COLUMN IF EXISTS scheduled_at;
ALTER TABLE sessions ADD COLUMN scheduled_at TIMESTAMP WITH TIME ZONE
    GENERATED ALWAYS AS (requested_appointment_time) STORED;

CREATE INDEX IF NOT EXISTS sessions_selected_look_idx ON sessions (selected_look_id);

-- ---------------------------------------------------------------------------
-- Guardrails: a session can never be confirmed without a price and a slot.
-- ---------------------------------------------------------------------------
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_confirmed_needs_total;
ALTER TABLE sessions
    ADD CONSTRAINT sessions_confirmed_needs_total
    CHECK (status <> 'confirmed' OR (estimated_price IS NOT NULL AND requested_appointment_time IS NOT NULL));
