"use client";

import { useCallback, useState } from "react";

import { BeforeAfterSlider } from "@/components/client/BeforeAfterSlider";
import { useDynamicTranslation } from "@/components/client/useDynamicTranslation";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { tagLabel } from "@/lib/tags";
import type { ArtistAwareDesign, Look } from "@/lib/types";

export interface AITryOnStudioProps {
  artistId: string;
  /**
   * The look the client picked in the portfolio rail, or null when they asked
   * for a surprise. It is what the design is generated from and rendered
   * against, so this component's whole copy and payload depend on it.
   */
  look: Look | null;
  /** Uploaded hand photo URL. The CTA stays disabled until it exists. */
  handPhotoUrl: string | null;
  /** Fired once a design *and* its render are both available. */
  onComplete: (result: { design: ArtistAwareDesign; renderedUrl: string }) => void;
}

type Phase = "idle" | "designing" | "rendering" | "ready" | "design-only";

/**
 * Step 3 of the client funnel: the design, on the client's own hand.
 *
 * The design is synthesised from the artist's own portfolio (either the look the
 * client picked, or their whole catalogue on the surprise path), so it is always
 * something they can actually do, then transferred onto the client's photo by
 * YouCam. A failed render never loses the design: the client can still book it
 * after retrying, and a failed design is retried rather than crashing the page.
 */
export function AITryOnStudio({ artistId, look, handPhotoUrl, onComplete }: AITryOnStudioProps) {
  const { t } = useLocale();
  const [phase, setPhase] = useState<Phase>("idle");
  const [design, setDesign] = useState<ArtistAwareDesign | null>(null);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [inspirationImage, setInspirationImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [inspirationPreview, setInspirationPreview] = useState<string | null>(null);

  const handleInspirationChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.replace(/^data:([^;]+);base64,/, "");
      setInspirationImage({ base64, mimeType: file.type });
      setInspirationPreview(result);
    };
    reader.readAsDataURL(file);
  }, []);

  // The design copy and its tags are model-authored, so they go through the
  // runtime translator rather than the static catalogue.
  const renderSteps = [t.client.renderStepOne, t.client.renderStepTwo, t.client.renderStepThree];
  const description = useDynamicTranslation(design ? [design.description] : []);
  const tagNames = useDynamicTranslation(design ? design.usedTags : []);
  const render = useCallback(
    async (nextDesign: ArtistAwareDesign) => {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handUrl: handPhotoUrl,
          refImageUrl: nextDesign.refImageUrl,
        }),
      });

      const payload = (await response.json()) as { url?: string; error?: { message?: string } };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error?.message ?? t.client.renderFailed);
      }
      return payload.url;
    },
    [handPhotoUrl, t],
  );

  const generate = useCallback(async () => {
    if (!handPhotoUrl) return;

    setError(null);
    setPhase("designing");
    setStepIndex(0);

    let nextDesign: ArtistAwareDesign;
    try {
      const response = await fetch("/api/surprise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId, lookId: look?.id ?? null, ...(inspirationImage ? { inspirationImage } : {}) }),
      });
      const payload = (await response.json()) as { design?: ArtistAwareDesign; error?: { message?: string } };

      if (!response.ok || !payload.design) {
        throw new Error(payload.error?.message ?? t.client.designFailed);
      }
      nextDesign = payload.design;
    } catch (designError) {
      setError(designError instanceof Error ? designError.message : t.client.designFailed);
      setPhase("idle");
      return;
    }

    setDesign(nextDesign);
    setPhase("rendering");
    setStepIndex(0);

    // Cycle the progress copy while YouCam works (~5-15s).
    const ticker = setInterval(() => {
      setStepIndex((index) => Math.min(index + 1, renderSteps.length - 1));
    }, 4_000);

    try {
      const url = await render(nextDesign);
      setRenderedUrl(url);
      setPhase("ready");
      onComplete({ design: nextDesign, renderedUrl: url });
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : t.client.renderFailed);
      setPhase("design-only");
    } finally {
      clearInterval(ticker);
    }
  }, [artistId, handPhotoUrl, look, onComplete, render, renderSteps.length, t]);

  const isBusy = phase === "designing" || phase === "rendering";

  return (
    <section aria-labelledby="try-on-heading" className="space-y-4">
      <header>
        <h2 id="try-on-heading" className="text-lg font-semibold">
          {t.client.stepThreeTitle}
        </h2>
        <p className="mt-1 text-sm text-white/60">
          {look ? t.client.stepThreeBodyPicked : t.client.stepThreeBody}
        </p>
      </header>

      <button
        type="button"
        onClick={() => void generate()}
        disabled={!handPhotoUrl || isBusy}
        className="w-full rounded-2xl bg-gradient-to-r from-blush-400 to-blush-500 px-5 py-4 text-base font-semibold text-ink-950 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isBusy
          ? phase === "designing"
            ? t.client.designing
            : t.client.rendering
          : look
            ? t.client.tryThisLook
            : t.client.surpriseButton}
      </button>

      <label className="block text-sm">
        <span className="font-medium">{t.client.inspirationImage ?? "Inspiration photo (optional)"}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleInspirationChange}
          className="mt-1 w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white"
        />
        {inspirationPreview ? (
          <img src={inspirationPreview} alt="Inspiration" className="mt-2 h-32 rounded-xl object-cover" />
        ) : null}
      </label>

      {!handPhotoUrl ? <p className="text-sm text-white/50">{t.client.needsPhoto}</p> : null}

      {isBusy ? (
        <div role="status" aria-live="polite" className="rounded-2xl border border-white/10 bg-ink-900 p-5">
          <div className="flex items-center gap-3">
            <span className="nf-spin inline-block h-5 w-5 rounded-full border-2 border-blush-300 border-t-transparent" />
            <p className="text-sm">
              {phase === "rendering" ? renderSteps[stepIndex] : t.client.stepReadPortfolio}
            </p>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-blush-400 transition-all duration-1000"
              style={{ width: phase === "rendering" ? `${35 + stepIndex * 25}%` : "20%" }}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="space-y-3 rounded-2xl bg-blush-500/15 p-4">
          <p className="text-sm text-blush-300">{error}</p>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={isBusy}
            className="rounded-xl border border-blush-300/40 px-4 py-2 text-sm font-semibold text-blush-300 disabled:opacity-50"
          >
            {t.common.retry}
          </button>
        </div>
      ) : null}

      {design ? (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-ink-900 p-4">
          <p className="text-sm leading-relaxed text-white/90">
            {description[0] ?? design.description}          </p>
          <ul className="flex flex-wrap gap-2">
            {design.usedTags.map((tag, index) => (
              <li
                key={tag}
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80"
              >
                {tagNames[index] ?? tagLabel(tag)}              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {handPhotoUrl && renderedUrl ? (
        <BeforeAfterSlider beforeSrc={handPhotoUrl} afterSrc={renderedUrl} />
      ) : null}

      {phase === "design-only" ? (
        <p className="text-xs text-white/50">{t.client.designOnlyNote}</p>
      ) : null}
    </section>
  );
}
