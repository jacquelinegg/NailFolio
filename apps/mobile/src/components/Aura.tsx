import { useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { alpha, gradients, palette } from "../theme";
import { Sparkle } from "./Sparkle";

interface Star {
  key: number;
  top: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

/**
 * Deterministic PRNG. A fixed starfield means the sparkles never reshuffle on
 * re-render, and the same layout shows up every launch.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildStars(count: number): Star[] {
  const random = mulberry32(20260928);
  return Array.from({ length: count }, (_, key) => ({
    key,
    top: random(),
    left: random(),
    size: Math.floor(random() * 11) + 12,
    duration: random() * 3 + 2.5,
    delay: random() * 4,
    opacity: random() * 0.45 + 0.3,
  }));
}

export interface AuraProps {
  count?: number;
  children?: React.ReactNode;
}

/**
 * Ambient Midnight Velvet field: three oversized coloured glows over a deep
 * plum base, with a drifting sparkle layer on top. Stays behind content and
 * never intercepts touches.
 */
export function Aura({ count = 34, children }: AuraProps) {
  const { width, height } = useWindowDimensions();
  const stars = useMemo(() => buildStars(count), [count]);

  const glowSize = Math.max(width, height);

  return (
    <View style={[styles.root, { pointerEvents: "box-none" }]}>
      <LinearGradient
        colors={gradients.page}
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.glow,
          { pointerEvents: "none" },
          {
            width: glowSize,
            height: glowSize,
            top: -glowSize * 0.42,
            left: -glowSize * 0.28,
            borderRadius: glowSize,
            backgroundColor: alpha(palette.rose, 0.2),
          },
        ]}
      />
      <View
        style={[
          styles.glow,
          { pointerEvents: "none" },
          {
            width: glowSize,
            height: glowSize,
            top: -glowSize * 0.18,
            left: width - glowSize * 0.62,
            borderRadius: glowSize,
            backgroundColor: alpha(palette.ash, 0.16),
          },
        ]}
      />
      <View
        style={[
          styles.glow,
          { pointerEvents: "none" },
          {
            width: glowSize,
            height: glowSize,
            top: height - glowSize * 0.5,
            left: -glowSize * 0.1,
            borderRadius: glowSize,
            backgroundColor: alpha(palette.plum, 0.55),
          },
        ]}
      />

      <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
        {stars.map((star) => (
          <View
            key={star.key}
            style={{
              position: "absolute",
              top: star.top * height,
              left: star.left * width,
            }}
          >
            <Sparkle
              size={star.size}
              duration={star.duration}
              delay={star.delay}
              opacity={star.opacity}
            />
          </View>
        ))}
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  glow: { position: "absolute" },
});
