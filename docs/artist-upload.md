# Portfolio image upload — mobile app guide

## Endpoint

```
POST /api/artist/looks
Header: x-artist-secret: <ARTIST_API_SECRET>
Content-Type: multipart/form-data
```

## Required fields

| Field | Type | Notes |
|-------|------|-------|
| `file` | File | JPEG/PNG/WEBP/HEIC, max 12MB |
| `artistId` | string | UUID of the artist |
| `tags` | string | JSON array, e.g. `["nude","chrome","minimal"]` |

## Optional fields

| Field | Type | Notes |
|-------|------|-------|
| `complexityLevel` | string | `low` / `medium` / `high` |
| `basePrice` | number | Overrides artist default for this look |

## Example (Expo / React Native)

```ts
const form = new FormData();
form.append('file', { uri, name: 'look.jpg', type: 'image/jpeg' } as any);
form.append('artistId', artistId);
form.append('tags', JSON.stringify(['nude', 'french', 'minimal']));
form.append('complexityLevel', 'low');
form.append('basePrice', '45');

const res = await fetch(`${API_URL}/api/artist/looks`, {
  method: 'POST',
  headers: { 'x-artist-secret': ARTIST_API_SECRET },
  body: form,
});
const { look } = await res.json();
```

## Response

```json
{
  "look": {
    "id": "uuid",
    "artist_id": "uuid",
    "image_url": "https://...",
    "tags": ["nude","french","minimal"],
    "base_price": 45.00,
    "complexity_level": "low",
    "created_at": "2026-09-29T..."
  }
}
```

## Storage

Images are stored in the `portfolio-looks` Supabase bucket under:
```
artists/<artistId>/<uuid>.jpg
```

The bucket is public, so `image_url` can be used directly in `<img>` tags.
