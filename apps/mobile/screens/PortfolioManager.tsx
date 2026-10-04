import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { memo, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { TagSelector } from "../components/TagSelector";
import { COMPLEXITY_LEVELS, tagLabel } from "@/lib/tags";
import type { ComplexityLevel, Look } from "@/lib/types";
import { fetchLooks, uploadLook } from "../src/lib/api";
import { useLocale } from "../src/i18n/LocaleProvider";
import { GlassCard } from "../src/components/GlassCard";
import { PearlButton } from "../src/components/PearlButton";
import { alpha, palette, radii, shadows, spacing, type } from "../src/theme";

const THUMB_HEIGHT = 140;

const LookCard = memo(function LookCard({ item }: { item: Look }) {
  return (
    <View style={styles.card}>
      <Image source={{ uri: item.image_url }} style={styles.thumb} />
      <View style={styles.cardBody}>
        {item.tags.map((tag) => (
          <Text key={tag} style={styles.tag}>
            {tagLabel(tag)}
          </Text>
        ))}
        {item.complexity_level ? (
          <Text style={styles.complexityCaption}>{item.complexity_level}</Text>
        ) : null}
      </View>
    </View>
  );
});

/**
 * Screen 2.1 — Portfolio & Tag Manager.
 * Photos go to the `portfolio-looks` bucket; tags come from the shared
 * dictionary so the AI generator can only ever propose feasible designs.
 */
export function PortfolioManager() {
  const { t } = useLocale();
  const [looks, setLooks] = useState<Look[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [complexity, setComplexity] = useState<ComplexityLevel>("medium");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLooks((await fetchLooks()) ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t.artist.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const pickAndUpload = useCallback(async () => {
    if (selectedTags.length === 0) {
      Alert.alert(t.artist.tagFirstTitle, t.artist.tagFirstBody);
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t.artist.permissionTitle, t.artist.permissionBody);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    if (!asset) return;

    setIsUploading(true);
    try {
      const look = await uploadLook({
        uri: asset.uri,
        fileName: asset.fileName ?? `look-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
        tags: selectedTags,
        complexityLevel: complexity,
      });
      setLooks((current) => [look, ...current]);
      setSelectedTags([]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (uploadError) {
      Alert.alert(
        t.artist.uploadErrorTitle,
        uploadError instanceof Error ? uploadError.message : t.artist.tryAgain,
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsUploading(false);
    }
  }, [complexity, selectedTags, t]);

  const generateAndUpload = useCallback(async () => {
    if (selectedTags.length === 0) {
      Alert.alert(t.artist.tagFirstTitle, t.artist.tagFirstBody);
      return;
    }

    setIsUploading(true);
    try {
      const look = await uploadLook({
        uri: "",
        fileName: `generated-${Date.now()}.jpg`,
        mimeType: "image/jpeg",
        tags: selectedTags,
        complexityLevel: complexity,
        generateImage: true,
      });
      setLooks((current) => [look, ...current]);
      setSelectedTags([]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (uploadError) {
      Alert.alert(
        t.artist.uploadErrorTitle,
        uploadError instanceof Error ? uploadError.message : t.artist.tryAgain,
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsUploading(false);
    }
  }, [complexity, selectedTags, t]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.artist.portfolioTitle}</Text>
        <Text style={styles.subtitle}>
          {looks.length} {looks.length === 1 ? t.artist.look : t.artist.looks} · {t.artist.tagDrivesAi}
        </Text>
      </View>

      <GlassCard style={styles.composer}>
        <TagSelector value={selectedTags} onChange={setSelectedTags} />

        <View style={styles.complexityRow}>
          {COMPLEXITY_LEVELS.map((level) => (
            <Pressable
              key={level}
              onPress={() => setComplexity(level)}
              accessibilityRole="radio"
              accessibilityState={{ selected: complexity === level }}
              style={[styles.complexityChip, complexity === level && styles.complexityChipActive]}
            >
              <Text style={[styles.complexityText, complexity === level && styles.complexityTextActive]}>
                {level}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.buttonRow}>
          <PearlButton
            label={t.artist.addLookButton}
            onPress={() => void pickAndUpload()}
            loading={isUploading}
            style={styles.button}
          />
        </View>
      </GlassCard>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={palette.rose} />
      ) : (
        <FlatList
          data={looks}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          removeClippedSubviews
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={50}
          initialNumToRender={4}
          windowSize={4}
          getItemLayout={(_data, index) => ({
            length: THUMB_HEIGHT + 60,
            offset: (THUMB_HEIGHT + 60 + spacing.md) * Math.floor(index / 2),
            index,
          })}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>{t.artist.portfolioEmpty}</Text>}
          renderItem={({ item }) => <LookCard item={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.md },
  header: { gap: spacing.xs },
  title: { ...type.display, color: palette.pearl, fontSize: 24, letterSpacing: 0.6 },
  subtitle: { ...type.body, color: palette.ash, fontSize: 13 },
  composer: { gap: spacing.md },
  buttonRow: { flexDirection: "row", gap: spacing.sm },
  button: { flex: 1 },
  complexityRow: { flexDirection: "row", gap: spacing.sm },
  complexityChip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.22),
    backgroundColor: alpha(palette.pearl, 0.05),
  },
  complexityChipActive: { backgroundColor: palette.mint, borderColor: palette.mint, ...shadows.glow },
  complexityText: { ...type.body, color: palette.blush, fontSize: 12, textTransform: "uppercase" },
  complexityTextActive: { color: palette.ink900, fontWeight: "700" },
  error: { ...type.body, color: palette.danger, fontSize: 13 },
  loader: { marginTop: spacing.xl },
  list: { gap: spacing.md, paddingBottom: spacing.xl },
  row: { gap: spacing.md },
  card: {
    flex: 1,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: alpha(palette.ink800, 0.66),
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.16),
    ...shadows.card,
  },
  thumb: { width: "100%", height: 140, backgroundColor: palette.ink700 },
  cardBody: { padding: spacing.md, gap: 2 },
  tag: { ...type.body, color: palette.blush, fontSize: 12 },
  complexityCaption: { ...type.body, color: palette.mint, fontSize: 11, textTransform: "uppercase" },
  empty: { ...type.body, color: palette.ash, textAlign: "center", marginTop: spacing.xl },
});
