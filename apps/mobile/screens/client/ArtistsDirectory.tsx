import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { listArtists } from "../../src/lib/clientApi";
import { useLocale } from "../../src/i18n/LocaleProvider";
import { GlassCard } from "../../src/components/GlassCard";
import { alpha, palette, radii, spacing, type } from "../../src/theme";
import type { Artist } from "@/lib/types";

/**
 * Client step 0 — the public artist directory.
 *
 * Reads `artists` with the anon key, exactly like the web `/artists` page; RLS
 * exposes a public read policy, so no secret is involved.
 */
export function ArtistsDirectory({ onSelect }: { onSelect: (artist: Artist) => void }) {
  const { t } = useLocale();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setArtists(await listArtists());
      setError(null);
    } catch {
      setError(t.artist.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return <ActivityIndicator style={styles.loader} color={palette.rose} />;
  }

  return (
    <FlatList
      data={artists}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>{t.client.artistsTitle}</Text>
          <Text style={styles.subtitle}>{t.client.artistsBody}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>{t.client.artistsEmpty}</Text>}
      renderItem={({ item }) => (
        <GlassCard style={styles.card}>
          <Text style={styles.name}>{item.display_name}</Text>
          <Text style={styles.handle}>@{item.handle}</Text>
          <Text style={styles.price}>
            {t.client.fromPrice} {item.base_price} {t.home.lev}
          </Text>
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              onSelect(item);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaLabel}>{t.client.tryStyle}</Text>
          </Pressable>
        </GlassCard>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  loader: { marginTop: spacing.xxl },
  header: { gap: spacing.xs, marginBottom: spacing.sm },
  title: { ...type.display, color: palette.pearl, fontSize: 26, letterSpacing: 0.6 },
  subtitle: { ...type.body, color: palette.ash, fontSize: 13, lineHeight: 19 },
  error: { ...type.body, color: palette.danger, fontSize: 13, marginTop: spacing.xs },
  empty: { ...type.body, color: palette.ash, textAlign: "center", marginTop: spacing.xl },
  card: { gap: 2 },
  name: { ...type.body, color: palette.pearl, fontSize: 16, fontWeight: "700" },
  handle: { ...type.body, color: palette.ash, fontSize: 13 },
  price: { ...type.body, color: palette.blush, fontSize: 14, marginTop: spacing.xs },
  cta: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: "center",
    backgroundColor: palette.blush,
  },
  ctaPressed: { opacity: 0.85 },
  ctaLabel: { ...type.body, color: palette.ink900, fontWeight: "700", fontSize: 14 },
});
