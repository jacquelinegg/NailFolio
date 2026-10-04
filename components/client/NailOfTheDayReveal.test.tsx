import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NailOfTheDayReveal } from "@/components/client/NailOfTheDayReveal";
import { renderWithLocale } from "@/test/renderWithLocale";

describe("NailOfTheDayReveal", () => {
  it("keeps AI design generation available without published portfolio looks", () => {
    renderWithLocale(<NailOfTheDayReveal looks={[]} onComplete={vi.fn()} />);

    expect(screen.getByRole("button", { name: /spin for today's magic design/i })).toBeEnabled();
    expect(screen.queryByText("No styles published yet.")).not.toBeInTheDocument();
    expect(screen.queryByAltText("Photorealistic manicure reference")).not.toBeInTheDocument();
  });
});
