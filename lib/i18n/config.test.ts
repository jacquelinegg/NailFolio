import { describe, expect, it } from "vitest";

import { detectLocale, isLocale, localeFromCountry, LOCALES } from "./config";

function headers(map: Record<string, string>) {
  return { get: (name: string) => map[name.toLowerCase()] ?? null };
}

describe("localeFromCountry", () => {
  it("maps Bulgaria to Bulgarian", () => {
    expect(localeFromCountry("BG")).toBe("bg");
  });

  it("is case and whitespace insensitive", () => {
    expect(localeFromCountry(" bg ")).toBe("bg");
  });

  it("falls back to English for every other country", () => {
    expect(localeFromCountry("DE")).toBe("en");
    expect(localeFromCountry("US")).toBe("en");
    expect(localeFromCountry("GB")).toBe("en");
  });

  it("falls back to English when the country is unknown", () => {
    expect(localeFromCountry(null)).toBe("en");
    expect(localeFromCountry(undefined)).toBe("en");
    expect(localeFromCountry("")).toBe("en");
  });
});

describe("detectLocale", () => {
  it("prefers the IP country header when Vercel supplies it", () => {
    const request = headers({ "x-vercel-ip-country": "BG", "accept-language": "en-US,en" });
    expect(detectLocale(request)).toBe("bg");
  });

  it("uses Accept-Language when no IP country is available (local dev)", () => {
    expect(detectLocale(headers({ "accept-language": "bg-BG,bg;q=0.9,en;q=0.8" }))).toBe("bg");
    expect(detectLocale(headers({ "accept-language": "en-US,en;q=0.9" }))).toBe("en");
  });

  it("respects quality weights over header order", () => {
    const request = headers({ "accept-language": "en;q=0.5,bg;q=0.9" });
    expect(detectLocale(request)).toBe("bg");
  });

  it("falls back to English for unsupported languages", () => {
    expect(detectLocale(headers({ "accept-language": "fr-FR,de;q=0.9" }))).toBe("en");
  });

  it("falls back to English when no signals are present", () => {
    expect(detectLocale(headers({}))).toBe("en");
  });
});

describe("isLocale", () => {
  it("accepts only supported locales", () => {
    for (const locale of LOCALES) expect(isLocale(locale)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isLocale("de")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
