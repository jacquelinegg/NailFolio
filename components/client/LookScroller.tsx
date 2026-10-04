"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDynamicTranslation } from "@/components/client/useDynamicTranslation";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { normaliseTag, tagLabel } from "@/lib/tags";
import type { Look } from "@/lib/types";

export interface LookScrollerProps {
  /** The artist's published portfolio, newest first. */
  looks: Look[];
  /** Currently chosen look id, or null when the client asked for a surprise. */
  selectedLookId: string | null;
  onSelect: (lookId: string | null) => void;
}

/** Roughly two and a half cards wide, so the next one is always visibly peeking. */
const CARD_WIDTH_CLASS = "w-[62%] sm:w-[38%] lg:w-[30%]";

/**
 * Step 1 of the client funnel: the artist's real portfolio.
 *
 * This is the step that makes two artists feel like two different products. The
 * AI "surprise" path alone can only blend the artist's tags, so a client
 * choosing between artists had nothing concrete to choose on. Here the choice is
 * a photograph of work the artist has actually done, and the selected look
 * anchors everything downstream: the design is generated from its tags and
 * rendered against its image.
 *
 * Built as a scroll-snap rail rather than a paged carousel because the client is
 * scanning a list of options, not paging through a narrative — there is no
 * slide index to keep in sync with the design panel further down. Native
 * scrolling also keeps momentum, overscroll chaining and keyboard support on the
 * platform instead of reimplementing them.
 */
export function LookScroller({ looks, selectedLookId, onSelect }: LookScrollerProps) {
  const { t } = useLocale();
  const railRef = useRef<HTMLUListElement>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  /**
   * Tag labels are artist-authored, not catalogue copy, so they go through the
   * runtime translator. The hook takes a flat list, so the rail is de-duplicated
   * here and the result is indexed back by tag — a per-look map would translate
   * the same word once per look it appears in.
   */
  const uniqueTags = useMemo(() => {
    const seen = new Set<string>();
    for (const look of looks) {
      for (const raw of look.tags) {
        const tag = normaliseTag(raw);
        if (tag) seen.add(tag);
      }
    }
    return [...seen];
  }, [looks]);

  const tagNames = useDynamicTranslation(uniqueTags);
  const tagLabelById = useMemo(() => {
    const labels = new Map<string, string>();
    uniqueTags.forEach((tag, index) => {
      labels.set(tag, tagNames[index] ?? tagLabel(tag));
    });
    return labels;
  }, [tagNames, uniqueTags]);

  const labelFor = useCallback((tag: string) => tagLabelById.get(tag) ?? tagLabel(tag), [tagLabelById]);

  /**
   * Filter chips are the artist's own tag vocabulary, most-used first so the most
   * recognisable styles surface at the front. A chip that would not narrow
   * anything is dropped, which is why a single-technique portfolio shows no rail.
   */
  const filters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const look of looks) {
      for (const raw of look.tags) {
        const tag = normaliseTag(raw);
        if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag)
      .filter((tag) => (counts.get(tag) ?? 0) > 1 || looks.length <= 4);
  }, [looks]);

  const visible = useMemo(
    () => (activeTag ? looks.filter((look) => look.tags.map(normaliseTag).includes(activeTag)) : looks),
    [activeTag, looks],
  );

  /**
   * Keep the selected card on screen when the selection changes from elsewhere —
   * a filter chip can hide it. `scrollTo` is a no-op when the card is already
   * fully visible, so this does not fight a rail the client is mid-swipe on.
   */
  useEffect(() => {
    if (!selectedLookId) return;
    const rail = railRef.current;
    const card = rail?.querySelector<HTMLElement>(`[data-look-id="${selectedLookId}"]`);
    if (!rail || !card) return;

    const cardLeft = card.offsetLeft - rail.offsetLeft;
    const fullyVisible =
      cardLeft >= rail.scrollLeft && cardLeft + card.offsetWidth <= rail.scrollLeft + rail.clientWidth;
    if (!fullyVisible) {
      // The card is off-rail and the client did not swipe there themselves, so
      // the jump is a correction rather than something to animate.
      rail.scrollTo({ left: Math.max(0, cardLeft - 16), behavior: "auto" });
    }
  }, [selectedLookId, visible]);

  const select = useCallback((lookId: string | null) => onSelect(lookId), [onSelect]);

  if (looks.length === 0) {
    return (
      <section aria-labelledby="looks-heading" className="space-y-2">
        <h2 id="looks-heading" className="text-lg font-semibold">
          {t.client.looksTitle}
        </h2>
        <p className="text-sm text-white/60">{t.client.looksEmpty}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="looks-heading" className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="looks-heading" className="text-lg font-semibold">
          {t.client.looksTitle}
        </h2>
        <p className="text-sm text-white/60">{t.client.looksBody}</p>
      </header>

      {filters.length > 1 ? (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            aria-pressed={activeTag === null}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
              activeTag === null ? "border-blush-400 bg-blush-500/20" : "border-white/15 text-white/70"
            }`}
          >
            {t.client.looksFilterAll}
          </button>
          {filters.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag((current) => (current === tag ? null : tag))}
              aria-pressed={activeTag === tag}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
                activeTag === tag ? "border-blush-400 bg-blush-500/20" : "border-white/15 text-white/70"
              }`}
            >
              {labelFor(tag)}
            </button>
          ))}
        </div>
      ) : null}

      <ul ref={railRef} className="look-rail -mx-5 px-5">
        <li className={CARD_WIDTH_CLASS}>
          <button
            type="button"
            onClick={() => select(null)}
            aria-pressed={selectedLookId === null}
            className={`flex h-full w-full flex-col justify-center gap-1 rounded-2xl border-2 border-dashed p-4 text-left transition ${
              selectedLookId === null
                ? "border-blush-400 bg-blush-500/15"
                : "border-white/20 hover:border-white/40"
            }`}
          >
            <span className="font-semibold">{t.client.looksSurpriseTitle}</span>
            <span className="text-xs text-white/60">{t.client.looksSurpriseBody}</span>
          </button>
        </li>

        {visible.map((look) => {
          const isSelected = look.id === selectedLookId;
          return (
            <li key={look.id} className={CARD_WIDTH_CLASS} data-look-id={look.id}>
              <button
                type="button"
                onClick={() => select(look.id)}
                aria-pressed={isSelected}
                className={`flex h-full w-full flex-col overflow-hidden rounded-2xl border-2 text-left transition ${
                  isSelected ? "border-blush-400" : "border-transparent hover:border-white/30"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={look.image_url}
                  alt={look.tags.map((tag) => tagLabel(tag)).join(", ")}
                  loading="lazy"
                  className="aspect-4/5 w-full object-cover"
                />
                <span className="flex flex-1 flex-col gap-2 bg-ink-900/80 p-3">
                  <span className="flex flex-wrap gap-1.5">
                    {look.tags.map((raw) => {
                      const tag = normaliseTag(raw);
                      return (
                        <span
                          key={tag}
                          className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80"
                        >
                          {labelFor(tag)}
                        </span>
                      );
                    })}
                  </span>
                  <span className="mt-auto block text-xs text-white/60">
                    {t.client.fromPrice} {look.base_price} {t.home.lev}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
