import { describe, expect, it } from "vitest";

import bg from "@/locales/bg.json";
import en from "@/locales/en.json";

/** Recursively collects the dotted path of every leaf string in a catalogue. */
function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, child]) =>
      leafPaths(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

describe("translation catalogues", () => {
  it("exposes exactly the same keys in both languages", () => {
    expect(leafPaths(bg).sort()).toEqual(leafPaths(en).sort());
  });

  it("has no empty strings", () => {
    const empties = [...leafPaths(en), ...leafPaths(bg)].filter((path) => {
      const read = (catalogue: unknown): string | undefined => {
        for (const part of path.split(".")) {
          catalogue = (catalogue as Record<string, unknown>)[part];
        }
        return typeof catalogue === "string" ? catalogue : undefined;
      };
      return read(en)?.trim() === "" || read(bg)?.trim() === "";
    });

    expect(empties).toEqual([]);
  });
});
