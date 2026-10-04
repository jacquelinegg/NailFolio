import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AITryOnStudio } from "@/components/client/AITryOnStudio";
import { renderWithLocale } from "@/test/renderWithLocale";
import type { ArtistAwareDesign, Look } from "@/lib/types";

const DESIGN: ArtistAwareDesign = {
  description: "A milky nude base with a chrome pearl micro-french.",
  prompt: "Soft milky nude base, chrome pearl micro-french smile line.",
  refImageUrl: "https://cdn/look-1.jpg",
  usedTags: ["nude", "chrome_pearl", "micro_french"],
  estimate: {
    lineItems: [
      { label: "Base Manicure", amount: 40, kind: "base" },
      { label: "Technique: Chrome Pearl", amount: 15, kind: "technique" },
      { label: "AI Complexity Factor", amount: 5, kind: "ai_complexity" },
    ],
    total: 60,
    durationMins: 85,
  },
  complexity: "medium",
  sourceLookId: null,
};

const LOOK: Look = {
  id: "look-1",
  artist_id: "artist-1",
  image_url: "https://cdn/look-1.jpg",
  tags: ["nude", "chrome_pearl"],
  base_price: 40,
  complexity_level: "medium",
  created_at: "2026-01-01T00:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const cta = () => screen.getByRole("button", { name: /surprise me in my artist's style/i });

function renderStudio(overrides: Partial<Parameters<typeof AITryOnStudio>[0]> = {}) {
  const onComplete = vi.fn();
  const props = { artistId: "artist-1", look: null, handPhotoUrl: "https://signed/hand.jpg", onComplete, ...overrides };
  renderWithLocale(<AITryOnStudio {...props} />);
  return { onComplete };
}

describe("AITryOnStudio", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the CTA disabled until a hand photo exists", () => {
    renderWithLocale(<AITryOnStudio artistId="artist-1" look={null} handPhotoUrl={null} onComplete={vi.fn()} />);
    expect(cta()).toBeDisabled();
    expect(screen.getByText(/add a hand photo first/i)).toBeInTheDocument();
  });

  it("designs, renders, and hands the result to the parent", async () => {
    const calls = stubFetch((url) =>
      url === "/api/surprise" ? jsonResponse({ design: DESIGN }) : jsonResponse({ url: "https://cdn/render.jpg" }),
    );
    const { onComplete } = renderStudio();

    fireEvent.click(cta());

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({
      design: DESIGN,
      renderedUrl: "https://cdn/render.jpg",
    }));

    expect(calls.map((call) => call.url)).toEqual(["/api/surprise", "/api/render"]);
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({
      handUrl: "https://signed/hand.jpg",
      refImageUrl: "https://cdn/look-1.jpg",
    });

    // `onComplete` fires in the same tick as the state updates, so React has not
    // necessarily committed the markup yet — wait for it rather than racing.
    await waitFor(() => {
      expect(screen.getByText(DESIGN.description)).toBeInTheDocument();
      expect(screen.getByText("Chrome Pearl")).toBeInTheDocument();
      expect(screen.getByAltText("AI try-on")).toHaveAttribute("src", "https://cdn/render.jpg");
      expect(screen.getByRole("slider")).toBeInTheDocument();
    });
  });

  /**
   * The whole point of the look rail: a chosen look has to reach the API, or the
   * design is generated from the artist's whole catalogue and the client's
   * selection is quietly discarded.
   */
  it("sends the chosen look so the design is generated from it", async () => {
    const calls = stubFetch((url) =>
      url === "/api/surprise" ? jsonResponse({ design: DESIGN }) : jsonResponse({ url: "https://cdn/render.jpg" }),
    );
    renderStudio({ look: LOOK });

    fireEvent.click(screen.getByRole("button", { name: /try this look on my hands/i }));

    await waitFor(() => expect(calls[0]?.url).toBe("/api/surprise"));
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ artistId: "artist-1", lookId: "look-1" });
  });

  it("sends no look on the surprise path", async () => {
    const calls = stubFetch((url) =>
      url === "/api/surprise" ? jsonResponse({ design: DESIGN }) : jsonResponse({ url: "https://cdn/render.jpg" }),
    );
    renderStudio();

    fireEvent.click(cta());

    await waitFor(() => expect(calls[0]?.url).toBe("/api/surprise"));
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ artistId: "artist-1", lookId: null });
  });

  it("keeps the design when the render fails and offers a retry", async () => {
    let renderCalls = 0;
    stubFetch((url) => {
      if (url === "/api/surprise") return jsonResponse({ design: DESIGN });
      renderCalls += 1;
      return renderCalls === 1
        ? jsonResponse({ error: { message: "The render service is unavailable right now." } }, 502)
        : jsonResponse({ url: "https://cdn/render.jpg" });
    });

    const { onComplete } = renderStudio();
    fireEvent.click(cta());

    expect(await screen.findByRole("alert")).toHaveTextContent("The render service is unavailable right now.");
    expect(screen.getByText(DESIGN.description)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it("shows the failure and stays retryable when design synthesis fails", async () => {
    stubFetch(() => jsonResponse({ error: { message: "This artist has no portfolio looks yet." } }, 409));

    renderStudio();
    fireEvent.click(cta());

    expect(await screen.findByRole("alert")).toHaveTextContent("This artist has no portfolio looks yet.");
    expect(cta()).not.toBeDisabled();
  });

  it("moves the comparison slider", async () => {
    stubFetch((url) =>
      url === "/api/surprise" ? jsonResponse({ design: DESIGN }) : jsonResponse({ url: "https://cdn/render.jpg" }),
    );

    renderStudio();
    fireEvent.click(cta());

    const slider = (await screen.findByRole("slider")) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "25" } });
    expect(slider.value).toBe("25");
  });
});
