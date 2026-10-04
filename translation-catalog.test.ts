import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import bg from "./locales/bg.json";
import en from "./locales/en.json";
import { tagLabel } from "./lib/tags";

/**
 * Guards the translation catalogues and the server-rendered pages against the
 * failure the design-of-the-day card had: its description and price line were
 * written as a hardcoded Bulgarian constant, so an English visitor saw
 * Bulgarian text. Nothing about the switcher, the middleware or the catalogues
 * was broken — the string simply bypassed `t` entirely, so no key diff or
 * locale test could see it.
 */
const CYLILLIC = /\p{Script=Cyrillic}/u;

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function leaves(value: unknown, prefix = ""): [string, string][] {
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leaves(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("translation catalogues", () => {
  const enLeaves = new Map(leaves(en));
  const bgLeaves = new Map(leaves(bg));

  it("has the same keys in both languages", () => {
    expect([...enLeaves.keys()].sort()).toEqual([...bgLeaves.keys()].sort());
  });

  it("has no blank entries", () => {
    for (const [key, value] of enLeaves) {
      expect(value.trim(), `en.${key} is blank`).not.toBe("");
    }
  });

  it("keeps Bulgarian out of the English catalogue", () => {
    // Brand and product names are legitimately identical, so this only flags
    // real sentences rather than single words.
    const offenders = [...enLeaves].filter(
      ([, value]) => CYLILLIC.test(value) && value.trim().length > 3,
    );

    expect(offenders).toEqual([]);
  });

  it("keeps the design-of-the-day card in the catalogue, not in a constant", () => {
    // The exact strings that were hardcoded in `app/page.tsx`.
    expect(bg.home.featureDescription).toContain("перлен");
    expect(en.home.featureDescription).toMatch(/pearl/i);
    expect(bg.home.featureMeta).toContain("мин");
    expect(en.home.featureMeta).toContain("min");
    expect(en.home.featureMeta).not.toContain(CYLILLIC);
  });
});

describe("server-rendered pages", () => {
  it("renders no user-facing Bulgarian literal in app code", () => {
    // `мин`, `лв` and friends belong in the catalogue so they can be swapped.
    // The Cyrillic test names and comments are stripped first.
    const pages = [
      "app/page.tsx",
      "app/artists/page.tsx",
      "app/book/page.tsx",
      "app/search/page.tsx",
      "app/nail-of-the-day/page.tsx",
    ];

    for (const page of pages) {
      const code = source(page)
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/.*$/gm, " ");

      expect(code, `${page} hardcodes Bulgarian`).not.toMatch(/["'`]\s*[^"'`]*\p{Script=Cyrillic}/u);
    }
  });

  it("still formats a look's raw tags for display", () => {
    // `look.tags` holds slugs like `chrome_pearl`; joining them raw leaked the
    // slug into the headline.
    expect(tagLabel("chrome_pearl")).toBe("Chrome Pearl");
    expect(["chrome_pearl", "glazed"].map((tag) => tagLabel(tag)).join(" · ")).toBe(
      "Chrome Pearl · Glazed",
    );
  });
});
