/**
 * Deterministic pricing + duration engine.
 *
 * The LLM decides *what* the design is (which tags are combined); this module
 * decides *how much* it costs. Keeping the maths in one place means the client
 * receipt, the artist dashboard and the booking payload can never disagree.
 *
 * Itemised receipt, matching the product spec:
 *   Base Manicure            $40.00
 *   Selected Technique       $15.00
 *   AI Complexity Factor     $10.00
 *   Total                    $65.00   /  75 mins
 *
 * A design combining several techniques is billed per layer, because the artist
 * prices each technique layer separately (see `artists.technique_prices`).
 */

import { isTechniqueTag, tagLabel } from "@/lib/tags";
import type { ComplexityLevel, PriceEstimate, PriceLineItem } from "@/lib/types";

export const AI_COMPLEXITY_STEP_CENTS = 500;
export const AI_COMPLEXITY_HIGH_BONUS_CENTS = 500;
export const AI_COMPLEXITY_MAX_CENTS = 2_500;
export const DURATION_PER_EXTRA_TECHNIQUE_MINS = 10;
export const FALLBACK_BASE_PRICE = 40;
export const FALLBACK_DURATIONS: Record<ComplexityLevel, number> = { low: 60, medium: 75, high: 105 };

export interface PricingConfig {
  basePrice: number;
  /** Per-technique add-on prices, e.g. `{ chrome_pearl: 15, "3d_gem": 20 }`. */
  techniquePrices: Record<string, number>;
  /** Minutes per complexity level, e.g. `{ low: 60, medium: 75, high: 105 }`. */
  durationByComplexity: Record<string, number>;
}

export interface EstimateInput {
  config: PricingConfig;
  /** Tags the design combines (base styles + techniques, de-duplicated). */
  usedTags: string[];
  complexity: ComplexityLevel;
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * AI Complexity Factor: the client is asking for something the artist has never
 * done before, so the extra coordination is billed explicitly.
 * $5 per technique beyond the first, +$5 for high-complexity designs, capped at $25.
 */
export function aiComplexityFactorCents(usedTags: string[], complexity: ComplexityLevel): number {
  const techniqueCount = usedTags.filter(isTechniqueTag).length;
  const extra = Math.max(techniqueCount - 1, 0) * AI_COMPLEXITY_STEP_CENTS;
  const bonus = complexity === "high" ? AI_COMPLEXITY_HIGH_BONUS_CENTS : 0;
  return Math.min(extra + bonus, AI_COMPLEXITY_MAX_CENTS);
}

export function estimateDurationMins({ config, usedTags, complexity }: EstimateInput): number {
  const base = config.durationByComplexity[complexity] ?? FALLBACK_DURATIONS[complexity];
  const techniqueCount = usedTags.filter(isTechniqueTag).length;
  return Math.round(base + Math.max(techniqueCount - 1, 0) * DURATION_PER_EXTRA_TECHNIQUE_MINS);
}

export function buildPriceEstimate(input: EstimateInput): PriceEstimate {
  const { config, usedTags, complexity } = input;

  const lineItems: PriceLineItem[] = [
    { label: "Base Manicure", amount: fromCents(toCents(config.basePrice)), kind: "base" },
  ];

  for (const tag of usedTags.filter(isTechniqueTag)) {
    lineItems.push({
      label: `Technique: ${tagLabel(tag)}`,
      amount: fromCents(toCents(config.techniquePrices[tag] ?? 0)),
      kind: "technique",
    });
  }

  const aiCents = aiComplexityFactorCents(usedTags, complexity);
  if (aiCents > 0) {
    lineItems.push({ label: "AI Complexity Factor", amount: fromCents(aiCents), kind: "ai_complexity" });
  }

  const totalCents = lineItems.reduce((sum, item) => sum + toCents(item.amount), 0);

  return {
    lineItems,
    total: fromCents(totalCents),
    durationMins: estimateDurationMins(input),
  };
}

/** Maps an `artists` row onto the pricing inputs above. */
export function pricingConfigFromArtist(artist: {
  base_price: number;
  technique_prices: Record<string, number> | null;
  duration_by_complexity: Record<string, number> | null;
}): PricingConfig {
  return {
    basePrice: artist.base_price ?? FALLBACK_BASE_PRICE,
    techniquePrices: artist.technique_prices ?? {},
    durationByComplexity: artist.duration_by_complexity ?? { ...FALLBACK_DURATIONS },
  };
}
