-- ===========================================================================
-- NailFolio — 0004_seed_12_artists
-- Seeds 12 demo artists, each with 3 portfolio looks (36 looks total).
-- Idempotent: ON CONFLICT (handle/id) makes re-runs a no-op.
-- ===========================================================================

INSERT INTO artists (id, display_name, handle, share_token, base_price, technique_prices, duration_by_complexity)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Anna Nails',
    'anna-nails',
    'anna-nails',
    45.00,
    '{"chrome": 15.00, "glitter": 10.00, "3d_gem": 20.00, "french": 8.00}'::jsonb,
    '{"low": 60, "medium": 75, "high": 105}'::jsonb
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Bella Studio',
    'bella-studio',
    'bella-studio',
    50.00,
    '{"chrome": 18.00, "glitter": 12.00, "3d_gem": 25.00, "french": 10.00}'::jsonb,
    '{"low": 60, "medium": 75, "high": 105}'::jsonb
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Carmen Art',
    'carmen-art',
    'carmen-art',
    40.00,
    '{"chrome": 12.00, "glitter": 8.00, "3d_gem": 18.00, "french": 6.00}'::jsonb,
    '{"low": 60, "medium": 75, "high": 105}'::jsonb
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'Diana Nails',
    'diana-nails',
    'diana-nails',
    55.00,
    '{"chrome": 20.00, "glitter": 15.00, "3d_gem": 30.00, "french": 12.00}'::jsonb,
    '{"low": 60, "medium": 75, "high": 105}'::jsonb
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    'Elena Style',
    'elena-style',
    'elena-style',
    42.00,
    '{"chrome": 14.00, "glitter": 10.00, "3d_gem": 22.00, "french": 8.00}'::jsonb,
    '{"low": 60, "medium": 75, "high": 105}'::jsonb
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    'Fiona Beauty',
    'fiona-beauty',
    'fiona-beauty',
    48.00,
    '{"chrome": 16.00, "glitter": 12.00, "3d_gem": 24.00, "french": 10.00}'::jsonb,
    '{"low": 60, "medium": 75, "high": 105}'::jsonb
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    'Grace Nails',
    'grace-nails',
    'grace-nails',
    38.00,
    '{"chrome": 10.00, "glitter": 8.00, "3d_gem": 15.00, "french": 5.00}'::jsonb,
    '{"low": 60, "medium": 75, "high": 105}'::jsonb
  ),
  (
    '88888888-8888-8888-8888-888888888888',
    'Hannah Studio',
    'hannah-studio',
    'hannah-studio',
    52.00,
    '{"chrome": 18.00, "glitter": 14.00, "3d_gem": 28.00, "french": 11.00}'::jsonb,
    '{"low": 60, "medium": 75, "high": 105}'::jsonb
  ),
  (
    '99999999-9999-9999-9999-999999999999',
    'Iris Art',
    'iris-art',
    'iris-art',
    46.00,
    '{"chrome": 15.00, "glitter": 11.00, "3d_gem": 21.00, "french": 9.00}'::jsonb,
    '{"low": 60, "medium": 75, "high": 105}'::jsonb
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Julia Nails',
    'julia-nails',
    'julia-nails',
    44.00,
    '{"chrome": 14.00, "glitter": 10.00, "3d_gem": 20.00, "french": 8.00}'::jsonb,
    '{"low": 60, "medium": 75, "high": 105}'::jsonb
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Kate Style',
    'kate-style',
    'kate-style',
    49.00,
    '{"chrome": 17.00, "glitter": 12.00, "3d_gem": 25.00, "french": 10.00}'::jsonb,
    '{"low": 60, "medium": 75, "high": 105}'::jsonb
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Luna Beauty',
    'luna-beauty',
    'luna-beauty',
    41.00,
    '{"chrome": 13.00, "glitter": 9.00, "3d_gem": 19.00, "french": 7.00}'::jsonb,
    '{"low": 60, "medium": 75, "high": 105}'::jsonb
  )
ON CONFLICT (handle) DO NOTHING;

INSERT INTO looks (id, artist_id, image_url, tags, base_price, complexity_level)
VALUES
  -- Anna Nails
  ('11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'https://picsum.photos/seed/anna-look1/600/800', ARRAY['nude', 'french', 'minimal'], 45.00, 'low'),
  ('11111111-1111-1111-1111-111111111113', '11111111-1111-1111-1111-111111111111', 'https://picsum.photos/seed/anna-look2/600/800', ARRAY['chrome', 'silver', 'glam'], 60.00, 'medium'),
  ('11111111-1111-1111-1111-111111111114', '11111111-1111-1111-1111-111111111111', 'https://picsum.photos/seed/anna-look3/600/800', ARRAY['3d_gem', 'red', 'luxury'], 75.00, 'high'),

  -- Bella Studio
  ('22222222-2222-2222-2222-222222222212', '22222222-2222-2222-2222-222222222222', 'https://picsum.photos/seed/bella-look1/600/800', ARRAY['glitter', 'pink', 'party'], 50.00, 'low'),
  ('22222222-2222-2222-2222-222222222213', '22222222-2222-2222-2222-222222222222', 'https://picsum.photos/seed/bella-look2/600/800', ARRAY['french', 'white', 'classic'], 55.00, 'medium'),
  ('22222222-2222-2222-2222-222222222214', '22222222-2222-2222-2222-222222222222', 'https://picsum.photos/seed/bella-look3/600/800', ARRAY['3d_gem', 'blue', 'bridal'], 80.00, 'high'),

  -- Carmen Art
  ('33333333-3333-3333-3333-333333333312', '33333333-3333-3333-3333-333333333333', 'https://picsum.photos/seed/carmen-look1/600/800', ARRAY['matte', 'black', 'gothic'], 40.00, 'low'),
  ('33333333-3333-3333-3333-333333333313', '33333333-3333-3333-3333-333333333333', 'https://picsum.photos/seed/carmen-look2/600/800', ARRAY['chrome', 'gold', 'elegant'], 58.00, 'medium'),
  ('33333333-3333-3333-3333-333333333314', '33333333-3333-3333-3333-333333333333', 'https://picsum.photos/seed/carmen-look3/600/800', ARRAY['3d_gem', 'purple', 'fantasy'], 72.00, 'high'),

  -- Diana Nails
  ('44444444-4444-4444-4444-444444444412', '44444444-4444-4444-4444-444444444444', 'https://picsum.photos/seed/diana-look1/600/800', ARRAY['nude', 'natural', 'everyday'], 55.00, 'low'),
  ('44444444-4444-4444-4444-444444444413', '44444444-4444-4444-4444-444444444444', 'https://picsum.photos/seed/diana-look2/600/800', ARRAY['glitter', 'rose', 'romantic'], 65.00, 'medium'),
  ('44444444-4444-4444-4444-444444444414', '44444444-4444-4444-4444-444444444444', 'https://picsum.photos/seed/diana-look3/600/800', ARRAY['3d_gem', 'emerald', 'premium'], 85.00, 'high'),

  -- Elena Style
  ('55555555-5555-5555-5555-555555555512', '55555555-5555-5555-5555-555555555555', 'https://picsum.photos/seed/elena-look1/600/800', ARRAY['french', 'tip', 'classic'], 42.00, 'low'),
  ('55555555-5555-5555-5555-555555555513', '55555555-5555-5555-5555-555555555555', 'https://picsum.photos/seed/elena-look2/600/800', ARRAY['chrome', 'iridescent', 'trendy'], 56.00, 'medium'),
  ('55555555-5555-5555-5555-555555555514', '55555555-5555-5555-5555-555555555555', 'https://picsum.photos/seed/elena-look3/600/800', ARRAY['3d_gem', 'pearl', 'wedding'], 78.00, 'high'),

  -- Fiona Beauty
  ('66666666-6666-6666-6666-666666666612', '66666666-6666-6666-6666-666666666666', 'https://picsum.photos/seed/fiona-look1/600/800', ARRAY['pastel', 'blue', 'soft'], 48.00, 'low'),
  ('66666666-6666-6666-6666-666666666613', '66666666-6666-6666-6666-666666666666', 'https://picsum.photos/seed/fiona-look2/600/800', ARRAY['glitter', 'silver', 'shimmer'], 62.00, 'medium'),
  ('66666666-6666-6666-6666-666666666614', '66666666-6666-6666-6666-666666666666', 'https://picsum.photos/seed/fiona-look3/600/800', ARRAY['3d_gem', 'diamond', 'luxury'], 88.00, 'high'),

  -- Grace Nails
  ('77777777-7777-7777-7777-777777777712', '77777777-7777-7777-7777-777777777777', 'https://picsum.photos/seed/grace-look1/600/800', ARRAY['red', 'classic', 'bold'], 38.00, 'low'),
  ('77777777-7777-7777-7777-777777777713', '77777777-7777-7777-7777-777777777777', 'https://picsum.photos/seed/grace-look2/600/800', ARRAY['french', 'color', 'modern'], 45.00, 'medium'),
  ('77777777-7777-7777-7777-777777777714', '77777777-7777-7777-7777-777777777777', 'https://picsum.photos/seed/grace-look3/600/800', ARRAY['3d_gem', 'gold', 'royal'], 70.00, 'high'),

  -- Hannah Studio
  ('88888888-8888-8888-8888-888888888812', '88888888-8888-8888-8888-888888888888', 'https://picsum.photos/seed/hannah-look1/600/800', ARRAY['nude', 'gloss', 'natural'], 52.00, 'low'),
  ('88888888-8888-8888-8888-888888888813', '88888888-8888-8888-8888-888888888888', 'https://picsum.photos/seed/hannah-look2/600/800', ARRAY['chrome', 'holographic', 'futuristic'], 68.00, 'medium'),
  ('88888888-8888-8888-8888-888888888814', '88888888-8888-8888-8888-888888888888', 'https://picsum.photos/seed/hannah-look3/600/800', ARRAY['3d_gem', 'crystal', 'editorial'], 90.00, 'high'),

  -- Iris Art
  ('99999999-9999-9999-9999-999999999912', '99999999-9999-9999-9999-999999999999', 'https://picsum.photos/seed/iris-look1/600/800', ARRAY['pastel', 'pink', 'dreamy'], 46.00, 'low'),
  ('99999999-9999-9999-9999-999999999913', '99999999-9999-9999-9999-999999999999', 'https://picsum.photos/seed/iris-look2/600/800', ARRAY['glitter', 'rose-gold', 'elegant'], 58.00, 'medium'),
  ('99999999-9999-9999-9999-999999999914', '99999999-9999-9999-9999-999999999999', 'https://picsum.photos/seed/iris-look3/600/800', ARRAY['3d_gem', 'sapphire', 'royal'], 82.00, 'high'),

  -- Julia Nails
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa12', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'https://picsum.photos/seed/julia-look1/600/800', ARRAY['orange', 'summer', 'vibrant'], 44.00, 'low'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa13', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'https://picsum.photos/seed/julia-look2/600/800', ARRAY['french', 'artistic', 'color-block'], 52.00, 'medium'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa14', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'https://picsum.photos/seed/julia-look3/600/800', ARRAY['3d_gem', 'ruby', 'luxury'], 76.00, 'high'),

  -- Kate Style
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb12', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'https://picsum.photos/seed/kate-look1/600/800', ARRAY['white', 'bridal', 'pure'], 49.00, 'low'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb13', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'https://picsum.photos/seed/kate-look2/600/800', ARRAY['chrome', 'platinum', 'sophisticated'], 64.00, 'medium'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb14', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'https://picsum.photos/seed/kate-look3/600/800', ARRAY['3d_gem', 'pearl-white', 'couture'], 92.00, 'high'),

  -- Luna Beauty
  ('cccccccc-cccc-cccc-cccc-cccccccccc12', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'https://picsum.photos/seed/luna-look1/600/800', ARRAY['lavender', 'calm', 'relaxing'], 41.00, 'low'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc13', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'https://picsum.photos/seed/luna-look2/600/800', ARRAY['glitter', 'unicorn', 'playful'], 54.00, 'medium'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc14', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'https://picsum.photos/seed/luna-look3/600/800', ARRAY['3d_gem', 'mermaid', 'magical'], 74.00, 'high')
ON CONFLICT (id) DO NOTHING;
