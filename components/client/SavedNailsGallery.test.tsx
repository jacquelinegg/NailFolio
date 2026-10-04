import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "@testing-library/react";
import { SavedNailsGallery } from "@/components/client/SavedNailsGallery";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <LocaleProvider>{children}</LocaleProvider>
);

describe("SavedNailsGallery", () => {
  beforeEach(() => {
    vi.spyOn(localStorage, "getItem").mockReturnValue(null);
    vi.spyOn(localStorage, "setItem").mockClear();
    vi.spyOn(localStorage, "removeItem").mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders empty state when nothing is saved", () => {
    const { container } = render(<SavedNailsGallery />, { wrapper });
    expect(container.textContent).toContain("No saved nails yet");
  });
});
