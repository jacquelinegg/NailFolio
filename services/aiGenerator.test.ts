import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getArtistById, listLooksForArtist } from "@/lib/supabase";
import { completeJson } from "@/services/llmClient";
import { generateNailReferenceImage } from "@/services/nailReferenceImage";
import { generateArtistAwareDesign } from "@/services/aiGenerator";

vi.mock("@/lib/supabase", () => ({
  getArtistById: vi.fn(),
  listLooksForArtist: vi.fn(),
}));
vi.mock("@/services/nailReferenceImage", () => ({
  generateNailReferenceImage: vi.fn(),
}));
vi.mock("@/services/llmClient", () => ({ completeJson: vi.fn() }));

const ARTIST = {
  id: "artist-1",
  auth_user_id: null,
  display_name: "Studio",
  handle: "studio",
  share_token: null,
  base_price: 40,
  technique_prices: {},
  duration_by_complexity: { low: 60, medium: 75, high: 105 },
  created_at: "2026-01-01T00:00:00.000Z",
};

const LOOK = {
  id: "look-1",
  artist_id: "artist-1",
  image_url: "https://cdn.example/artist-look.jpg",
  tags: ["chrome_pearl"],
  base_price: 40,
  complexity_level: "medium" as const,
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("generateArtistAwareDesign reference images", () => {
  beforeEach(() => {
    vi.stubEnv("IMAGE_PROVIDER", "gemini");
    vi.mocked(getArtistById).mockResolvedValue(ARTIST as never);
    vi.mocked(listLooksForArtist).mockResolvedValue([] as never);
    vi.mocked(generateNailReferenceImage).mockReset();
    vi.mocked(completeJson).mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("creates a photoreal reference for the surprise path", async () => {
    vi.mocked(generateNailReferenceImage).mockResolvedValue("https://cdn.example/generated-reference.png");

    const design = await generateArtistAwareDesign({ artistId: ARTIST.id });

    expect(design.refImageUrl).toBe("https://cdn.example/generated-reference.png");
    expect(generateNailReferenceImage).toHaveBeenCalledOnce();
    expect(generateNailReferenceImage).toHaveBeenCalledWith(expect.objectContaining({
      name: "Custom salon manicure",
      designPrompt: expect.stringContaining("manicure"),
    }));
  });

  it("falls back to an artist portfolio reference if image generation is unavailable", async () => {
    vi.mocked(generateNailReferenceImage).mockResolvedValue(null);
    vi.mocked(listLooksForArtist).mockResolvedValue([LOOK] as never);

    const design = await generateArtistAwareDesign({ artistId: ARTIST.id });

    expect(design.refImageUrl).toBe(LOOK.image_url);
  });
});
