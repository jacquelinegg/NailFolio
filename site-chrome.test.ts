import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the transparent-chrome work.
 *
 * The regression these rules prevent is not visible in a unit test: the
 * sparkle field is painted behind the content, so a panel that stops covering
 * it, or a header that can no longer shrink on a phone, is only ever noticed by
 * looking at the page. Asserting the stylesheet and the layout shape keeps both
 * facts from quietly regressing.
 */
function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

const css = read("app/globals.css");
const layout = read("app/layout.tsx");
const header = read("components/site/WebHeader.tsx");
const home = read("app/page.tsx");

function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} rule is missing`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("site chrome", () => {
  it("draws the site header transparent over the sparkle field", () => {
    const declaration = rule(".site-header");

    expect(declaration).toMatch(/position:\s*sticky/);
    // Translucent, not opaque: an opaque bar would hide the sparkles behind it.
    const background = declaration.match(/background:\s*rgba\([^)]*\)/)?.[0] ?? "";
    const alpha = Number(background.match(/,\s*([\d.]+)\s*\)/)?.[1] ?? "1");
    expect(alpha).toBeLessThan(0.8);
  });

  it("lets the navigation shrink so it can scroll on a phone", () => {
    const declaration = rule(".site-nav");

    // Without min-width: 0 a flex item refuses to shrink below its min-content
    // width, overflow-x never engages, and the header overflows the viewport.
    expect(declaration).toMatch(/min-width:\s*0/);
    expect(declaration).toMatch(/overflow-x:\s*auto/);
  });

  it("keeps the sparkle field unclipped so the header can stick", () => {
    // An overflow-hidden ancestor becomes the scroll container for any sticky
    // descendant, which silently stops the header sticking.
    expect(header).not.toMatch(/overflow-hidden/);
  });

  it("mounts the ambient layers once, in the layout", () => {
    expect(layout).toContain('className="aura"');
    expect(layout).toContain("<WebHeader />");
    // The home page used to carry its own duplicate nav and glow layer.
    expect(home).not.toContain("site-header");
    expect(home).not.toContain('className="aura"');
  });

  it("no longer ships the full-page frosted panel", () => {
    // It carried backdrop-filter: blur(22px), which sat exactly over the
    // sparkles and made them invisible on every route that used it.
    expect(css).not.toContain(".web {");
    expect(css).not.toContain("blur(22px)");
  });
});
