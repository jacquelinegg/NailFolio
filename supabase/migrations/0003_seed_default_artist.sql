-- ===========================================================================
-- NailFolio — 0003_seed_default_artist
-- Seeds the single MVP artist used by the demo /confirm/[token] page and the
-- artist mobile app.
--
-- The id is pinned rather than left to gen_random_uuid() so that it matches
-- NEXT_PUBLIC_DEFAULT_ARTIST_ID (root .env) and EXPO_PUBLIC_ARTIST_ID
-- (apps/mobile/.env). A generated id here would drift from both on every
-- fresh `supabase db reset` and silently break the seeded demo link.
--
-- Idempotent: ON CONFLICT (handle) makes a re-run a no-op, so this is safe on
-- a database that already has the row (for example one seeded by hand or by a
-- previous run). The share_token unique index is left alone; a conflicting
-- share_token from another row is a real data problem and should surface.
-- ===========================================================================

INSERT INTO artists (id, display_name, handle, share_token, base_price, technique_prices, duration_by_complexity)
VALUES (
    'b107ce92-ceb4-46f0-9346-3ca69067eaad',
    'NailFolio Studio',
    'nailfolio',
    'nailfolio',
    40.00,
    '{"chrome": 15.00, "glitter": 10.00, "3d_gem": 20.00, "french": 8.00}'::jsonb,
    '{"low": 60, "medium": 75, "high": 105}'::jsonb
)
ON CONFLICT (handle) DO NOTHING;
