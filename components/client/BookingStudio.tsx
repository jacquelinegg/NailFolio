"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

import { AITryOnStudio } from "@/components/client/AITryOnStudio";
import { CheckoutSummary } from "@/components/client/CheckoutSummary";
import { HandPhotoUpload } from "@/components/client/HandPhotoUpload";
import { LookScroller } from "@/components/client/LookScroller";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { ArtistAwareDesign, Look } from "@/lib/types";

export interface BookingStudioProps {
  artistId: string;
  artistName: string;
  /** The artist's real portfolio, loaded server-side so the rail renders on first paint. */
  looks: Look[];
}

/**
 * The zero-install funnel: pick a look → photo → AI try-on → book.
 * The client only needs the share link; there is no account and no password.
 *
 * The look selection comes first on purpose. Everything downstream is derived
 * from it, so choosing a look is the only real decision in the funnel; the photo
 * and the render are instrumental to it.
 */
export function BookingStudio({ artistId, artistName, looks }: BookingStudioProps) {
  const router = useRouter();
  const { t } = useLocale();
  const [selectedLookId, setSelectedLookId] = useState<string | null>(null);
  const [handPhotoUrl, setHandPhotoUrl] = useState<string | null>(null);
  const [design, setDesign] = useState<ArtistAwareDesign | null>(null);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);

  const selectedLook = looks.find((look) => look.id === selectedLookId) ?? null;

  /**
   * Changing the look invalidates everything derived from the previous one: the
   * design, its price and the render were all grounded in a different reference
   * image. Clearing here is what stops the checkout receipt from describing a
   * look the client no longer chose.
   */
  const handleSelectLook = useCallback((lookId: string | null) => {
    setSelectedLookId(lookId);
    setDesign(null);
    setRenderedUrl(null);
  }, []);

  const handleComplete = useCallback(
    ({ design: nextDesign, renderedUrl: nextRenderedUrl }: { design: ArtistAwareDesign; renderedUrl: string }) => {
      setDesign(nextDesign);
      setRenderedUrl(nextRenderedUrl);
    },
    [],
  );

  const handleBooked = useCallback((token: string) => {
    router.push(`/status/${token}` as Route);
  }, [router]);

  return (
    <main className="flex flex-col gap-10 pt-10 pb-24">
      <header>
        <p className="text-xs tracking-[0.2em] text-blush-300 uppercase">NailFolio</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{artistName}</h1>
        <p className="mt-2 text-sm text-white/60">{t.client.studioBody}</p>
      </header>

      <LookScroller looks={looks} selectedLookId={selectedLookId} onSelect={handleSelectLook} />

      <HandPhotoUpload value={handPhotoUrl} onChange={setHandPhotoUrl} />

      {/* Keyed on the selection so a new look mounts a fresh studio. The design
          and render state lives inside, and remounting is the only way to be
          sure none of the previous look's state survives the switch. */}
      <AITryOnStudio
        key={selectedLookId ?? "surprise"}
        artistId={artistId}
        look={selectedLook}
        handPhotoUrl={handPhotoUrl}
        onComplete={handleComplete}
      />

      <CheckoutSummary
        artistId={artistId}
        design={design}
        handPhotoUrl={handPhotoUrl}
        renderedUrl={renderedUrl}
        onBooked={handleBooked}
      />
    </main>
  );
}
