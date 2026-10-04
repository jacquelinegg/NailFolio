import { describe, expect, it } from "vitest";

import { analyseStyleImage, rankArtistsByStyle } from "@/services/styleMatcher";

function geminiEnvelope(text: string) {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

function stubGemini(payload: unknown) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    calls.push({ url, body });
    return new Response(JSON.stringify(geminiEnvelope(JSON.stringify(payload))), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const OPTIONS = { provider: "gemini", apiKey: "test-key", model: "gemini-2.0-flash" } as const;
const IMAGE = { base64: "aGVsbG8=", mimeType: "image/jpeg" };

describe("analyseStyleImage", () => {
  it("keeps only tags from the shared vocabulary", async () => {
    const { impl } = stubGemini({
      base: ["nude", "sparkly unicorn dust"],
      technique: ["chrome_pearl", "3d_rhinestones", "glazed"],
      summary: "A glossy nude with a chrome finish.",
    });

    const result = await analyseStyleImage({ image: IMAGE, fetchImpl: impl, ...OPTIONS });

    // "sparkly unicorn dust" and "3d_rhinestones" are not real tags and must go.
    expect(result.baseTags).toEqual(["nude"]);
    expect(result.techniqueTags).toEqual(["chrome_pearl", "glazed"]);
  });

  it("caps base at 2 and technique at 4", async () => {
    const { impl } = stubGemini({
      base: ["nude", "black", "red", "pastel"],
      technique: ["french", "ombre", "marble", "foil", "aurora", "glazed"],
      summary: "Busy.",
    });

    const result = await analyseStyleImage({ image: IMAGE, fetchImpl: impl, ...OPTIONS });
    expect(result.baseTags).toHaveLength(2);
    expect(result.techniqueTags).toHaveLength(4);
  });

  it("sends the image as inline data", async () => {
    const { impl, calls } = stubGemini({ base: [], technique: [], summary: "None." });
    await analyseStyleImage({ image: IMAGE, fetchImpl: impl, ...OPTIONS });

    const parts = (calls[0]?.body.contents as { parts: { inlineData?: unknown }[] }[])[0]?.parts;
    expect(parts?.some((part) => part.inlineData !== undefined)).toBe(true);
  });

  it("returns an empty analysis when the model finds nothing", async () => {
    const { impl } = stubGemini({ base: [], technique: [], summary: "No nails visible." });
    const result = await analyseStyleImage({ image: IMAGE, fetchImpl: impl, ...OPTIONS });

    expect(result.baseTags).toEqual([]);
    expect(result.techniqueTags).toEqual([]);
  });

  it("propagates a provider failure", async () => {
    const impl = (async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;

    await expect(analyseStyleImage({ image: IMAGE, fetchImpl: impl, ...OPTIONS })).rejects.toThrow();
  });
});

describe("rankArtistsByStyle", () => {
  const analysis = {
    baseTags: ["nude"],
    techniqueTags: ["chrome_pearl", "3d_gem"],
    summary: "",
  };

  it("weights a technique match above a base match", () => {
    const matches = rankArtistsByStyle(analysis, [
      { id: "b", tags: ["nude"] },
      { id: "a", tags: ["chrome_pearl"] },
    ]);

    // Weighted total is 5 (nude 1 + chrome_pearl 2 + 3d_gem 2).
    expect(matches[0]?.artistId).toBe("a");
    expect(matches[0]?.score).toBe(40); // technique match: 2/5
    expect(matches[1]?.score).toBe(20); // base match: 1/5
  });

  it("ranks the fuller match first", () => {
    const matches = rankArtistsByStyle(analysis, [
      { id: "partial", tags: ["nude", "french"] },
      { id: "full", tags: ["nude", "chrome_pearl", "3d_gem"] },
    ]);

    expect(matches[0]?.artistId).toBe("full");
    expect(matches[0]?.score).toBe(100);
  });

  it("returns nothing when the analysis found no tags", () => {
    const empty = { baseTags: [], techniqueTags: [], summary: "" };
    expect(rankArtistsByStyle(empty, [{ id: "a", tags: ["nude"] }])).toEqual([]);
  });

  it("excludes artists with no overlap", () => {
    const matches = rankArtistsByStyle(analysis, [
      { id: "unrelated", tags: ["french", "black"] },
      { id: "match", tags: ["nude"] },
    ]);

    expect(matches.map((m) => m.artistId)).toEqual(["match"]);
  });

  it("normalises stored tags before comparing", () => {
    // "Chrome Pearl" and "NUDE" normalise onto two of the three wanted tags, so
    // the artist matches 3 of 5 weighted points.
    const matches = rankArtistsByStyle(analysis, [{ id: "a", tags: ["Chrome Pearl", "NUDE"] }]);
    expect(matches[0]?.score).toBe(60);
    expect(matches[0]?.matchedTags.sort()).toEqual(["chrome_pearl", "nude"]);
  });
});
