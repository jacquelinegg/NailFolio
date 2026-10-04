import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { alpha, gradients, palette, radii, shadows, spacing } from "../theme";

export interface GlassCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

/**
 * Frosted panel: a real `BlurView` for the backdrop, a gradient fill, and a
 * one-pixel gradient hairline. The hairline is a separate absolute layer
 * because React Native cannot draw a gradient border directly.
 */
export function GlassCard({ children, style, padded = true }: GlassCardProps) {
  return (
    <View style={[styles.card, style]}>
      <BlurView intensity={16} tint="dark" style={StyleSheet.absoluteFill} />

      <LinearGradient
        colors={gradients.panel}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Gradient hairline standing in for `border-image` on the web. */}
      <LinearGradient
        colors={gradients.cardBorder}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hairline}
      />

      {/* Specular rim: the highlight that sells the "glass" read. */}
      <View style={styles.rim} />

      <View style={padded ? styles.padded : undefined}>{children}</View>
    </View>
  );
}

export interface PearlTextProps {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}

/**
 * Gradient text needs a masking layer, so the display treatment falls back to
 * the pearl tone with a rose bloom — the same treatment used on the web.
 */
export function PearlText({ children, style }: PearlTextProps) {
  return <Text style={[styles.pearl, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    overflow: "hidden",
    ...shadows.card,
  },
  padded: { padding: spacing.lg },
  hairline: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.35),
  },
  rim: {
    position: "absolute",
    top: 0,
    left: spacing.xl,
    right: spacing.xl,
    height: 1,
    backgroundColor: alpha(palette.pearl, 0.28),
  },
  pearl: {
    color: palette.pearl,
    letterSpacing: 0.4,
    textShadowColor: alpha(palette.rose, 0.45),
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  } satisfies TextStyle,
});
