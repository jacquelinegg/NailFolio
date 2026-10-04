import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Defs, Path, RadialGradient, Stop } from "react-native-svg";

import { palette } from "../theme";

/** The exact 20x20 sparkle used by the web design, so both platforms match. */
export const SPARKLE_PATH =
  "M10 0 C10 7 7 10 0 10 C7 10 10 13 10 20 C10 13 13 10 20 10 C13 10 10 7 10 0 Z";

export interface SparkleProps {
  size: number;
  color?: string;
  /** Seconds for one full fade in/out cycle. */
  duration: number;
  delay: number;
  opacity: number;
}

/**
 * Four-point sparkle. Built from a real tapered bezier path rather than
 * crossed rectangles: two bars of constant width can only ever read as a plus
 * sign, because their ends are blunt no matter how round the corners are.
 */
export function Sparkle({
  size,
  color = palette.blush,
  duration,
  delay,
  opacity,
}: SparkleProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay * 1000),
        Animated.timing(pulse, {
          toValue: 1,
          duration: duration * 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: duration * 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [delay, duration, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.1] });
  const fade = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [opacity * 0.2, opacity],
  });

  return (
    <Animated.View
      style={[styles.wrap, { opacity: fade, transform: [{ scale }] }]}
    >
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Defs>
          {/* Soft bloom so the star reads as light rather than a flat shape. */}
          <RadialGradient id="sparkleGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.5} />
            <Stop offset="55%" stopColor={color} stopOpacity={0.16} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Path d={SPARKLE_PATH} fill="url(#sparkleGlow)" />
        <Path d={SPARKLE_PATH} fill={color} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
});
