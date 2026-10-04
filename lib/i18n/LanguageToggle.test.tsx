import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LanguageToggle } from "./LanguageToggle";
import { LocaleProvider, useLocale } from "./LocaleProvider";
import { LOCALE_COOKIE, LOCALE_STORAGE_KEY } from "./config";
import { router } from "@/test/setup";

function ActiveLocale() {
  const { locale, ready } = useLocale();
  if (!ready) return <span>loading</span>;
  return <span data-testid="active">{locale}</span>;
}

function renderToggle(initialLocale: "bg" | "en") {
  return render(
    <LocaleProvider initialLocale={initialLocale}>
      <LanguageToggle />
      <ActiveLocale />
    </LocaleProvider>,
  );
}

function cookieValue(name: string): string | undefined {
  return document.cookie
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)?.[1];
}

function clearCookie(name: string) {
  for (const part of document.cookie.split(";")) {
    const key = part.trim().split("=")[0];
    if (key) document.cookie = `${key}=; path=/; max-age=0`;
  }
  expect(cookieValue(name)).toBeUndefined();
}

describe("LanguageToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearCookie(LOCALE_COOKIE);
    router.refresh.mockClear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("renders both options and marks the active one", async () => {
    renderToggle("bg");

    const bg = screen.getByRole("button", { name: "БГ" });
    const en = screen.getByRole("button", { name: "EN" });

    expect(bg).toHaveAttribute("aria-pressed", "true");
    expect(en).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => expect(screen.getByTestId("active")).toHaveTextContent("bg"));
  });

  it("switches the active locale when the other option is clicked", async () => {
    renderToggle("en");

    fireEvent.click(screen.getByRole("button", { name: "БГ" }));

    await waitFor(() => expect(screen.getByTestId("active")).toHaveTextContent("bg"));
  });

  it("persists a manual choice to localStorage", async () => {
    renderToggle("en");

    fireEvent.click(screen.getByRole("button", { name: "БГ" }));

    await waitFor(() =>
      expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("bg"),
    );
  });

  it("restores a manual override that beats the detected locale", async () => {
    // The server detected Bulgarian; the visitor previously chose English.
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "en");

    renderToggle("bg");

    // The stored choice must win over the prop.
    await waitFor(() => expect(screen.getByTestId("active")).toHaveTextContent("en"));
  });

  it("keeps the detected locale when nothing is stored", async () => {
    renderToggle("bg");

    await waitFor(() => expect(screen.getByTestId("active")).toHaveTextContent("bg"));
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
  });

  it("publishes the choice to the cookie the server reads", async () => {
    // The regression this guards. Most of the page copy comes from server
    // components that resolve their language from this cookie, and their
    // output is already in the streamed HTML. Updating only React state
    // translated the header and the client studios while every
    // server-rendered section kept the old language, so the page spoke two
    // languages at once and a refresh reverted the switch entirely.
    renderToggle("en");

    fireEvent.click(screen.getByRole("button", { name: "БГ" }));

    await waitFor(() => expect(cookieValue(LOCALE_COOKIE)).toBe("bg"));
  });

  it("asks the server to re-render the page after a switch", async () => {
    // The cookie only helps if the server-rendered tree is actually re-fetched.
    renderToggle("en");

    fireEvent.click(screen.getByRole("button", { name: "БГ" }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("does not re-render on mount when the stored choice agrees with the server", async () => {
    // A redundant round trip on every page load would double the server work
    // for the majority of visitors, who never touch the toggle.
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "bg");

    renderToggle("bg");

    await waitFor(() => expect(screen.getByTestId("active")).toHaveTextContent("bg"));
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("syncs the cookie when a stored override disagrees with the server", async () => {
    // The visitor chose English, the server re-detected Bulgarian from their
    // request. The client wins, but only once the server has been told.
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "en");

    renderToggle("bg");

    await waitFor(() => expect(cookieValue(LOCALE_COOKIE)).toBe("en"));
    expect(router.refresh).toHaveBeenCalled();
  });
});
