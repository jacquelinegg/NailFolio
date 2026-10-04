import { describe, expect, it, vi } from "vitest";

import { generateNailReferenceImage } from "@/services/nailReferenceImage";

const INPUT = {
  name: "Cherry Pearl",
  description: "A glossy sheer manicure with one fine cherry accent.",
  designPrompt: "tiny hand-painted cherries, pearl highlights, elegant negative space",
  variation: 3,
};

function geminiResponse(data: string) {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data } }] } }],
  }), { status: 200 });
}

describe("generateNailReferenceImage", () => {
  it("generates and uploads a photo reference with the configured Gemini image model", async () => {
    const fetchImpl = vi.fn(async () => geminiResponse(Buffer.from("fake-png").toString("base64")));
    const uploadImpl = vi.fn(async () => ({
      bucket: "portfolio-looks" as const,
      path: "generated/reference.png",
      publicUrl: "https://cdn.example/reference.png",
    }));

    const url = await generateNailReferenceImage(INPUT, {
      provider: "gemini",
      apiKey: "test-image-key",
      model: "gemini-image-test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      uploadImpl,
    });

    expect(url).toBe("https://cdn.example/reference.png");
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [endpoint, request] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(endpoint).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-image-test:generateContent");
    expect(new Headers(request.headers).get("x-goog-api-key")).toBe("test-image-key");
    expect(JSON.parse(String(request.body)).generationConfig.responseModalities).toEqual(["TEXT", "IMAGE"]);
    expect(uploadImpl).toHaveBeenCalledOnce();
    const uploadCall = uploadImpl.mock.calls[0] as unknown as [Blob, { bucket: string; path: string }];
    expect(uploadCall[1]).toMatchObject({
      bucket: "portfolio-looks",
      path: expect.stringMatching(/^generated\/nail-of-the-day\//),
    });
  });

  it("does not call a provider when image generation is in placeholder mode", async () => {
    const fetchImpl = vi.fn();
    const url = await generateNailReferenceImage(INPUT, {
      provider: "placeholder",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(url).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses the SVG/portfolio fallback when no image key is configured", async () => {
    const fetchImpl = vi.fn();
    const url = await generateNailReferenceImage(INPUT, {
      provider: "gemini",
      apiKey: "",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(url).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
