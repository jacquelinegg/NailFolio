import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { alpha, gradients, palette, radii, shadows, type } from "../theme";

export interface PearlButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "pearl" | "ghost";
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SHINE_DURATION_MS = 3600;

/**
 * Glossy primary action: a real three-stop pearl gradient, the classic glossy
 * top-half overlay, and a shine bar sweeping across on a loop.
 */
export function PearlButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = "pearl",
  compact = false,
  style,
}: PearlButtonProps) {
  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shine, {
        toValue: 1,
        duration: SHINE_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [shine]);

  const translateX = shine.interpolate({ inputRange: [0, 1], outputRange: [-160, 460] });
  const isGhost = variant === "ghost";
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        inactive ? styles.inactiveShell : isGhost ? styles.ghost : styles.pearlShadow,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {isGhost ? null : (
        <>
          {inactive ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(palette.ink900, 0.85) }]} pointerEvents="none" />
          ) : (
            <LinearGradient
              colors={gradients.pearl}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          {/* Glossy top half. */}
          <View style={[styles.gloss, { pointerEvents: "none" }, inactive && styles.inactiveGloss]} />
        </>
      )}

      {isGhost ? null : (
        <Animated.View
          style={[styles.shine, { pointerEvents: "none" }, { transform: [{ translateX }, { rotate: "12deg" }] }, inactive && styles.inactiveShine]}
        />
      )}

      {loading ? (
        <ActivityIndicator color={isGhost ? palette.pearl : inactive ? palette.ashDim : palette.ink900} />
      ) : (
        <Text style={[styles.label, inactive ? styles.labelInactive : isGhost ? styles.labelGhost : styles.labelPearl]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: radii.pill,
    paddingHorizontal: 26,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  compact: { minHeight: 40, paddingHorizontal: 18 },
  inactiveShell: {
    backgroundColor: palette.ink900,
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.15),
  },
  pearlShadow: shadows.glow,
  ghost: {
    backgroundColor: alpha(palette.pearl, 0.05),
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.38),
  },
  gloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "52%",
    backgroundColor: alpha(palette.pearl, 0.5),
  },
  inactiveGloss: {
    backgroundColor: alpha(palette.ink950, 0.35),
  },
  shine: {
    position: "absolute",
    top: -20,
    width: 46,
    height: 140,
    backgroundColor: alpha(palette.pearl, 0.45),
  },
  inactiveShine: {
    backgroundColor: alpha(palette.ink950, 0.4),
  },
  pressed: { transform: [{ scale: 0.97 }] },
  label: { ...type.body, fontSize: 15, fontWeight: "700" },
  labelPearl: { color: palette.ink900 },
  labelGhost: { color: palette.pearl },
  labelInactive: { color: palette.ashDim },
});
