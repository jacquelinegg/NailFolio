import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CheckoutSummary } from "@/components/client/CheckoutSummary";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import type { ArtistAwareDesign } from "@/lib/types";

const DESIGN: ArtistAwareDesign = {
  description: "Chrome pearl over milky white.",
  prompt: "Chrome pearl micro-french.",
  refImageUrl: "https://cdn/look-1.jpg",
  usedTags: ["milky_white", "chrome_pearl"],
  estimate: {
    lineItems: [
      { label: "Base Manicure", amount: 40, kind: "base" },
      { label: "Technique: Chrome Pearl", amount: 15, kind: "technique" },
      { label: "AI Complexity Factor", amount: 5, kind: "ai_complexity" },
    ],
    total: 60,
    durationMins: 75,
  },
  complexity: "low",
  sourceLookId: "3f6c1d2e-7a89-4b12-9c34-5d6e7f801234",
};

function renderCheckout(overrides: Partial<Parameters<typeof CheckoutSummary>[0]> = {}) {
  const onBooked = vi.fn();
  const props = {
    artistId: "artist-1",
    design: DESIGN,
    handPhotoUrl: "https://signed/hand.jpg",
    renderedUrl: "https://cdn/render.jpg",
    onBooked,
    ...overrides,
  };
  // English by default, so the catalogue copy and the AI-authored line-item
  // labels stay in the language the assertions are written in.
  render(
    <LocaleProvider initialLocale="en">
      <CheckoutSummary {...props} />
    </LocaleProvider>,
  );
  return { onBooked };
}

function fillContactDetails() {
  fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: "Alex Rivera" } });
  fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "+1 555 010 2024" } });
}

function stubFetch(handler: () => Response) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return handler();
    }),
  );
  return calls;
}

const submit = () => screen.getByRole("button", { name: /submit booking request/i });

/**
 * The offered slots depend on the wall clock — the first day is today, and the
 * afternoon slots drop away as they pass. Tests address them by position rather
 * than by a fixed "2pm" so they hold at any hour of any day.
 */
function slotButtons(): HTMLElement[] {
  return screen.getAllByRole("button", { pressed: undefined }).filter((node) =>
    /^\d{1,2}(am|pm)$/.test(node.textContent?.trim() ?? ""),
  );
}

/** Day picker buttons. The weekday and the date sit in adjacent spans, so the
 * concatenated text runs together as "Wed30" with no space. */
function dayButtons(): HTMLElement[] {
  return screen.getAllByRole("button", { pressed: undefined }).filter((node) =>
    /^(sun|mon|tue|wed|thu|fri|sat)\s*\d{1,2}$/i.test(node.textContent?.replace(/\s+/g, "") ?? ""),
  );
}

/**
 * Select the second offered day.
 *
 * The first day is today, and its slots disappear as the afternoon passes, so a
 * test that books on it fails once the run starts later than an hour before
 * closing. Tomorrow offers the full grid whatever the wall clock says, which
 * keeps these tests about the booking, not about the hour they happen to run in.
 */
function pickFutureDay() {
  const days = dayButtons();
  fireEvent.click(days[1]!);
  return days[1]!;
}

describe("CheckoutSummary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("itemises every price layer with total and duration", () => {
    renderCheckout();

    expect(screen.getByText("Base Manicure")).toBeInTheDocument();
    expect(screen.getByText("Technique: Chrome Pearl")).toBeInTheDocument();
    expect(screen.getByText("AI Complexity Factor")).toBeInTheDocument();
    expect(screen.getAllByText("$60.00").length).toBeGreaterThan(0);
    expect(screen.getByText(/estimated duration: 1 hr 15 mins/i)).toBeInTheDocument();
  });

  it("prompts for a design before allowing a booking", () => {
    renderCheckout({ design: null });
    expect(submit()).toBeDisabled();
    expect(screen.getByText(/generate a design to see the price breakdown/i)).toBeInTheDocument();
  });

  it("dispatches the booking and forwards the new token", async () => {
    const calls = stubFetch(() => new Response(JSON.stringify({ token: "tok_123", status: "pending" }), { status: 201 }));
    const { onBooked } = renderCheckout();

    fillContactDetails();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "alex@example.com" } });
    pickFutureDay();
    // Pick the latest offered slot rather than a fixed one, so the test does not
    // care what time of day it is.
    const slots = slotButtons();
    fireEvent.click(slots[slots.length - 1]!);
    fireEvent.click(submit());

    await waitFor(() => expect(onBooked).toHaveBeenCalledWith("tok_123"));

    expect(calls[0]?.url).toBe("/api/sessions");
    const payload = JSON.parse(String(calls[0]?.init?.body));
    expect(payload).toMatchObject({
      artistId: "artist-1",
      clientHandImageUrl: "https://signed/hand.jpg",
      renderedResultUrl: "https://cdn/render.jpg",
      generatedPrompt: DESIGN.prompt,
      usedTags: ["milky_white", "chrome_pearl"],
      // The artist opens this booking expecting to see which look was asked for.
      // The column has existed since the first migration, but nothing ever
      // populated it, so the artist could only read the generated prompt.
      selectedLookId: DESIGN.sourceLookId,
      complexity: "low",
      clientName: "Alex Rivera",
      clientPhone: "+1 555 010 2024",
      clientEmail: "alex@example.com",
    });
    expect(payload.priceEstimate.total).toBe(60);
    // Every offered slot clears the lead time, so the API cannot reject it.
    expect(new Date(payload.requestedAppointmentTime).getTime()).toBeGreaterThan(Date.now());
  });

  it("keeps the client on the page when the server rejects the booking", async () => {
    stubFetch(() => new Response(JSON.stringify({ error: { message: "Appointment time must be in the future." } }), { status: 400 }));
    const { onBooked } = renderCheckout();

    fillContactDetails();
    pickFutureDay();
    fireEvent.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent("Appointment time must be in the future.");
    expect(onBooked).not.toHaveBeenCalled();
    expect(submit()).not.toBeDisabled();
  });

  it("toggles days and time slots", () => {
    renderCheckout();

    // 14 days are offered, so a weekday can appear twice — pick the first match.
    const saturday = screen.getAllByRole("button", { pressed: false, name: /sat/i })[0]!;
    expect(screen.getAllByRole("button", { pressed: false }).length).toBeGreaterThan(10);

    fireEvent.click(saturday);
    expect(saturday).toHaveAttribute("aria-pressed", "true");

    // A future day offers every slot again, whatever time it currently is.
    const slots = slotButtons();
    expect(slots.length).toBe(10);
    fireEvent.click(slots[2]!);
    expect(slots[2]).toHaveAttribute("aria-pressed", "true");
  });

  it("never offers a slot the API would reject", () => {
    // Pin the clock to the early afternoon: the morning slots are already past.
    const earlyAfternoon = new Date();
    earlyAfternoon.setHours(13, 0, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(earlyAfternoon);

    try {
      renderCheckout();
      fillContactDetails();

      // With an hour's lead, only 14:00 through 18:00 remain today.
      expect(slotButtons().length).toBe(5);
      expect(screen.queryByRole("button", { name: /^9am$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^1pm$/i })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^2pm$/i })).toBeInTheDocument();
      expect(submit()).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("explains itself when the day has no slots left", () => {
    const evening = new Date();
    evening.setHours(18, 30, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(evening);

    try {
      renderCheckout();
      fillContactDetails();

      expect(screen.getByText(/no slots left today/i)).toBeInTheDocument();
      expect(submit()).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
