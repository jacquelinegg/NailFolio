/**
 * Runtime configuration for the artist app.
 * In Expo, EXPO_PUBLIC_* / NEXT_PUBLIC_* style variables are inlined at build
 * time; put real values in apps/mobile/.env.
 */
import Constants from "expo-constants";
import { Platform } from "react-native";

const fromExpoConfig = Constants.expoConfig?.extra ?? {};

/** Port the Next.js dev server listens on. */
const WEB_PORT = 3000;

/**
 * The Android emulator runs behind its own NAT, where `localhost` is the emu
 * itself. `10.0.2.2` is the emulator's alias for the host machine's loopback.
 */
const ANDROID_EMULATOR_HOST = "10.0.2.2";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Metro tells the client which host it was served from. On a physical device
 * that is the developer machine's LAN address, which is exactly the host the
 * device can reach the web app on — `localhost` would point back at the phone.
 */
function metroHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri ?? null;
  if (!hostUri) return null;

  const host = hostUri.split(":")[0]?.trim();
  return host && host.length > 0 ? host : null;
}

function resolveDefaultApiBaseUrl(): string {
  const host = metroHost();

  if (host && !LOOPBACK_HOSTS.has(host)) {
    // Physical device on the same network as Metro.
    return `http://${host}:${WEB_PORT}`;
  }

  if (Platform.OS === "android") {
    // Metro said localhost, so this is the Android emulator.
    return `http://${ANDROID_EMULATOR_HOST}:${WEB_PORT}`;
  }

  // iOS simulator: localhost does reach the host machine.
  return `http://localhost:${WEB_PORT}`;
}

const DEFAULT_API_BASE_URL = resolveDefaultApiBaseUrl();

export const config = {
  /** e.g. https://your-project-ref.supabase.co */
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? (fromExpoConfig.supabaseUrl as string | undefined) ?? "",
  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? (fromExpoConfig.supabaseAnonKey as string | undefined) ?? "",
  /** The web app that serves the client funnel and the artist API. */
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? (fromExpoConfig.apiBaseUrl as string | undefined) ?? DEFAULT_API_BASE_URL,
  /** Matches ARTIST_API_SECRET on the server. */
  artistSecret: process.env.EXPO_PUBLIC_ARTIST_API_SECRET ?? (fromExpoConfig.artistSecret as string | undefined) ?? "",
  /** The signed-in artist. Auth lands after the MVP; hardcoded for the demo. */
  artistId: process.env.EXPO_PUBLIC_ARTIST_ID ?? (fromExpoConfig.artistId as string | undefined) ?? "",
} as const;

export function assertConfigured(): void {
  const missing = (Object.entries(config) as [keyof typeof config, string][])
    .filter(([, value]) => value.trim().length === 0)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing artist app configuration: ${missing.join(", ")}. See apps/mobile/.env.example.`);
  }
}

export function getApiUrl(path: string, params?: Record<string, string>): string {
  const base = config.apiBaseUrl.replace(/\/+$/, "");
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return `${base}${path}${query}`;
}
