import { Pressable, StyleSheet, Text, View } from "react-native";

import { LOCALES, type Locale } from "./config";
import { useLocale } from "./LocaleProvider";
import { alpha, palette, radii, shadows, spacing, type } from "../theme";

/**
 * Compact BG | EN toggle for the artist app header, matching the web control.
 * The active option is filled and carries `accessibilityState.selected`.
 */
export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();

  return (
    <View
      style={styles.container}
      accessibilityLabel={t.language.label}
    >
      {LOCALES.map((code: Locale) => {
        const active = code === locale;
        return (
          <Pressable
            key={code}
            onPress={() => setLocale(code)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.option, active && styles.optionActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {code === "bg" ? t.language.bg : t.language.en}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    padding: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.16),
    backgroundColor: alpha(palette.pearl, 0.05),
  },
  option: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  optionActive: {
    backgroundColor: palette.blush,
    borderColor: palette.rose,
    ...shadows.chip,
  },
  label: { ...type.body, fontSize: 12, fontWeight: "600", color: palette.blush },
  labelActive: { color: palette.ink900, fontWeight: "700" },
});
