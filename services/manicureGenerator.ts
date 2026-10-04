/**
 * Manicure Generator — creates structured, realistic nail design configurations.
 *
 * Each configuration describes:
 *  - shape, palette, finish
 *  - per-finger nail config (thumb/index/middle/ring/pinky)
 *  - deterministic theme name
 *
 * Rules:
 *  - max 2-3 dominant colors
 *  - 1 dominant + 1 accent color
 *  - max 2-3 patterns
 *  - accent nail is usually ring finger
 *  - thumb/index/middle/pinky share a common visual language
 */

export type NailShape = "almond" | "coffin_ballerina" | "square" | "stiletto" | "oval" | "squoval" | "round" | "lipstick";

export type NailFinish = "cream" | "glossy" | "matte" | "metallic" | "chrome" | "pearl" | "shimmer" | "jelly" | "sheer";

export type NailPattern =
  | "solid"
  | "french"
  | "micro_french"
  | "reverse_french"
  | "chrome_accent"
  | "glitter_accent"
  | "gradient"
  | "half_moon"
  | "aura"
  | "abstract"
  | "tiny_hearts"
  | "stars"
  | "dots"
  | "floral"
  | "checker"
  | "cat_eye"
  | "marble";

export interface NailConfig {
  base: string;
  finish: NailFinish;
  pattern: NailPattern;
}

export interface ManicureConfig {
  id: string;
  name: string;
  theme: string;
  shape: NailShape;
  palette: string[];
  finish: NailFinish;
  nails: {
    thumb: NailConfig;
    index: NailConfig;
    middle: NailConfig;
    ring: NailConfig;
    pinky: NailConfig;
  };
  description: string;
  createdAt: string;
}

const SHAPES: NailShape[] = ["almond", "coffin_ballerina", "square", "stiletto", "oval", "squoval", "round", "lipstick"];

const FINISHES: NailFinish[] = ["cream", "glossy", "matte", "metallic", "chrome", "pearl", "shimmer", "jelly", "sheer"];

const PATTERNS: NailPattern[] = [
  "solid",
  "french",
  "micro_french",
  "reverse_french",
  "chrome_accent",
  "glitter_accent",
  "gradient",
  "half_moon",
  "aura",
  "abstract",
  "tiny_hearts",
  "stars",
  "dots",
  "floral",
  "checker",
  "cat_eye",
  "marble",
];

const PALETTES = [
  { name: "Cherry", colors: ["#8B0000", "#DC143C", "#FF69B4"] },
  { name: "Matcha", colors: ["#7BA05B", "#9ACD32", "#F0E68C"] },
  { name: "Milky Pink", colors: ["#FFB6C1", "#FFC0CB", "#FFF0F5"] },
  { name: "Espresso", colors: ["#3C1414", "#6B4423", "#8B6914"] },
  { name: "Lavender", colors: ["#E6E6FA", "#D8BFD8", "#DDA0DD"] },
  { name: "Baby Blue", colors: ["#E0F7FA", "#B2EBF2", "#87CEEB"] },
  { name: "Burgundy", colors: ["#800020", "#A52A2A", "#C71585"] },
  { name: "Black & Silver", colors: ["#000000", "#C0C0C0", "#E8E8E8"] },
  { name: "Peach", colors: ["#FFE5B4", "#FFDAB9", "#FFD700"] },
  { name: "Butter Yellow", colors: ["#FFFACD", "#FFF8DC", "#FFEB3B"] },
  { name: "Rose", colors: ["#FF007F", "#FF69B4", "#FFB6C1"] },
  { name: "Chocolate", colors: ["#3D2817", "#5D4037", "#795548"] },
  { name: "Sage", colors: ["#9DC183", "#B2AC88", "#F5F5DC"] },
  { name: "Icy Blue", colors: ["#E0FFFF", "#AFEEEE", "#00CED1"] },
];

const THEME_NAMES: Record<string, string> = {
  "Cherry Chrome": "Cherry Chrome",
  "Matcha Latte": "Matcha Latte",
  "Strawberry Milk": "Strawberry Milk",
  "Midnight Star": "Midnight Star",
  "Vanilla Pearl": "Vanilla Pearl",
  "Sakura Dream": "Sakura Dream",
  "Espresso Glaze": "Espresso Glaze",
  "Icy Angel": "Icy Angel",
  "Dark Cherry": "Dark Cherry",
  "Lavender Haze": "Lavender Haze",
  "Pistachio Jelly": "Pistachio Jelly",
  "Rose Chrome": "Rose Chrome",
};

function pickRandom<T>(arr: readonly T[], exclude: readonly T[] = []): T {
  const available = arr.filter((item) => !exclude.includes(item));
  if (available.length === 0) return arr[0] as T;
  const index = Math.floor(Math.random() * available.length);
  return available[index] as T;
}

function generateThemeName(palette: string[], finish: NailFinish): string {
  const paletteName = palette[0] || "Classic";
  const finishNames: Record<NailFinish, string> = {
    cream: "Cream",
    glossy: "Gloss",
    matte: "Matte",
    metallic: "Metal",
    chrome: "Chrome",
    pearl: "Pearl",
    shimmer: "Shimmer",
    jelly: "Jelly",
    sheer: "Sheer",
  };
  return `${paletteName} ${finishNames[finish]}`;
}

function generateDescription(theme: string, shape: NailShape, pattern: NailPattern): string {
  const shapeDesc: Record<NailShape, string> = {
    almond: "elegant almond-shaped",
    coffin_ballerina: "edgy coffin ballerina",
    square: "modern square-shaped",
    stiletto: "dramatic stiletto-shaped",
    oval: "soft oval-shaped",
    squoval: "versatile squoval-shaped",
    round: "classic round-shaped",
    lipstick: "bold lipstick-shaped",
  };

  const patternDesc: Record<NailPattern, string> = {
    solid: "solid color",
    french: "classic French tips",
    micro_french: "subtle micro French details",
    reverse_french: "reverse French elegance",
    chrome_accent: "chrome accent nail",
    glitter_accent: "sparkling glitter accent",
    gradient: "smooth gradient fade",
    half_moon: "half moon detail",
    aura: "soft aura effect",
    abstract: "abstract art expression",
    tiny_hearts: "delicate tiny hearts",
    stars: "celestial star pattern",
    dots: "playful dot pattern",
    floral: "dainty floral motif",
    checker: "graphic checkerboard",
    cat_eye: "magnetic cat eye",
    marble: "luxurious marble texture",
  };

  return `A ${shapeDesc[shape]} manicure featuring ${patternDesc[pattern]}. Perfect for any occasion, this ${theme.toLowerCase()} design combines sophistication with modern elegance.`;
}

export function generateManicure(excludeRecent: ManicureConfig[] = []): ManicureConfig {
  const palette = pickRandom(PALETTES);
  const shape = pickRandom(SHAPES);
  const finish = pickRandom(FINISHES);
  const accentPattern = pickRandom(PATTERNS.filter((p) => !["solid", "french"].includes(p)));
  const basePattern = pickRandom(["solid", "french", "micro_french"] as NailPattern[]);

  const dominantColor = palette.colors[0] ?? "#000000";
  const accentColor = palette.colors[1] ?? palette.colors[0] ?? "#000000";
  const lightColor = palette.colors[2] ?? palette.colors[0] ?? "#000000";

  const baseNail: NailConfig = {
    base: dominantColor,
    finish,
    pattern: basePattern,
  };

  const accentNail: NailConfig = {
    base: accentColor,
    finish: finish === "chrome" || finish === "metallic" ? finish : "glossy",
    pattern: accentPattern,
  };

  const nails = {
    thumb: basePattern === "solid" ? baseNail : { ...baseNail, base: lightColor },
    index: baseNail,
    middle: baseNail,
    ring: accentNail,
    pinky: basePattern === "solid" ? baseNail : { ...baseNail, base: lightColor },
  };

  const theme = generateThemeName(palette.colors, finish);
  const description = generateDescription(theme, shape, accentPattern);

  return {
    id: `manicure-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: theme,
    theme: palette.name,
    shape,
    palette: palette.colors,
    finish,
    nails,
    description,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Generate N manicures, avoiding immediate repetition.
 */
export function generateManicures(count: number, recent: ManicureConfig[] = []): ManicureConfig[] {
  const results: ManicureConfig[] = [];
  let lastManicure: ManicureConfig | null = null;

  for (let i = 0; i < count; i++) {
    let manicure = generateManicure(recent);

    if (lastManicure) {
      let attempts = 0;
      while (
        attempts < 10 &&
        (manicure.theme === lastManicure.theme || manicure.shape === lastManicure.shape)
      ) {
        manicure = generateManicure(recent);
        attempts++;
      }
    }

    results.push(manicure);
    lastManicure = manicure;
  }

  return results;
}
