/**
 * Shared palette generator.
 *
 * Both the web app and the mobile app should import from here so the
 * colour logic stays identical everywhere.
 */

export type PaletteMode = {
  label: string;
  generator: (seed: number) => [string, string, string, string];
};

const PALETTE_MODES: readonly PaletteMode[] = [
  {
    label: "rich jewel",
    generator: (seed) => [
      `hsl(${seed % 360}, 60%, 28%)`,
      `hsl(${(seed + 35) % 360}, 65%, 34%)`,
      `hsl(${(seed + 70) % 360}, 55%, 24%)`,
      `hsl(${(seed + 105) % 360}, 50%, 38%)`,
    ],
  },
  {
    label: "soft pastel",
    generator: (seed) => [
      `hsl(${seed % 360}, 40%, 72%)`,
      `hsl(${(seed + 25) % 360}, 45%, 77%)`,
      `hsl(${(seed + 50) % 360}, 35%, 67%)`,
      `hsl(${(seed + 75) % 360}, 30%, 82%)`,
    ],
  },
  {
    label: "neon pop",
    generator: (seed) => [
      `hsl(${seed % 360}, 90%, 48%)`,
      `hsl(${(seed + 40) % 360}, 95%, 53%)`,
      `hsl(${(seed + 80) % 360}, 85%, 43%)`,
      `hsl(${(seed + 120) % 360}, 90%, 58%)`,
    ],
  },
  {
    label: "deep moody",
    generator: (seed) => [
      `hsl(${seed % 360}, 25%, 22%)`,
      `hsl(${(seed + 50) % 360}, 35%, 27%)`,
      `hsl(${(seed + 100) % 360}, 30%, 32%)`,
      `hsl(${(seed + 150) % 360}, 20%, 17%)`,
    ],
  },
  {
    label: "bright summer",
    generator: (seed) => [
      `hsl(${seed % 360}, 80%, 45%)`,
      `hsl(${(seed + 45) % 360}, 85%, 50%)`,
      `hsl(${(seed + 90) % 360}, 75%, 40%)`,
      `hsl(${(seed + 135) % 360}, 80%, 55%)`,
    ],
  },
  {
    label: "monochrome",
    generator: (seed) => {
      const base = seed % 360;
      return [
        `hsl(${base}, 5%, 18%)`,
        `hsl(${base}, 8%, 32%)`,
        `hsl(${base}, 12%, 48%)`,
        `hsl(${base}, 6%, 72%)`,
      ];
    },
  },
  {
    label: "complementary pop",
    generator: (seed) => [
      `hsl(${seed % 360}, 70%, 40%)`,
      `hsl(${(seed + 180) % 360}, 75%, 45%)`,
      `hsl(${seed % 360}, 60%, 55%)`,
      `hsl(${(seed + 180) % 360}, 65%, 30%)`,
    ],
  },
  {
    label: "analogous dream",
    generator: (seed) => [
      `hsl(${seed % 360}, 65%, 40%)`,
      `hsl(${(seed + 30) % 360}, 70%, 45%)`,
      `hsl(${(seed + 60) % 360}, 60%, 35%)`,
      `hsl(${(seed + 90) % 360}, 55%, 50%)`,
    ],
  },
  {
    label: "triadic burst",
    generator: (seed) => [
      `hsl(${seed % 360}, 75%, 42%)`,
      `hsl(${(seed + 120) % 360}, 80%, 47%)`,
      `hsl(${(seed + 240) % 360}, 70%, 37%)`,
      `hsl(${(seed + 60) % 360}, 65%, 52%)`,
    ],
  },
  {
    label: "earthy tones",
    generator: (seed) => [
      `hsl(${(seed % 40) + 10}, 45%, 28%)`,
      `hsl(${(seed + 30) % 50 + 15}, 50%, 34%)`,
      `hsl(${(seed + 60) % 45 + 20}, 40%, 24%)`,
      `hsl(${(seed + 90) % 35 + 25}, 35%, 40%)`,
    ],
  },
  {
    label: "cool ice",
    generator: (seed) => [
      `hsl(${(seed % 60) + 180}, 55%, 35%)`,
      `hsl(${(seed + 30) % 60 + 180}, 60%, 40%)`,
      `hsl(${(seed + 60) % 60 + 180}, 50%, 30%)`,
      `hsl(${(seed + 90) % 60 + 180}, 45%, 45%)`,
    ],
  },
  {
    label: "warm sunset",
    generator: (seed) => [
      `hsl(${(seed % 50) + 10}, 75%, 42%)`,
      `hsl(${(seed + 30) % 50 + 20}, 80%, 47%)`,
      `hsl(${(seed + 60) % 50 + 30}, 70%, 37%)`,
      `hsl(${(seed + 90) % 50 + 40}, 65%, 52%)`,
    ],
  },
] as const;

export function generatePalette(seed: number): string[] {
  const mode = PALETTE_MODES[Math.abs(seed) % PALETTE_MODES.length];
  const hslStrings = mode.generator(seed);

  const hex = (hsl: string): string => {
    const m = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!m) return "#E8D5CE";
    const h = Number(m[1]);
    const s = Number(m[2]);
    const l = Number(m[3]);
    const a = s / 100;
    const b = l / 100;
    const k = (n: number) => (n + h / 30) % 12;
    const f = (n: number) => b - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
  };

  return hslStrings.map(hex);
}

export const PALETTE_MODE_COUNT = PALETTE_MODES.length;
