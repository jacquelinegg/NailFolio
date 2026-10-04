"use client";

import React, { useId, useMemo } from "react";

interface Sparkle {
  id: number;
  top: string;
  left: string;
  size: number;
  duration: string;
  delay: string;
  /** Peak brightness of this sparkle's pulse. */
  peak: number;
}

interface SparkleBackgroundProps {
  count?: number;
  className?: string;
  fixed?: boolean;
  children?: React.ReactNode;
}

const STAR = "polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)";

/** FNV-1a, so a stable string such as `useId()` becomes a usable 32-bit seed. */
function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32: small, fast, and identical on the server and in the browser. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pulse lengths are 2.5s – 5.4s, and start offsets 0.0s – 3.9s. */
const DURATION_STEPS = 30;
const DELAY_STEPS = 40;
const TIMING_SLOTS = DURATION_STEPS * DELAY_STEPS;

/**
 * Coprime with `TIMING_SLOTS`, so walking `index * TIMING_STRIDE` visits each
 * timing slot once before repeating.
 */
const TIMING_STRIDE = 517;

/**
 * The animation timing for sparkle `index`, unique by construction.
 *
 * Drawn at random this collides surprisingly often — 48 sparkles land in 1200
 * slots, so a duplicate is more likely than not, and it would have to be
 * re-checked on every render. Walking a coprime stride through the slot table
 * and permuting both fields keeps the values scattered and organic-looking
 * while guaranteeing no two sparkles ever pulse in lockstep.
 */
function timingFor(index: number): { duration: string; delay: string } {
  const slot = (index * TIMING_STRIDE) % TIMING_SLOTS;
  const durationStep = ((slot % DURATION_STEPS) * 7) % DURATION_STEPS;
  const delayStep = (Math.floor(slot / DURATION_STEPS) * 13) % DELAY_STEPS;

  return {
    duration: `${(2.5 + durationStep * 0.1).toFixed(1)}s`,
    delay: `${(delayStep * 0.1).toFixed(1)}s`,
  };
}

/**
 * Sparkles keep clear of the very edge so a star positioned by its top-left
 * corner is never half-clipped by the viewport.
 */
const INSET_PERCENT = 5;
const SPAN_PERCENT = 90;

/**
 * Sub-unit power: the lower it is, the harder the middle is thinned out.
 *
 * The content column sits in the middle of every page, so a uniform field
 * spends most of its sparkles behind text and panels where they are invisible.
 * Raising the signed distance from centre to a fractional power leaves the
 * range at a full 0..1 while weighting both ends, which is what makes the page
 * edges read as the lit part of the composition.
 */
const EDGE_BIAS = 0.62;

/** Maps a uniform 0..1 draw onto the same range, weighted toward both ends. */
function pushToEdges(value: number): number {
  const offset = value * 2 - 1;
  const magnitude = Math.pow(Math.abs(offset), EDGE_BIAS);
  return ((offset < 0 ? -magnitude : magnitude) + 1) / 2;
}

/**
 * The Midnight Velvet sparkle field, fixed to the viewport behind the whole app.
 *
 * Positions are drawn from a PRNG seeded by `useId()` rather than from
 * `Math.random()`. `useId` is stable for a given tree across the server render
 * and the client hydration, so both sides lay out the same field — plain
 * randomness made the server HTML disagree with the hydrated DOM on every
 * sparkle, and React had to throw the whole layer away to reconcile it. The
 * arrangement still looks arbitrary, and it no longer shifts on every reload.
 */
export const SparkleBackground: React.FC<SparkleBackgroundProps> = ({
  count = 12,
  className = "",
  fixed = false,
  children,
}) => {
  const seed = useId();

  const sparkles = useMemo<Sparkle[]>(() => {
    const random = seededRandom(hashSeed(seed));

    return Array.from({ length: count }, (_, i) => {
      const place = () => {
        const percent = INSET_PERCENT + pushToEdges(random()) * SPAN_PERCENT;
        return `${percent.toFixed(2)}%`;
      };

      return {
        id: i,
        top: place(),
        left: place(),
        size: Math.floor(random() * 12) + 12,
        ...timingFor(i),
        peak: Number((random() * 0.5 + 0.3).toFixed(2)),
      };
    });
  }, [count, seed]);

  return (
    // No `overflow: hidden` here on purpose. In `fixed` mode the sparkles are
    // positioned against the viewport and would not be clipped by it anyway,
    // while an overflow-hidden ancestor silently turns into the scroll container
    // for any `position: sticky` descendant — which would stop the site header
    // from sticking at all.
    <div className={`relative w-full ${className}`.trim()}>
      {sparkles.map((sparkle) => (
        <div
          key={sparkle.id}
          className={`${fixed ? "fixed" : "absolute"} nf-sparkle z-0 bg-[#E8D5CE] drop-shadow-[0_0_8px_rgba(232,213,206,0.7)]`}
          style={
            {
              top: sparkle.top,
              left: sparkle.left,
              width: `${sparkle.size}px`,
              height: `${sparkle.size}px`,
              clipPath: STAR,
              animationDuration: sparkle.duration,
              animationDelay: sparkle.delay,
              opacity: sparkle.peak,
              // Read by the `nf-sparkle` keyframes, so each star fades between
              // its own low and high point instead of a shared fixed range.
              "--nf-sparkle-peak": sparkle.peak,
            } as React.CSSProperties
          }
          aria-hidden="true"
        />
      ))}

      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default SparkleBackground;
