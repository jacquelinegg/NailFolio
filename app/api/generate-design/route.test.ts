import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { completeJson } from "@/services/llmClient";
import { generateNailReferenceImage } from "@/services/nailReferenceImage";
import { POST } from "./route";

vi.mock("@/services/llmClient", () => ({ completeJson: vi.fn() }));
vi.mock("@/services/nailReferenceImage", () => ({ generateNailReferenceImage: vi.fn() }));

const generatedDesign = {
  name: "Ruby Orbit",
  description: "A ruby base with delicate chrome stars.",
  imagePrompt: "Single detached coffin-shaped nail in deep red chrome with tiny star and sparkle accents.",
  pattern: "stars",
  finish: "chrome",
  colors: ["#8B0000", "#C0C0C0"],
  complexity: "medium",
  motifs: [
    { kind: "flower", x: 50, y: 38, size: 11, color: "#C0C0C0", rotation: -8 },
    { kind: "leaf", x: 33, y: 54, size: 6, color: "#FFFFFF", rotation: 20 },
    { kind: "pearl", x: 500, y: 5, size: 25, color: "url(#external)", rotation: 90 },
    { kind: "star", x: 42, y: 76, size: 5, color: "#C0C0C0", rotation: 12 },
    { kind: "sparkle", x: 60, y: 81, size: 4, color: "#FFFFFF", rotation: -12 },
    { kind: "leaf", x: 56, y: 30, size: 5, color: "#C0C0C0", rotation: -18 },
  ],
};

function post(body: unknown) {
  return POST(new Request("http://localhost/api/generate-design", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

describe("POST /api/generate-design", () => {
  beforeEach(() => {
    vi.stubEnv("IMAGE_PROVIDER", "gemini");
    vi.mocked(completeJson).mockReset();
    vi.mocked(generateNailReferenceImage).mockReset().mockResolvedValue("https://cdn.example/reference.png");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("uses AI output and preserves the requested canonical shape", async () => {
    vi.mocked(completeJson).mockResolvedValue(generatedDesign);

    const response = await post({ shape: "coffin_ballerina", tags: ["chrome_pearl"], salt: 4 });
    const body = await response.json();

    expect(completeJson).toHaveBeenCalledOnce();
    expect(body.aiGenerated).toBe(true);
    expect(body.nailImageUrl).toBe("https://cdn.example/reference.png");
    expect(generateNailReferenceImage).toHaveBeenCalledWith(expect.objectContaining({ singleNail: true }));
    expect(body.referenceImageUrl).toBeUndefined();
    expect(body.design).toMatchObject({
      name: "Ruby Orbit",
      shape: "coffin_ballerina",
      colors: expect.arrayContaining(["#8B0000", "#C0C0C0"]),
      layers: expect.arrayContaining([expect.objectContaining({ type: "fill" })]),
    });
    expect(body.design.motifs).toHaveLength(5);
    expect(body.design.motifs[2]).toMatchObject({ x: 72, y: 24, size: 10, color: "#8B0000", rotation: 45, role: "support" });
    const prompt = vi.mocked(completeJson).mock.calls[0]?.[0]?.[0]?.content;
    expect(prompt).toContain("Return one JSON object with exactly these keys");
    expect(prompt).toContain("2D flat design");
  });

  it("returns a renderer-safe fallback when the model is unavailable", async () => {
    vi.mocked(completeJson).mockRejectedValue(new Error("not configured"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await post({ shape: "square", tags: ["floral"], salt: 7 });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.aiGenerated).toBe(false);
    expect(body.design).toMatchObject({ shape: "square" });
    expect(body.design.layers.length).toBeGreaterThan(0);
  });

  it("applies prompt replacements in fallback mode", async () => {
    vi.mocked(completeJson).mockRejectedValue(new Error("not configured"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await post({ shape: "square", tags: ["floral"], salt: 7 });
    const body = await response.json();

    expect(response.status).toBe(200);
    const pattern = body.design.pattern;
    const replaced = await post({ shape: "square", tags: ["floral"], customPrompt: `replace pattern ${pattern} with stars`, salt: 7 });
    const replacedBody = await replaced.json();
    expect(replacedBody.design.pattern).toBe("stars");
  });

  it("applies motif replacements in fallback mode", async () => {
    vi.mocked(completeJson).mockRejectedValue(new Error("not configured"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await post({ shape: "square", tags: ["floral"], customPrompt: "replace motif flower with star", salt: 7 });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.design.motifs.every((motif: { kind: string }) => motif.kind !== "flower")).toBe(true);
  });
});
