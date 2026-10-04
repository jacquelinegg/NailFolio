import { Platform, type ViewStyle } from "react-native";

/**
 * Midnight Velvet — the same palette the web app uses in `app/globals.css`.
 * Kept in one place so screens never hard-code a hex value.
 */
export const palette = {
  ink950: "#17151F",
  ink900: "#1E1B2E",
  ink800: "#2D3246",
  ink700: "#3A3F56",
  plum: "#4A3B47",
  rose: "#D4B8B1",
  roseDeep: "#B99FA9",
  blush: "#E8D5CE",
  pearl: "#F9F6F0",
  ash: "#9C94A0",
  ashDim: "#6A6478",
  mint: "#6EE7C7",
  danger: "#EF8FA6",
  warn: "#F0C674",
} as const;

/** rgba() helper for the glass and glow layers, which need transparency. */
export function alpha(hex: string, opacity: number): string {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** Stop lists for the gradients, mirroring the CSS on the web. */
export const gradients = {
  /** `.web` glass panel. */
  panel: [
    alpha(palette.pearl, 0.1),
    alpha(palette.pearl, 0.02),
    alpha(palette.rose, 0.07),
  ] as const,
  /** `.card` body. */
  card: [palette.ink800, palette.ink900] as const,
  /** `.card` hairline border. */
  cardBorder: [
    alpha(palette.blush, 0.55),
    alpha(palette.rose, 0.12),
    alpha(palette.ash, 0.4),
  ] as const,
  /** `.btn-pearl`. */
  pearl: [palette.pearl, palette.blush, palette.rose] as const,
  /** The app backdrop: mid → plum → near-black, top to bottom. */
  page: [palette.ink800, palette.ink900, palette.ink950] as const,
  /** Decorative nail plate. */
  nail: ["#FFFFFF", "#F0D8D0", palette.roseDeep] as const,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * React Native has no `box-shadow`. iOS takes the shadow* props, Android only
 * understands `elevation`, and web needs `boxShadow`. Build per platform.
 */
function shadow(color: string, opacity: number, radius: number, offsetY: number): ViewStyle {
  const boxShadow = `0 0 ${radius}px ${color}${opacity < 1 ? ` ${opacity}` : ""}`;
  if (Platform.OS === "android") {
    return { elevation: Math.round(radius / 2), shadowColor: color };
  }
  if (Platform.OS === "web") {
    return { boxShadow };
  }
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: radius,
    shadowOffset: { width: 0, height: offsetY },
  };
}

export const shadows = {
  /** Outer panel: deep drop shadow plus a rose bloom. */
  panel: {
    ...shadow(palette.ink950, 0.55, 24, 12),
    ...shadow(palette.rose, 0.22, 32, 0),
  },
  /** Card: tighter, so a list of cards does not turn into a dark mass. */
  card: {
    ...shadow(palette.ink950, 0.45, 16, 8),
    ...shadow(palette.rose, 0.16, 24, 0),
  },
  /** Small elevated surfaces: chips, inputs, tab bar. */
  chip: shadow(palette.ink950, 0.4, 10, 4),
  glow: shadow(palette.rose, 0.5, 18, 0),
} as const;

/**
 * Font family names registered by `@expo-google-fonts/cormorant-garamond` in
 * `App.tsx`, with the platform serif as the pre-load fallback.
 */
export const fontFamilies = {
  display: "CormorantGaramond_600SemiBold",
  displayRegular: "CormorantGaramond_400Regular",
  body: Platform.select({ ios: "System", default: "sans-serif" }) as string,
} as const;

export const type = {
  display: { fontFamily: fontFamilies.display },
  body: { fontFamily: fontFamilies.body },
} as const;
