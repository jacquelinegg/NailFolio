/**
 * Typed, fail-fast environment access.
 *
 * Rules enforced here:
 * - `NEXT_PUBLIC_*` values are safe to read in client components (inlined at build time).
 * - Server-only secrets (YouCam key, service role key) are only read from non-public
 *   variables and are never imported from client code.
 */

export class MissingEnvError extends Error {
  readonly variable: string;

  constructor(variable: string) {
    super(`Missing environment variable: ${variable}. Copy .env.example to .env.local and fill it in.`);
    this.name = "MissingEnvError";
    this.variable = variable;
  }
}

type PublicEnvKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "NEXT_PUBLIC_DEFAULT_ARTIST_ID";

type LlmProvider = "gemini" | "openai";
type ImageProvider = LlmProvider | "local" | "placeholder";

function read(key: PublicEnvKey): string {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new MissingEnvError(key);
  }
  return value.trim();
}

function readOptional(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumber(key: string, fallback: number): number {
  const raw = readOptional(key);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${key} must be a positive integer, received "${raw}".`);
  }
  return parsed;
}

export const publicEnv = {
  get supabaseUrl(): string {
    return read("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey(): string {
    return read("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get defaultArtistId(): string | undefined {
    return readOptional("NEXT_PUBLIC_DEFAULT_ARTIST_ID");
  },
} as const;

export const serverEnv = {
  get supabaseUrl(): string {
    return read("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey(): string {
    return read("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceRoleKey(): string {
    const value = readOptional("SUPABASE_SERVICE_ROLE_KEY");
    if (!value) throw new MissingEnvError("SUPABASE_SERVICE_ROLE_KEY");
    return value;
  },
  get artistApiSecret(): string {
    const value = readOptional("ARTIST_API_SECRET");
    if (!value) throw new MissingEnvError("ARTIST_API_SECRET");
    return value;
  },
  get youcamApiKey(): string {
    const value = readOptional("YOUCAM_API_KEY");
    if (!value) throw new MissingEnvError("YOUCAM_API_KEY");
    return value;
  },
  get youcamApiBaseUrl(): string {
    return readOptional("YOUCAM_API_BASE_URL") ?? "https://s2s.ai.makeupar.com";
  },
  get youcamAiNailPath(): string {
    return readOptional("YOUCAM_AI_NAIL_PATH") ?? "/s2s/v2.0/task/ai-nail";
  },
  get youcamPollIntervalMs(): number {
    return readNumber("YOUCAM_POLL_INTERVAL_MS", 1_500);
  },
  get youcamPollTimeoutMs(): number {
    return readNumber("YOUCAM_POLL_TIMEOUT_MS", 30_000);
  },
  get appBaseUrl(): string {
    return (readOptional("APP_BASE_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
  },
  get aiProvider(): LlmProvider {
    const value = (readOptional("AI_PROVIDER") ?? "gemini").toLowerCase();
    if (value !== "gemini" && value !== "openai") {
      throw new Error(`AI_PROVIDER must be "gemini" or "openai", received "${value}".`);
    }
    return value;
  },
  get geminiApiKey(): string | undefined {
    return readOptional("GEMINI_API_KEY");
  },
  get openaiApiKey(): string | undefined {
    return readOptional("OPENAI_API_KEY");
  },
  get geminiModel(): string | undefined {
    return readOptional("GEMINI_MODEL");
  },
  get geminiImageModel(): string {
    return readOptional("GEMINI_IMAGE_MODEL") ?? "gemini-2.5-flash-image";
  },
  get openaiModel(): string | undefined {
    return readOptional("OPENAI_MODEL");
  },
  get openaiImageModel(): string {
    return readOptional("OPENAI_IMAGE_MODEL") ?? "gpt-image-1";
  },
  get aiTemperature(): number {
    const raw = readOptional("AI_TEMPERATURE");
    if (raw === undefined) return 0.9;
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) {
      throw new Error(`AI_TEMPERATURE must be a number, received "${raw}".`);
    }
    return parsed;
  },
  get imageProvider(): ImageProvider {
    const value = (readOptional("IMAGE_PROVIDER") ?? readOptional("AI_PROVIDER") ?? "gemini").toLowerCase();
    if (value === "pollinations") return "gemini";
    if (value === "local") return "placeholder";
    if (value !== "gemini" && value !== "openai" && value !== "placeholder") {
      throw new Error(`IMAGE_PROVIDER must be "gemini", "openai" or "placeholder", received "${value}".`);
    }
    return value;
  },
  get mockYouCam(): boolean {
    return readOptional("MOCK_YOUCAM") === "true";
  },
} as const;
