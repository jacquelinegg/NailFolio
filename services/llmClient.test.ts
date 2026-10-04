import { describe, expect, it } from "vitest";

import { completeJson, LlmError, parseJsonObject } from "@/services/llmClient";

const MESSAGES = [
  { role: "system" as const, content: "be terse" },
  { role: "user" as const, content: "return json" },
];

function geminiEnvelope(text: string) {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

describe("parseJsonObject", () => {
  it("unwraps markdown fences and surrounding prose", () => {
    expect(parseJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonObject('Sure! {"a":2} hope that helps')).toEqual({ a: 2 });
  });

  it("throws when there is no object", () => {
    expect(() => parseJsonObject("no json here")).toThrow(LlmError);
  });
});

describe("completeJson", () => {
  it("builds a Gemini request and extracts the text part", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const result = await completeJson<{ ok: boolean }>(MESSAGES, {
      provider: "gemini",
      apiKey: "g-key",
      model: "gemini-2.0-flash",
      temperature: 0.5,
      requireKeys: ["ok"],
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify(geminiEnvelope('{"ok":true}')), { status: 200 });
      }) as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: true });
    expect(calls[0]?.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent");
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("g-key");

    const body = JSON.parse(String(calls[0]?.init?.body));
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.temperature).toBe(0.5);
    expect(body.systemInstruction.parts[0].text).toBe("be terse");
  });

  it("builds an OpenAI request and extracts the choice", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const result = await completeJson<{ ok: boolean }>(MESSAGES, {
      provider: "openai",
      apiKey: "o-key",
      model: "gpt-4o-mini",
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":false}' } }] }), { status: 200 });
      }) as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: false });
    expect(calls[0]?.url).toBe("https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(String(calls[0]?.init?.body));
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages).toHaveLength(2);
  });

  it("rejects responses that miss required keys", async () => {
    const error = await completeJson(MESSAGES, {
      provider: "gemini",
      apiKey: "g-key",
      requireKeys: ["description", "tags"],
      fetchImpl: (async () =>
        new Response(JSON.stringify(geminiEnvelope('{"description":"d"}')), { status: 200 })) as unknown as typeof fetch,
    }).catch((e: unknown) => e);

    expect((error as LlmError).code).toBe("INVALID_RESPONSE");
  });

  it("maps provider HTTP errors", async () => {
    const error = await completeJson(MESSAGES, {
      provider: "openai",
      apiKey: "o-key",
      fetchImpl: (async () =>
        new Response(JSON.stringify({ error: { message: "quota exceeded" } }), {
          status: 429,
        })) as unknown as typeof fetch,
    }).catch((e: unknown) => e);

    expect((error as LlmError).code).toBe("HTTP");
    expect((error as LlmError).httpStatus).toBe(429);
    expect((error as LlmError).providerMessage).toBe("quota exceeded");
  });

  it("fails fast when no api key is configured", async () => {
    const error = await completeJson(MESSAGES, {
      provider: "openai",
      apiKey: "",
      fetchImpl: (async () => new Response("{}")) as unknown as typeof fetch,
    }).catch((e: unknown) => e);

    expect((error as LlmError).code).toBe("NOT_CONFIGURED");
  });
});
