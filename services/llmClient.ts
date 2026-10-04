/**
 * Minimal provider-agnostic LLM client (Google Gemini or OpenAI) with no SDK
 * dependency — both providers expose a plain JSON REST surface, and the
 * generator only needs one-shot structured completions.
 *
 * `completeJson` is exported so route handlers can reuse it, but it is injected
 * into the generator for testing rather than imported directly there.
 */

import { serverEnv } from "@/lib/env";

export type LlmProvider = "gemini" | "openai";
export type LlmRole = "system" | "user";

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

/** An image passed alongside the prompt, for vision-capable models. */
export interface LlmImage {
  /** Base64-encoded image bytes, without a data-URL prefix. */
  base64: string;
  mimeType: string;
}

export type LlmErrorCode =
  | "NOT_CONFIGURED"
  | "NETWORK"
  | "HTTP"
  | "PROVIDER"
  | "INVALID_RESPONSE"
  | "EMPTY_RESPONSE";

export class LlmError extends Error {
  readonly code: LlmErrorCode;
  readonly httpStatus?: number;
  readonly providerMessage?: string;
  readonly rawBody?: string;

  constructor(
    code: LlmErrorCode,
    message: string,
    options: { httpStatus?: number; providerMessage?: string; rawBody?: string; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "LlmError";
    this.code = code;
    this.httpStatus = options.httpStatus;
    this.providerMessage = options.providerMessage;
    this.rawBody = options.rawBody;
  }
}

export interface CompleteJsonOptions {
  provider?: LlmProvider;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  /** Names of the required top-level JSON keys, used for a cheap sanity check. */
  requireKeys?: string[];
  /** Images to attach to the user turn. Only Gemini supports these. */
  images?: LlmImage[];
}

const DEFAULT_MODELS: Record<LlmProvider, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
};

/** Strips markdown fences and returns the first JSON object in the text. */
export function parseJsonObject<T>(raw: string): T {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new LlmError("INVALID_RESPONSE", "LLM response contained no JSON object.");
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as T;
}

function resolveConfig(options: CompleteJsonOptions): {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
} {
  const provider = options.provider ?? serverEnv.aiProvider;
  const apiKey =
    options.apiKey ?? (provider === "gemini" ? serverEnv.geminiApiKey : serverEnv.openaiApiKey);

  if (!apiKey) {
    throw new LlmError(
      "NOT_CONFIGURED",
      `No API key configured for LLM provider "${provider}". Set ${
        provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"
      }.`,
    );
  }

  return {
    provider,
    apiKey,
    model: options.model ?? (provider === "gemini" ? serverEnv.geminiModel : serverEnv.openaiModel) ?? DEFAULT_MODELS[provider],
    temperature: options.temperature ?? serverEnv.aiTemperature,
    maxOutputTokens: options.maxOutputTokens ?? 600,
  };
}

function geminiRequest(
  config: ReturnType<typeof resolveConfig>,
  messages: LlmMessage[],
  images: LlmImage[] = [],
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;
  return {
    url,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n") }],
        },
        contents: [
          {
            role: "user",
            parts: [
              { text: messages.filter((m) => m.role === "user").map((m) => m.content).join("\n\n") },
              ...images.map((image) => ({
                inlineData: { mimeType: image.mimeType, data: image.base64 },
              })),
            ],
          },
        ],
        generationConfig: {
          temperature: config.temperature,
          maxOutputTokens: config.maxOutputTokens,
          responseMimeType: "application/json",
        },
      }),
    },
  };
}

function openAiRequest(config: ReturnType<typeof resolveConfig>, messages: LlmMessage[]) {
  return {
    url: "https://api.openai.com/v1/chat/completions",
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxOutputTokens,
        response_format: { type: "json_object" },
      }),
    },
  };
}

function extractText(provider: LlmProvider, payload: unknown): string {
  if (provider === "gemini") {
    const candidates = (payload as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates;
    const text = candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    return text;
  }

  const choices = (payload as { choices?: { message?: { content?: string } }[] })?.choices;
  return choices?.[0]?.message?.content ?? "";
}

/** Single-shot structured completion. Returns the parsed JSON object. */
export async function completeJson<T>(messages: LlmMessage[], options: CompleteJsonOptions = {}): Promise<T> {
  const config = resolveConfig(options);
  const request =
    config.provider === "gemini"
      ? geminiRequest(config, messages, options.images)
      : openAiRequest(config, messages);
  const fetchImpl = options.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(request.url, {
      ...request.init,
      signal: options.signal,
    });
  } catch (error) {
    throw new LlmError("NETWORK", `Network failure calling the ${config.provider} API.`, { cause: error });
  }

  const rawBody = await response.text();

  if (!response.ok) {
    let providerMessage = rawBody.slice(0, 300);
    try {
      const parsed = JSON.parse(rawBody) as { error?: { message?: string }; message?: string };
      providerMessage = parsed.error?.message ?? parsed.message ?? providerMessage;
    } catch {
      // Non-JSON error body: keep the raw slice.
    }
    throw new LlmError("HTTP", `LLM provider returned HTTP ${response.status}.`, {
      httpStatus: response.status,
      providerMessage,
      rawBody,
    });
  }

  let text: string;
  try {
    text = extractText(config.provider, JSON.parse(rawBody));
  } catch (error) {
    throw new LlmError("INVALID_RESPONSE", "Could not parse the LLM response envelope.", {
      rawBody,
      cause: error,
    });
  }

  if (text.trim().length === 0) {
    throw new LlmError("EMPTY_RESPONSE", "LLM returned an empty completion.", { rawBody });
  }

  const parsedJson = parseJsonObject<T>(text);

  const missing = (options.requireKeys ?? []).filter(
    (key) => !(key in (parsedJson as Record<string, unknown>)),
  );
  if (missing.length > 0) {
    throw new LlmError("INVALID_RESPONSE", `LLM response is missing required keys: ${missing.join(", ")}.`, {
      rawBody: text,
    });
  }

  return parsedJson;
}
