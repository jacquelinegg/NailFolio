import { describe, expect, it } from "vitest";

import {
  aiComplexityFactorCents,
  buildPriceEstimate,
  estimateDurationMins,
  pricingConfigFromArtist,
  type PricingConfig,
} from "@/services/pricing";

const CONFIG: PricingConfig = {
  basePrice: 40,
  techniquePrices: { chrome_pearl: 15, "3d_gem": 20, micro_french: 5, foil: 5 },
  durationByComplexity: { low: 60, medium: 75, high: 105 },
};

describe("buildPriceEstimate", () => {
  it("bills the base manicure plus one technique layer", () => {
    const estimate = buildPriceEstimate({
      config: CONFIG,
      usedTags: ["nude", "chrome_pearl"],
      complexity: "low",
    });

    expect(estimate.lineItems).toEqual([
      { label: "Base Manicure", amount: 40, kind: "base" },
      { label: "Technique: Chrome Pearl", amount: 15, kind: "technique" },
    ]);
    expect(estimate.total).toBe(55);
    expect(estimate.durationMins).toBe(60);
  });

  it("itemises every technique layer the design stacks", () => {
    const estimate = buildPriceEstimate({
      config: CONFIG,
      usedTags: ["nude", "chrome_pearl", "micro_french", "foil"],
      complexity: "medium",
    });

    expect(estimate.lineItems).toEqual([
      { label: "Base Manicure", amount: 40, kind: "base" },
      { label: "Technique: Chrome Pearl", amount: 15, kind: "technique" },
      { label: "Technique: Micro French", amount: 5, kind: "technique" },
      { label: "Technique: Foil", amount: 5, kind: "technique" },
      { label: "AI Complexity Factor", amount: 10, kind: "ai_complexity" },
    ]);
    expect(estimate.total).toBe(75);
    expect(estimate.durationMins).toBe(95);
  });

  it("adds $5 and 10 minutes per extra technique", () => {
    const threeTechniques = buildPriceEstimate({
      config: CONFIG,
      usedTags: ["nude", "chrome_pearl", "3d_gem"],
      complexity: "medium",
    });

    expect(threeTechniques.total).toBe(40 + 15 + 20 + 5);
    expect(threeTechniques.durationMins).toBe(85);
  });

  it("caps the AI complexity factor at $25 and adds the high bonus", () => {
    const manyTechniques = ["chrome_pearl", "floral", "3d_gem", "foil", "marble", "glazed"];
    expect(aiComplexityFactorCents(manyTechniques, "high")).toBe(2_500);
    expect(aiComplexityFactorCents(["chrome_pearl"], "high")).toBe(500);
    expect(aiComplexityFactorCents(["nude", "black"], "low")).toBe(0);
  });

  it("keeps a single base-style design free of an AI complexity line", () => {
    const estimate = buildPriceEstimate({ config: CONFIG, usedTags: ["nude"], complexity: "low" });

    expect(estimate.lineItems).toEqual([{ label: "Base Manicure", amount: 40, kind: "base" }]);
    expect(estimate.total).toBe(40);
  });

  it("ignores unknown techniques and unpriced layers", () => {
    const estimate = buildPriceEstimate({
      config: CONFIG,
      usedTags: ["nude", "not_a_real_technique"],
      complexity: "low",
    });

    expect(estimate.lineItems).toHaveLength(1);
    expect(estimate.total).toBe(40);
  });

  it("falls back to default durations when the artist has no table", () => {
    const config = pricingConfigFromArtist({
      base_price: 50,
      technique_prices: null,
      duration_by_complexity: null,
    });

    expect(config).toEqual({
      basePrice: 50,
      techniquePrices: {},
      durationByComplexity: { low: 60, medium: 75, high: 105 },
    });
    expect(estimateDurationMins({ config, usedTags: ["nude"], complexity: "high" })).toBe(105);
  });

  it("avoids floating point drift on totals", () => {
    const config: PricingConfig = {
      basePrice: 33.33,
      techniquePrices: { foil: 0.07 },
      durationByComplexity: { low: 60, medium: 75, high: 105 },
    };

    const estimate = buildPriceEstimate({ config, usedTags: ["nude", "foil"], complexity: "low" });
    expect(estimate.total).toBe(33.4);
  });
});
