"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { tagLabel } from "@/lib/tags";
import type { Look } from "@/lib/types";
import { NailOfTheDayReveal } from "@/components/client/NailOfTheDayReveal";
import { SavedNailsGallery } from "@/components/client/SavedNailsGallery";
import { generateManicure, type ManicureConfig } from "@/services/manicureGenerator";

export function ManicureOfTheDayClient({ initialLook }: { initialLook: Look | null }) {
  const { t } = useLocale();

  const handleComplete = useCallback((manicure: ManicureConfig, selectedLook: Look | null) => {
    // Animation complete - data is displayed by the reveal component
  }, []);

  return (
    <div className="w-full px-5">
      <section className="mt-20 md:mt-28">
        <NailOfTheDayReveal looks={initialLook ? [initialLook] : []} onComplete={handleComplete} />
      </section>

      <section className="mt-16 md:mt-24">
        <SavedNailsGallery />
      </section>
    </div>
  );
}
