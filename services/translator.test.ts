import { beforeEach, describe, expect, it } from "vitest";

import {
  clearTranslationCache,
  translateTexts,
  translationCacheSize,
} from "@/services/translator";

function geminiEnvelope(text: string) {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

/** Records every call so batch size and cache hits can be asserted. */
function stubGemini(reply: (texts: string[]) => string[]) {
  const seen: string[][] = [];
  const impl = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as {
      contents: { parts: { text: string }[] }[];
    };
    const userText = body.contents[0]?.parts[0]?.text ?? "";
    const texts = JSON.parse(userText.slice(userText.lastIndexOf("\n\n") + 2)) as string[];
    seen.push(texts);
    return new Response(JSON.stringify(geminiEnvelope(JSON.stringify({ translations: reply(texts) }))), {
      status: 200,
    });
  }) as unknown as typeof fetch;
  return { impl, seen };
}

const OPTIONS = { provider: "gemini", apiKey: "test-key", model: "gemini-2.0-flash" } as const;

describe("translateTexts", () => {
  beforeEach(() => {
    clearTranslationCache();
  });

  it("skips the model when source and target match", async () => {
    const { impl, seen } = stubGemini(() => ["x"]);
    const result = await translateTexts(["Hello"], {
      target: "bg",
      source: "bg",
      fetchImpl: impl,
      ...OPTIONS,
    });

    expect(result.skipped).toBe(true);
    expect(result.translations).toEqual(["Hello"]);
    expect(seen).toHaveLength(0);
  });

  it("returns a translation per input, in order", async () => {
    const { impl } = stubGemini((texts) => texts.map((t) => `bg:${t}`));
    const result = await translateTexts(["One", "Two"], {
      target: "bg",
      fetchImpl: impl,
      ...OPTIONS,
    });

    expect(result.translations).toEqual(["bg:One", "bg:Two"]);
  });

  it("batches many strings into a single call", async () => {
    const { impl, seen } = stubGemini((texts) => texts);
    await translateTexts(["a", "b", "c", "d"], { target: "bg", fetchImpl: impl, ...OPTIONS });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual(["a", "b", "c", "d"]);
  });

  it("reuses memoised strings and only sends the misses", async () => {
    const { impl, seen } = stubGemini((texts) => texts.map((t) => `bg:${t}`));

    await translateTexts(["a", "b"], { target: "bg", fetchImpl: impl, ...OPTIONS });
    expect(translationCacheSize()).toBe(2);

    await translateTexts(["a", "c"], { target: "bg", fetchImpl: impl, ...OPTIONS });

    // Second call only carried the uncached string, but both come back translated.
    expect(seen).toHaveLength(2);
    expect(seen[1]).toEqual(["c"]);
  });

  it("serves a fully cached batch without any call", async () => {
    const { impl, seen } = stubGemini((texts) => texts.map((t) => `bg:${t}`));

    await translateTexts(["a", "b"], { target: "bg", fetchImpl: impl, ...OPTIONS });
    const second = await translateTexts(["a", "b"], { target: "bg", fetchImpl: impl, ...OPTIONS });

    expect(seen).toHaveLength(1);
    expect(second.translations).toEqual(["bg:a", "bg:b"]);
  });

  it("falls back to the original text when the model fails", async () => {
    const impl = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const result = await translateTexts(["Original"], {
      target: "bg",
      fetchImpl: impl,
      ...OPTIONS,
    });

    expect(result.translations).toEqual(["Original"]);
  });

  it("falls back per-item when the model returns a short or ragged array", async () => {
    const { impl } = stubGemini(() => ["only one"]);
    const result = await translateTexts(["a", "b"], { target: "bg", fetchImpl: impl, ...OPTIONS });

    expect(result.translations[0]).toBe("only one");
    // The missing second item degrades to the source rather than to undefined.
    expect(result.translations[1]).toBe("b");
  });

  it("preserves blank inputs positionally", async () => {
    const { impl, seen } = stubGemini((texts) => texts.map((t) => `bg:${t}`));
    const result = await translateTexts(["", "  ", "real"], {
      target: "bg",
      fetchImpl: impl,
      ...OPTIONS,
    });

    expect(result.translations[2]).toBe("bg:real");
    // Blank entries are never sent to the model.
    expect(seen[0]).toEqual(["real"]);
  });
});
