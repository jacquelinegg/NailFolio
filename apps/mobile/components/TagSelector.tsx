import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { BASE_STYLE_TAGS, tagLabel, TECHNIQUE_TAGS } from "@/lib/tags";
import { alpha, palette, radii, shadows, spacing, type } from "../src/theme";

export interface TagSelectorProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Multi-select tag picker.
 * The vocabulary is imported straight from `lib/tags.ts` — the same list the AI
 * generator and the pricing engine use, so a look can never be tagged with
 * something the engine cannot price.
 */
export function TagSelector({ value, onChange }: TagSelectorProps) {
  const [group, setGroup] = useState<"base" | "technique">("base");

  const options = useMemo(
    () => (group === "base" ? BASE_STYLE_TAGS : TECHNIQUE_TAGS),
    [group],
  );

  const toggle = (tag: string) => {
    onChange(value.includes(tag) ? value.filter((item) => item !== tag) : [...value, tag]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {(["base", "technique"] as const).map((key) => (
          <Pressable
            key={key}
            onPress={() => setGroup(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: group === key }}
            style={[styles.tab, group === key && styles.tabActive]}
          >
            <Text style={[styles.tabText, group === key && styles.tabTextActive]}>
              {key === "base" ? "Base styles" : "Techniques"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.chipRow}>
        {options.map((tag) => {
          const selected = value.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => toggle(tag)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {tagLabel(tag)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {value.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.summaryScroll}>
          <Text style={styles.summary}>
            {value.length} selected: {value.map(tagLabel).join(", ")}
          </Text>
        </ScrollView>
      ) : (
        <Text style={styles.summary}>Pick at least one base style and one technique.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  tabs: { flexDirection: "row", gap: spacing.sm },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.22),
    backgroundColor: alpha(palette.pearl, 0.05),
  },
  tabActive: { backgroundColor: palette.blush, borderColor: palette.rose, ...shadows.glow },
  tabText: { ...type.body, color: palette.blush, fontSize: 13 },
  tabTextActive: { color: palette.ink900, fontWeight: "700" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.18),
    backgroundColor: alpha(palette.ink800, 0.7),
  },
  chipSelected: {
    backgroundColor: palette.rose,
    borderColor: palette.pearl,
    ...shadows.glow,
  },
  chipText: { ...type.body, color: palette.ash, fontSize: 13 },
  chipTextSelected: { color: palette.ink900, fontWeight: "700" },
  summaryScroll: { maxHeight: 24 },
  summary: { ...type.body, color: palette.ashDim, fontSize: 12 },
});
