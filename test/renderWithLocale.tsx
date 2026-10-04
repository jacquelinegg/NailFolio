import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/config";

/**
 * `render` with the locale context in place.
 *
 * Client components read their copy from `useLocale`, which deliberately throws
 * outside a provider so a missing provider can never ship silently. Tests wrap
 * explicitly instead, which keeps that guarantee intact.
 */
export function renderWithLocale(
  ui: ReactElement,
  { locale = "en", ...options }: { locale?: Locale } & RenderOptions = {},
): RenderResult {
  function Wrapper({ children }: { children?: ReactNode }) {
    return <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
