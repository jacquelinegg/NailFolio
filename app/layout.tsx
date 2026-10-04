import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "NailFolio — see it on your hands before you book",
  description: "Try on your nail artist's actual techniques with AI, then book in under a minute.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b0a0f",
};

import { SparkleBackground } from '@/apps/web/components/ui/SparkleBackground';
import { WebHeader } from '@/components/site/WebHeader';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';
import { isLocale, LOCALE_COOKIE } from '@/lib/i18n/config';

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The middleware writes the detected locale; reading it here means the first
  // paint already uses the right catalogue instead of flashing the default.
  const detected = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(detected) ? detected : "en";

  return (
    <html lang={locale}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Manrope:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh bg-ink-950 text-white antialiased" suppressHydrationWarning>
        {/* Both ambient layers live here rather than per page, so every route
            gets the same glows and sparkles instead of only the home page. */}
        <div className="aura" aria-hidden="true" />

        <SparkleBackground count={48} fixed>
          <LocaleProvider initialLocale={locale}>
            <WebHeader />
            {children}
          </LocaleProvider>
        </SparkleBackground>
      </body>
    </html>
  );
}
