import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { middleware } from "@/middleware";
import { LOCALE_COOKIE } from "@/lib/i18n/config";

function run(headers: Record<string, string>, cookies?: string) {
  const request = new NextRequest(new URL("https://nailfolio.test/search"), {
    headers: { ...headers, ...(cookies ? { cookie: cookies } : {}) },
  });
  const response = middleware(request);
  return response.cookies.get(LOCALE_COOKIE)?.value;
}

describe("middleware locale cookie", () => {
  it("detects from the edge country header on a first visit", () => {
    expect(run({ "x-vercel-ip-country": "BG" })).toBe("bg");
  });

  it("falls back to Accept-Language in local development", () => {
    expect(run({ "accept-language": "bg-BG,bg;q=0.9" })).toBe("bg");
  });

  it("keeps an existing cookie instead of re-detecting", () => {
    // A visitor detected as Bulgarian whose next request carries no country
    // header — a VPN, a proxy or local dev must not flip them to English.
    expect(run({}, `${LOCALE_COOKIE}=bg`)).toBe("bg");
  });

  it("still lets a live detection beat a stale cookie when it disagrees", () => {
    expect(run({ "x-vercel-ip-country": "BG" }, `${LOCALE_COOKIE}=en`)).toBe("en");
  });

  it("replaces a corrupt cookie value", () => {
    expect(run({ "x-vercel-ip-country": "BG" }, `${LOCALE_COOKIE}=klingon`)).toBe("bg");
  });

  it("defaults to English with no signals at all", () => {
    expect(run({})).toBe("en");
  });
});
