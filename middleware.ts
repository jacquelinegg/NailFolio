import { NextResponse, type NextRequest } from "next/server";

import { detectLocale, isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:8081",
  "http://192.168.0.100:3000",
  "http://192.168.0.100:8081",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = (origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0])!;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-artist-secret",
    "Access-Control-Max-Age": "86400",
  };
}

export function middleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin");

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      }) as NextResponse;
    }

    const headers = corsHeaders(origin);
    Object.entries(headers).forEach(([key, value]) => { if (value) response.headers.set(key, value); });
  }

  const existing = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(existing) ? existing : detectLocale({
    get: (name) => request.headers.get(name),
  });

  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
