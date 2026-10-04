-- ===========================================================================
-- NailFolio — Supabase schema (reference copy)
--
-- Applied schema lives in supabase/migrations/ and is the source of truth:
--   0001_initial_schema.sql     — this file, byte-identical
--   0002_booking_fields.sql     — Step 4 booking columns and share_token
--
-- Apply with `supabase db push`, not by pasting this file. This copy is kept
-- only for reading; edit the migration, then mirror it here.
-- Idempotent: safe to re-run on an empty or already-migrated project.
-- ===========================================================================

-- gen_random_uuid() is built into PostgreSQL 13+, so no uuid-ossp extension is
-- needed (and creating one would require superuser rights the migration role
-- does not have).

-- ---------------------------------------------------------------------------
-- Artists (owner of portfolio looks and incoming booking sessions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    handle      TEXT UNIQUE NOT NULL,
    -- Baseline manicure price, e.g. 40.00
    base_price  DECIMAL(10, 2) NOT NULL DEFAULT 40.00,
    -- Per-technique add-on pricing, e.g. {"chrome": 15.00, "3d_gem": 20.00}
    technique_prices JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Minutes per complexity level, e.g. {"low": 60, "medium": 75, "high": 105}
    duration_by_complexity JSONB NOT NULL
        DEFAULT '{"low": 60, "medium": 75, "high": 105}'::jsonb,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Table 1: Looks (managed by the artist mobile app)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS looks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id       UUID NOT NULL REFERENCES artists (id) ON DELETE CASCADE,
    image_url       TEXT NOT NULL,
    tags            TEXT[] NOT NULL DEFAULT '{}', -- e.g. ARRAY['nude', 'french', 'chrome']
    base_price      DECIMAL(10, 2) NOT NULL DEFAULT 40.00,
    complexity_level TEXT CHECK (complexity_level IN ('low', 'medium', 'high')),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS looks_artist_id_idx ON looks (artist_id);
CREATE INDEX IF NOT EXISTS looks_tags_idx ON looks USING GIN (tags);

-- ---------------------------------------------------------------------------
-- Table 2: Sessions (shared between the client web app and the artist app)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
        CREATE TYPE session_status AS ENUM ('pending', 'confirmed', 'counter_offer', 'rejected');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS sessions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token                       TEXT UNIQUE NOT NULL,
    artist_id                   UUID NOT NULL REFERENCES artists (id) ON DELETE CASCADE,
    client_hand_image_url       TEXT,
    rendered_result_url         TEXT,
    generated_prompt            TEXT,
    estimated_price             DECIMAL(10, 2),
    estimated_duration_mins     INT,
    requested_appointment_time  TIMESTAMP WITH TIME ZONE,
    status                      session_status DEFAULT 'pending',
    artist_notes                TEXT,
    -- Counter-offer payload: revised price and/or revised slot
    counter_price               DECIMAL(10, 2),
    counter_appointment_time    TIMESTAMP WITH TIME ZONE,
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_artist_id_idx ON sessions (artist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_status_idx ON sessions (status);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sessions_set_updated_at ON sessions;
CREATE TRIGGER sessions_set_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES
    ('hand-photos',     'hand-photos',     false),
    ('portfolio-looks', 'portfolio-looks', true),
    ('renders',         'renders',         true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Strategy: clients are anonymous (no accounts). Anything a client must read or
-- write goes through a server route using the service role, which bypasses RLS.
-- The public web pages read `looks` directly with the anon key.
-- ---------------------------------------------------------------------------
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE looks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- artists: readable by anyone (public portfolio shell), writable by its owner.
DROP POLICY IF EXISTS artists_public_read ON artists;
CREATE POLICY artists_public_read ON artists FOR SELECT USING (true);

DROP POLICY IF EXISTS artists_self_write ON artists;
CREATE POLICY artists_self_write ON artists
    FOR ALL
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

-- looks: public read (portfolio + AI generator reference images).
DROP POLICY IF EXISTS looks_public_read ON looks;
CREATE POLICY looks_public_read ON looks FOR SELECT USING (true);

-- looks: only the owning artist can insert / update / delete.
DROP POLICY IF EXISTS looks_artist_insert ON looks;
CREATE POLICY looks_artist_insert ON looks
    FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM artists a WHERE a.id = artist_id AND a.auth_user_id = auth.uid()));

DROP POLICY IF EXISTS looks_artist_update ON looks;
CREATE POLICY looks_artist_update ON looks
    FOR UPDATE
    USING (EXISTS (SELECT 1 FROM artists a WHERE a.id = artist_id AND a.auth_user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM artists a WHERE a.id = artist_id AND a.auth_user_id = auth.uid()));

DROP POLICY IF EXISTS looks_artist_delete ON looks;
CREATE POLICY looks_artist_delete ON looks
    FOR DELETE
    USING (EXISTS (SELECT 1 FROM artists a WHERE a.id = artist_id AND a.auth_user_id = auth.uid()));

-- sessions: strictly the owning artist. Clients poll their own session through a
-- service-role route handler, keyed on the unguessable `token`.
DROP POLICY IF EXISTS sessions_artist_read ON sessions;
CREATE POLICY sessions_artist_read ON sessions
    FOR SELECT
    USING (EXISTS (SELECT 1 FROM artists a WHERE a.id = artist_id AND a.auth_user_id = auth.uid()));

DROP POLICY IF EXISTS sessions_artist_update ON sessions;
CREATE POLICY sessions_artist_update ON sessions
    FOR UPDATE
    USING (EXISTS (SELECT 1 FROM artists a WHERE a.id = artist_id AND a.auth_user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM artists a WHERE a.id = artist_id AND a.auth_user_id = auth.uid()));

-- Storage: authenticated artists manage their own portfolio objects.
DROP POLICY IF EXISTS portfolio_looks_artist_write ON storage.objects;
CREATE POLICY portfolio_looks_artist_write ON storage.objects
    FOR ALL
    USING (bucket_id = 'portfolio-looks' AND auth.role() = 'authenticated')
    WITH CHECK (bucket_id = 'portfolio-looks' AND auth.role() = 'authenticated');

-- Storage: hand photos are written by the service role (route handlers) and are
-- only ever read back through signed URLs.
DROP POLICY IF EXISTS hand_photos_service_write ON storage.objects;
CREATE POLICY hand_photos_service_write ON storage.objects
    FOR ALL
    USING (bucket_id = 'hand-photos')
    WITH CHECK (bucket_id = 'hand-photos');

-- ---------------------------------------------------------------------------
-- Realtime: push every session change (pending -> confirmed/counter_offer/rejected)
-- to the artist mobile app.
-- ---------------------------------------------------------------------------
ALTER TABLE sessions REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Convenience: resolve an artist by the shareable handle used in /confirm links.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.artist_by_handle(p_handle TEXT)
RETURNS TABLE (id UUID, display_name TEXT, base_price DECIMAL, technique_prices JSONB, duration_by_complexity JSONB)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT a.id, a.display_name, a.base_price, a.technique_prices, a.duration_by_complexity
    FROM artists a
    WHERE a.handle = lower(p_handle);
$$;
