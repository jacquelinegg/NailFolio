"use client";

import { useState } from "react";

import { useLocale } from "@/lib/i18n/LocaleProvider";

export interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

/**
 * Touch-friendly before/after comparison.
 * A native range input sits on top of the two stacked images, so the divider
 * follows the user's thumb (or mouse, or keyboard arrows) with no custom drag maths.
 */
export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeLabel,
  afterLabel,
  className = "",
}: BeforeAfterSliderProps) {
  const { t } = useLocale();
  const [position, setPosition] = useState(50);
  const before = beforeLabel ?? t.client.beforeLabel;
  const after = afterLabel ?? t.client.afterLabel;

  return (
    <figure className={`relative overflow-hidden rounded-2xl border border-white/10 ${className}`}>
      <div className="relative aspect-4/5 w-full select-none sm:aspect-square">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={afterSrc} alt={after} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={beforeSrc}
            alt={before}
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.6)]"
          style={{ left: `${position}%` }}
          aria-hidden="true"
        >
          <span className="absolute top-1/2 left-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink-950/80 text-sm">
            ↔
          </span>
        </div>

        <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-ink-950/70 px-2.5 py-1 text-xs">
          {before}
        </span>
        <span className="pointer-events-none absolute top-2 right-2 rounded-full bg-ink-950/70 px-2.5 py-1 text-xs">
          {after}
        </span>

        <input
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          aria-label={t.client.compareAria}
          className="compare-range absolute inset-0 h-full w-full opacity-0"
        />
      </div>
    </figure>
  );
}
