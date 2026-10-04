import { useMemo } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { GlassCard } from "../src/components/GlassCard";
import { PearlButton } from "../src/components/PearlButton";
import { alpha, palette, radii, shadows, spacing, type } from "../src/theme";
import { tagLabel } from "@/lib/tags";
import type { Look } from "@/lib/types";

interface LookScrollerProps {
  looks: Look[];
  selectedLookId: string | null;
  onSelectLook: (lookId: string | null) => void;
}

export function LookScroller({ looks, selectedLookId, onSelectLook }: LookScrollerProps) {
  const data = useMemo(() => looks, [looks]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Portfolio</Text>
      <Text style={styles.sectionBody}>Browse my recent work or start from a surprise.</Text>

      {data.length === 0 ? (
        <Text style={styles.hint}>No looks yet. Upload your first design to get started.</Text>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          renderItem={({ item }) => {
            const active = item.id === selectedLookId;
            return (
              <Pressable
                onPress={() => onSelectLook(item.id)}
                style={[styles.card, active && styles.cardActive]}
              >
                <Image source={{ uri: item.image_url }} style={styles.image} />
                <Text style={styles.meta} numberOfLines={2}>
                  {item.tags.map((tag) => tagLabel(tag)).join(" · ")}
                </Text>
                <Text style={styles.price}>From ${item.base_price}</Text>
              </Pressable>
            );
          }}
        />
      )}

      <Pressable
        onPress={() => onSelectLook(null)}
        style={[styles.surprise, selectedLookId === null && styles.surpriseActive]}
      >
        <Text style={styles.surpriseTitle}>Surprise Me</Text>
        <Text style={styles.surpriseBody}>Let the AI pick a random design</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionTitle: { ...type.body, color: palette.pearl, fontSize: 16, fontWeight: "700" },
  sectionBody: { ...type.body, color: palette.ash, fontSize: 12, lineHeight: 18 },
  hint: { ...type.body, color: palette.ash, fontSize: 12 },
  rail: { gap: spacing.sm, paddingVertical: spacing.xs },
  card: {
    width: 148,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: alpha(palette.pearl, 0.05),
    padding: spacing.sm,
    gap: spacing.xs,
    overflow: "hidden",
  },
  cardActive: { borderColor: palette.rose, backgroundColor: alpha(palette.rose, 0.16) },
  image: { width: "100%", aspectRatio: 4 / 5, borderRadius: radii.md },
  meta: { ...type.body, color: palette.ash, fontSize: 11, lineHeight: 15 },
  price: { ...type.body, color: palette.ashDim, fontSize: 11 },
  surprise: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: alpha(palette.pearl, 0.25),
    backgroundColor: alpha(palette.pearl, 0.03),
    gap: spacing.xs,
  },
  surpriseActive: { borderColor: palette.rose, backgroundColor: alpha(palette.rose, 0.1) },
  surpriseTitle: { ...type.body, color: palette.pearl, fontSize: 14, fontWeight: "600" },
  surpriseBody: { ...type.body, color: palette.ash, fontSize: 12 },
});
