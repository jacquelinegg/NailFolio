import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LookScroller } from "@/components/client/LookScroller";
import { renderWithLocale } from "@/test/renderWithLocale";
import type { Look } from "@/lib/types";

function makeLook(overrides: Partial<Look> & Pick<Look, "id" | "tags">): Look {
  return {
    artist_id: "artist-1",
    image_url: `https://cdn/${overrides.id}.jpg`,
    base_price: 40,
    complexity_level: "medium",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const LOOKS: Look[] = [
  makeLook({ id: "l1", tags: ["nude", "chrome_pearl"] }),
  makeLook({ id: "l2", tags: ["nude", "chrome_pearl"] }),
  makeLook({ id: "l3", tags: ["black", "floral"] }),
  makeLook({ id: "l4", tags: ["red", "marble"] }),
];

function renderScroller(overrides: Partial<Parameters<typeof LookScroller>[0]> = {}) {
  const onSelect = vi.fn();
  const props = { looks: LOOKS, selectedLookId: null, onSelect, ...overrides };
  renderWithLocale(<LookScroller {...props} />);
  return { onSelect };
}

const card = (id: string) => document.querySelector<HTMLElement>(`[data-look-id="${id}"] button`)!;

describe("LookScroller", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens on the surprise option, since nothing is chosen yet", () => {
    renderScroller({ selectedLookId: null });
    expect(screen.getByRole("button", { name: /surprise me/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("marks the chosen look and leaves the surprise option unpressed", () => {
    renderScroller({ selectedLookId: "l3" });
    expect(card("l3")).toHaveAttribute("aria-pressed", "true");
    expect(card("l1")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /surprise me/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the tapped look so the design can be anchored to it", () => {
    const { onSelect } = renderScroller();
    fireEvent.click(card("l2"));
    expect(onSelect).toHaveBeenCalledWith("l2");
  });

  it("reports null when the client goes back to the surprise", () => {
    const { onSelect } = renderScroller({ selectedLookId: "l2" });
    fireEvent.click(screen.getByRole("button", { name: /surprise me/i }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("shows every look in the portfolio, with its price", () => {
    renderScroller();
    for (const look of LOOKS) {
      const button = card(look.id);
      expect(within(button).getByText(`from ${look.base_price} lev`)).toBeInTheDocument();
    }
  });

  /**
   * The rail is the only place two artists become visibly different, so a
   * portfolio has to render its whole range rather than a representative slice.
   */
  it("does not cap the number of looks a client can choose from", () => {
    renderScroller({
      looks: Array.from({ length: 30 }, (_, index) =>
        makeLook({ id: `many-${index}`, tags: ["nude", "chrome_pearl"] }),
      ),
    });
    for (let index = 0; index < 30; index += 1) {
      expect(card(`many-${index}`)).toBeInTheDocument();
    }
  });

  it("filters to the looks carrying a tag and toggles back off", () => {
    renderScroller();
    const chip = screen.getByRole("button", { name: "Chrome Pearl" });

    fireEvent.click(chip);
    expect(card("l1")).toBeInTheDocument();
    expect(card("l2")).toBeInTheDocument();
    // The black/floral and red/marble looks drop out of the rail. Their chips
    // stay, so the client can switch straight across rather than reset first.
    expect(card("l3")).not.toBeInTheDocument();
    expect(card("l4")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Floral" })).toBeInTheDocument();

    fireEvent.click(chip);
    expect(card("l3")).toBeInTheDocument();
    expect(card("l4")).toBeInTheDocument();
  });

  it("explains an empty portfolio instead of showing a bare rail", () => {
    renderScroller({ looks: [] });
    expect(screen.getByText(/has not published any looks yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /surprise me/i })).not.toBeInTheDocument();
  });
});
