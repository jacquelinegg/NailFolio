-- ===========================================================================
-- NailFolio — 0005_update_look_images
-- Replaces placeholder look image URLs with real seeded images from picsum.
-- ===========================================================================

UPDATE looks
SET image_url = CASE id
  WHEN '11111111-1111-1111-1111-111111111112' THEN 'https://picsum.photos/seed/anna-look1/600/800'
  WHEN '11111111-1111-1111-1111-111111111113' THEN 'https://picsum.photos/seed/anna-look2/600/800'
  WHEN '11111111-1111-1111-1111-111111111114' THEN 'https://picsum.photos/seed/anna-look3/600/800'
  WHEN '22222222-2222-2222-2222-222222222212' THEN 'https://picsum.photos/seed/bella-look1/600/800'
  WHEN '22222222-2222-2222-2222-222222222213' THEN 'https://picsum.photos/seed/bella-look2/600/800'
  WHEN '22222222-2222-2222-2222-222222222214' THEN 'https://picsum.photos/seed/bella-look3/600/800'
  WHEN '33333333-3333-3333-3333-333333333312' THEN 'https://picsum.photos/seed/carmen-look1/600/800'
  WHEN '33333333-3333-3333-3333-333333333313' THEN 'https://picsum.photos/seed/carmen-look2/600/800'
  WHEN '33333333-3333-3333-3333-333333333314' THEN 'https://picsum.photos/seed/carmen-look3/600/800'
  WHEN '44444444-4444-4444-4444-444444444412' THEN 'https://picsum.photos/seed/diana-look1/600/800'
  WHEN '44444444-4444-4444-4444-444444444413' THEN 'https://picsum.photos/seed/diana-look2/600/800'
  WHEN '44444444-4444-4444-4444-444444444414' THEN 'https://picsum.photos/seed/diana-look3/600/800'
  WHEN '55555555-5555-5555-5555-555555555512' THEN 'https://picsum.photos/seed/elena-look1/600/800'
  WHEN '55555555-5555-5555-5555-555555555513' THEN 'https://picsum.photos/seed/elena-look2/600/800'
  WHEN '55555555-5555-5555-5555-555555555514' THEN 'https://picsum.photos/seed/elena-look3/600/800'
  WHEN '66666666-6666-6666-6666-666666666612' THEN 'https://picsum.photos/seed/fiona-look1/600/800'
  WHEN '66666666-6666-6666-6666-666666666613' THEN 'https://picsum.photos/seed/fiona-look2/600/800'
  WHEN '66666666-6666-6666-6666-666666666614' THEN 'https://picsum.photos/seed/fiona-look3/600/800'
  WHEN '77777777-7777-7777-7777-777777777712' THEN 'https://picsum.photos/seed/grace-look1/600/800'
  WHEN '77777777-7777-7777-7777-777777777713' THEN 'https://picsum.photos/seed/grace-look2/600/800'
  WHEN '77777777-7777-7777-7777-777777777714' THEN 'https://picsum.photos/seed/grace-look3/600/800'
  WHEN '88888888-8888-8888-8888-888888888812' THEN 'https://picsum.photos/seed/hannah-look1/600/800'
  WHEN '88888888-8888-8888-8888-888888888813' THEN 'https://picsum.photos/seed/hannah-look2/600/800'
  WHEN '88888888-8888-8888-8888-888888888814' THEN 'https://picsum.photos/seed/hannah-look3/600/800'
  WHEN '99999999-9999-9999-9999-999999999912' THEN 'https://picsum.photos/seed/iris-look1/600/800'
  WHEN '99999999-9999-9999-9999-999999999913' THEN 'https://picsum.photos/seed/iris-look2/600/800'
  WHEN '99999999-9999-9999-9999-999999999914' THEN 'https://picsum.photos/seed/iris-look3/600/800'
  WHEN 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa12' THEN 'https://picsum.photos/seed/julia-look1/600/800'
  WHEN 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa13' THEN 'https://picsum.photos/seed/julia-look2/600/800'
  WHEN 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa14' THEN 'https://picsum.photos/seed/julia-look3/600/800'
  WHEN 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb12' THEN 'https://picsum.photos/seed/kate-look1/600/800'
  WHEN 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb13' THEN 'https://picsum.photos/seed/kate-look2/600/800'
  WHEN 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb14' THEN 'https://picsum.photos/seed/kate-look3/600/800'
  WHEN 'cccccccc-cccc-cccc-cccc-cccccccccc12' THEN 'https://picsum.photos/seed/luna-look1/600/800'
  WHEN 'cccccccc-cccc-cccc-cccc-cccccccccc13' THEN 'https://picsum.photos/seed/luna-look2/600/800'
  WHEN 'cccccccc-cccc-cccc-cccc-cccccccccc14' THEN 'https://picsum.photos/seed/luna-look3/600/800'
  ELSE image_url
END
WHERE id IN (
  '11111111-1111-1111-1111-111111111112',
  '11111111-1111-1111-1111-111111111113',
  '11111111-1111-1111-1111-111111111114',
  '22222222-2222-2222-2222-222222222212',
  '22222222-2222-2222-2222-222222222213',
  '22222222-2222-2222-2222-222222222214',
  '33333333-3333-3333-3333-333333333312',
  '33333333-3333-3333-3333-333333333313',
  '33333333-3333-3333-3333-333333333314',
  '44444444-4444-4444-4444-444444444412',
  '44444444-4444-4444-4444-444444444413',
  '44444444-4444-4444-4444-444444444414',
  '55555555-5555-5555-5555-555555555512',
  '55555555-5555-5555-5555-555555555513',
  '55555555-5555-5555-5555-555555555514',
  '66666666-6666-6666-6666-666666666612',
  '66666666-6666-6666-6666-666666666613',
  '66666666-6666-6666-6666-666666666614',
  '77777777-7777-7777-7777-777777777712',
  '77777777-7777-7777-7777-777777777713',
  '77777777-7777-7777-7777-777777777714',
  '88888888-8888-8888-8888-888888888812',
  '88888888-8888-8888-8888-888888888813',
  '88888888-8888-8888-8888-888888888814',
  '99999999-9999-9999-9999-999999999912',
  '99999999-9999-9999-9999-999999999913',
  '99999999-9999-9999-9999-999999999914',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa12',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa13',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa14',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb12',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb13',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb14',
  'cccccccc-cccc-cccc-cccc-cccccccccc12',
  'cccccccc-cccc-cccc-cccc-cccccccccc13',
  'cccccccc-cccc-cccc-cccc-cccccccccc14'
);
