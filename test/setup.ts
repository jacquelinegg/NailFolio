import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";

/**
 * `LocaleProvider` calls `useRouter().refresh()` so a language change can reach
 * the copy that server components render — their output is already in the
 * streamed HTML and no amount of client state can rewrite it.
 *
 * Outside a Next app there is no router, so the suite provides one and hands it
 * back for assertions.
 */
const router = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

export { router };
