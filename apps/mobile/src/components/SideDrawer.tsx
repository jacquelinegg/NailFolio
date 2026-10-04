import { useCallback, useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { Animated, Easing } from "react-native";

import { alpha, palette, spacing, type } from "../theme";

const DRAWER_WIDTH = 260;
const BACKDROP_OPACITY = 0.45;
const DURATION = 220;

interface SideDrawerProps {
  open: boolean;
  onClose: () => void;
  items: { label: string; onPress: () => void }[];
  footer?: React.ReactNode;
}

export function SideDrawer({ open, onClose, items, footer }: SideDrawerProps) {
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: open ? 0 : -DRAWER_WIDTH,
        duration: DURATION,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(backdropOpacity, {
        toValue: open ? BACKDROP_OPACITY : 0,
        duration: DURATION,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  }, [open, translateX, backdropOpacity]);

  const handleBackdropPress = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <>
      {open ? (
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={styles.backdropPressable} onPress={handleBackdropPress} />
          <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
            <View style={styles.content}>
              {items.map((item, index) => (
                <Pressable key={index} onPress={item.onPress} style={styles.item}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = {
  backdrop: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.ink950,
    zIndex: 50,
  },
  backdropPressable: {
    flex: 1,
  },
  drawer: {
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: alpha(palette.ink950, 0.92),
    borderRightWidth: 1,
    borderRightColor: alpha(palette.blush, 0.18),
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    zIndex: 60,
  },
  content: {
    gap: spacing.xs,
  },
  item: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
  },
  itemLabel: {
    ...type.body,
    color: palette.pearl,
    fontSize: 15,
    fontWeight: "500" as const,
    letterSpacing: 0.2,
  },
  footer: {
    marginTop: "auto" as const,
  },
};
