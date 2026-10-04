import { useRef, useState } from "react";
import {
  Image,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { alpha, palette, radii, type } from "../theme";

export interface BeforeAfterCompareProps {
  beforeUri: string;
  afterUri: string;
  beforeLabel: string;
  afterLabel: string;
  height?: number;
}

/**
 * Touch before/after comparison, the native counterpart of the web
 * `BeforeAfterSlider`.
 *
 * React Native has no `<input type="range">`, so the divider follows a
 * `PanResponder` that maps horizontal movement to a 0–100 percentage of the
 * measured width. The "after" image sits underneath and the "before" image is
 * clipped to the left of the divider.
 */
export function BeforeAfterCompare({
  beforeUri,
  afterUri,
  beforeLabel,
  afterLabel,
  height = 320,
}: BeforeAfterCompareProps) {
  const [position, setPosition] = useState(50);
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const positionRef = useRef(50);

  const updateFromX = (x: number) => {
    if (widthRef.current <= 0) return;
    const next = Math.min(100, Math.max(0, (x / widthRef.current) * 100));
    positionRef.current = next;
    setPosition(next);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Claim the gesture so an enclosing ScrollView does not steal the drag.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => updateFromX(event.nativeEvent.locationX),
      onPanResponderMove: (event) => updateFromX(event.nativeEvent.locationX),
    }),
  ).current;

  const onLayout = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.width;
    widthRef.current = measured;
    setWidth(measured);
  };

  return (
    <View
      style={[styles.frame, { height }]}
      onLayout={onLayout}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${beforeLabel} / ${afterLabel}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(position) }}
      {...responder.panHandlers}
    >
      <Image source={{ uri: afterUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />

      <View style={[styles.beforeClip, { width: (width * position) / 100 }]}>
        <Image
          source={{ uri: beforeUri }}
          style={[styles.beforeImage, { width: width || 1 }]}
          resizeMode="cover"
        />
      </View>

      <View style={[styles.divider, { left: `${position}%` }, { pointerEvents: "none" }]}>
        <View style={styles.handle}>
          <Text style={styles.handleGlyph}>↔</Text>
        </View>
      </View>

      <Text style={[styles.badge, styles.badgeLeft, { pointerEvents: "none" }]}>
        {beforeLabel}
      </Text>
      <Text style={[styles.badge, styles.badgeRight, { pointerEvents: "none" }]}>
        {afterLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: palette.ink800,
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.16),
  },
  beforeClip: { position: "absolute", left: 0, top: 0, bottom: 0, overflow: "hidden" },
  beforeImage: { position: "absolute", left: 0, top: 0, bottom: 0 },
  divider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: alpha(palette.pearl, 0.9),
  },
  handle: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 40,
    height: 40,
    marginLeft: -20,
    marginTop: -20,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha(palette.ink950, 0.8),
  },
  handleGlyph: { color: palette.pearl, fontSize: 15 },
  badge: {
    position: "absolute",
    top: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: alpha(palette.ink950, 0.7),
    color: palette.pearl,
    fontSize: 11,
  },
  badgeLeft: { left: 10 },
  badgeRight: { right: 10 },
});
