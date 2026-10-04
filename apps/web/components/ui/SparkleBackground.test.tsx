import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SparkleBackground from "./SparkleBackground";

afterEach(cleanup);

function sparkles(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('div[aria-hidden="true"]'));
}

describe("SparkleBackground", () => {
  it("renders the requested number of sparkles", () => {
    const { container } = render(<SparkleBackground count={10} />);
    expect(sparkles(container)).toHaveLength(10);
  });

  it("defaults to twelve sparkles", () => {
    const { container } = render(<SparkleBackground />);
    expect(sparkles(container)).toHaveLength(12);
  });

  it("draws each sparkle as a four-point CSS shape", () => {
    const { container } = render(<SparkleBackground count={3} />);

    for (const node of sparkles(container)) {
      const clip = node.style.clipPath;
      expect(clip).toContain("polygon");
      // Eight vertices: four long rays on the axes, four concave corners.
      expect(clip.split(",").length - 1).toBe(7);
    }
  });

  it("sizes sparkles between 12px and 23px", () => {
    const { container } = render(<SparkleBackground count={24} />);

    for (const node of sparkles(container)) {
      const size = Number.parseFloat(node.style.width);
      expect(size).toBeGreaterThanOrEqual(12);
      expect(size).toBeLessThanOrEqual(23);
      expect(node.style.height).toBe(node.style.width);
    }
  });

  it("keeps positions inside the 5% - 95% band", () => {
    const { container } = render(<SparkleBackground count={24} />);

    for (const node of sparkles(container)) {
      const top = Number.parseFloat(node.style.top);
      const left = Number.parseFloat(node.style.left);
      expect(top).toBeGreaterThanOrEqual(5);
      expect(top).toBeLessThanOrEqual(95);
      expect(left).toBeGreaterThanOrEqual(5);
      expect(left).toBeLessThanOrEqual(95);
    }
  });

  it("respects the 0.3 - 0.8 opacity band", () => {
    const { container } = render(<SparkleBackground count={24} />);

    for (const node of sparkles(container)) {
      const opacity = Number(node.style.opacity);
      expect(opacity).toBeGreaterThanOrEqual(0.3);
      expect(opacity).toBeLessThanOrEqual(0.8);
    }
  });

  it("staggers every sparkle with its own duration and delay", () => {
    // Timings are unique by construction rather than by luck, so this holds for
    // any count — no seed stubbing needed to dodge a birthday collision.
    const { container } = render(<SparkleBackground count={48} />);
    const timings = sparkles(container).map(
      (n) => `${n.style.animationDuration}/${n.style.animationDelay}`,
    );

    expect(timings).toHaveLength(48);
    expect(new Set(timings).size).toBe(48);
    for (const node of sparkles(container)) {
      // CSSOM drops a trailing zero, so "3.0s" comes back as "3s".
      expect(node.style.animationDuration).toMatch(/^\d+(\.\d+)?s$/);
      expect(node.style.animationDelay).toMatch(/^\d+(\.\d+)?s$/);
    }
  });

  it("never consumes unseeded randomness while rendering", () => {
    // The regression this guards. `Math.random()` in the render path made the
    // server HTML disagree with the client on every sparkle, so React discarded
    // the whole layer during hydration. Positions now come from a PRNG seeded by
    // `useId`, which React keeps stable across the server render and the
    // hydrated pass — so any unseeded call is a bug.
    //
    // A real hydration pass cannot be simulated here: an independent server
    // render and a separate client root legitimately receive different `useId`
    // values, so comparing their markup would prove nothing. Pinning the
    // absence of `Math.random` is what actually holds the fix in place.
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("SparkleBackground must not call Math.random() while rendering");
    });

    try {
      const { container } = render(<SparkleBackground count={24} />);
      const nodes = sparkles(container);

      expect(nodes).toHaveLength(24);
      for (const node of nodes) {
        expect(node.style.top).toMatch(/%$/);
        expect(node.style.left).toMatch(/%$/);
        expect(node.style.animationDuration).not.toBe("");
      }
    } finally {
      random.mockRestore();
    }
  });

  it("renders children above the sparkle layer", () => {
    const { container } = render(
      <SparkleBackground count={3}>
        <p>Съдържание</p>
      </SparkleBackground>,
    );

    const content = screen.getByText("Съдържание").parentElement as HTMLElement;
    expect(sparkles(container)[0]?.className).toContain("z-0");
    expect(content.className).toContain("z-10");
  });

  it("merges the caller className onto the relative wrapper", () => {
    const { container } = render(<SparkleBackground className="wrap" />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain("wrap");
    expect(root.className).toContain("relative");
    // Must stay overflow-free: an overflow-hidden ancestor would become the
    // scroll container for the sticky site header and break it.
    expect(root.className).not.toContain("overflow-hidden");
  });

  it("anchors sparkles to the viewport when fixed", () => {
    const { container } = render(<SparkleBackground count={5} fixed />);
    const nodes = sparkles(container);

    expect(nodes).toHaveLength(5);
    for (const node of nodes) {
      expect(node.className).toContain("fixed");
      // `absolute` and `fixed` both set position, so exactly one may apply.
      expect(node.className).not.toContain("absolute");
    }
  });

  it("keeps sparkles inside their container by default", () => {
    const { container } = render(<SparkleBackground count={5} />);
    for (const node of sparkles(container)) {
      expect(node.className).toContain("absolute");
      expect(node.className).not.toContain("fixed");
    }
  });

  it("clamps a negative count to zero", () => {
    const { container } = render(<SparkleBackground count={-5} />);
    expect(sparkles(container)).toHaveLength(0);
  });

  it("scatters sparkles toward the edges instead of the centre", () => {
    // The content column sits in the middle of every page, so a uniform field
    // hides most of its stars behind text. A uniform draw would put about a
    // third of them outside the middle third; the bias has to move that well
    // past half for the edges to read as the lit part of the composition.
    const { container } = render(<SparkleBackground count={48} />);

    const outer = sparkles(container).filter((node) => {
      const left = Number.parseFloat(node.style.left);
      return left < 33.4 || left > 66.6;
    });

    expect(outer.length / 48).toBeGreaterThan(0.6);
  });

  it("reaches into both outer margins", () => {
    const { container } = render(<SparkleBackground count={48} />);
    const left = sparkles(container).map((node) => Number.parseFloat(node.style.left));
    const top = sparkles(container).map((node) => Number.parseFloat(node.style.top));

    // Within 8% of the 5% inset, so the field is not merely spread but present.
    expect(left.some((value) => value <= 13)).toBe(true);
    expect(left.some((value) => value >= 87)).toBe(true);
    expect(top.some((value) => value <= 13)).toBe(true);
    expect(top.some((value) => value >= 87)).toBe(true);
  });

  it("drives the pulse from a per-sparkle peak", () => {
    // `animate-pulse` is deliberately gone: its keyframes hardcode the opacity
    // range, so it would flatten the varied depth the field depends on.
    const { container } = render(<SparkleBackground count={24} />);

    for (const node of sparkles(container)) {
      expect(node.className).toContain("nf-sparkle");
      expect(node.className).not.toContain("animate-pulse");
      expect(node.style.getPropertyValue("--nf-sparkle-peak")).toBe(node.style.opacity);
    }
  });

  it("keeps the peaks varied so the field has depth", () => {
    const { container } = render(<SparkleBackground count={48} />);
    const peaks = new Set(
      sparkles(container).map((node) => node.style.getPropertyValue("--nf-sparkle-peak")),
    );

    expect(peaks.size).toBeGreaterThan(1);
  });
});
