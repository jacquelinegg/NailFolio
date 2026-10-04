import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { searchByStyle, type StyleSearchResult } from "../../src/lib/clientApi";
import { useDynamicTranslation } from "../../src/hooks/useDynamicTranslation";
import { useLocale } from "../../src/i18n/LocaleProvider";
import { GlassCard } from "../../src/components/GlassCard";
import { alpha, palette, radii, shadows, spacing, type } from "../../src/theme";
import { tagLabel } from "../../../../lib/tags";
import type { Artist } from "@/lib/types";

/**
 * Client step 0b — find an artist from a photo of the nails you like.
 *
 * The image goes straight to the Next.js app, which analyses it into the shared
 * tag vocabulary and scores it against every artist's real portfolio. Nothing
 * is persisted: the photo is posted, read and dropped, so a customer never
 * uploads a picture of their hands just to browse.
 */
export function StyleSearch({ onSelect }: { onSelect: (artist: Artist) => void }) {
  const { t } = useLocale();
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StyleSearchResult | null>(null);

  const allTags = result ? [...result.baseTags, ...result.techniqueTags] : [];
  const [summary] = useDynamicTranslation(result ? [result.summary] : []);
  const [tagNames] = useDynamicTranslation(allTags);

  const pick = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t.search.error);
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      // The analyser only needs a recognisable close-up; downscaling keeps the
      // upload fast on a phone connection and well under the 12MB server limit.
      quality: 0.7,
    });
    if (picked.canceled) return;

    setPhoto(picked.assets[0] ?? null);
    setResult(null);
    setError(null);
  }, [t]);

  const analyse = useCallback(async () => {
    if (!photo) return;

    setIsAnalysing(true);
    setError(null);

    try {
      setResult(
        await searchByStyle({
          uri: photo.uri,
          fileName: photo.fileName ?? "reference.jpg",
          mimeType: photo.mimeType ?? "image/jpeg",
        }),
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError(t.search.error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsAnalysing(false);
    }
  }, [photo, t]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t.search.title}</Text>
      <Text style={styles.subtitle}>{t.search.body}</Text>

      {photo ? (
        <View style={styles.previewWrapper}>
          <Image source={{ uri: photo.uri }} style={styles.preview} />
          <Pressable
            onPress={() => void pick()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryLabel}>{t.search.changePhoto}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => void pick()}
          accessibilityRole="button"
          style={({ pressed }) => [styles.dropzone, pressed && styles.dropzonePressed]}
        >
          <Text style={styles.dropHint}>{t.search.dropHint}</Text>
          <Text style={styles.formats}>{t.search.formats}</Text>
        </Pressable>
      )}

      <Pressable
        onPress={() => void analyse()}
        disabled={!photo || isAnalysing}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.cta,
          (!photo || isAnalysing) && styles.ctaDisabled,
          pressed && styles.pressed,
        ]}
      >
        <LinearGradient
          colors={[palette.pearl, palette.blush, palette.rose]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {isAnalysing ? (
          <ActivityIndicator color={palette.ink900} />
        ) : (
          <Text style={styles.ctaLabel}>{t.search.analyse}</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {result?.summary ? <Text style={styles.summary}>{summary}</Text> : null}

      {result && allTags.length > 0 ? (
        <Text style={styles.tags}>
          {t.search.matchedStyles}: {allTags.map((tag, index) => tagNames[index] ?? tagLabel(tag)).join(" · ")}
        </Text>
      ) : null}

      {result && result.matches.length === 0 ? (
        <Text style={styles.empty}>
          {allTags.length === 0 ? t.search.noAnalysis : t.search.noResults}
        </Text>
      ) : null}

      {result?.matches.map((match) => (
        <Pressable
          key={match.artistId}
          onPress={() => {
            void Haptics.selectionAsync();
            onSelect({
              id: match.artistId,
              display_name: match.displayName,
              handle: match.handle,
              base_price: match.basePrice,
              share_token: match.shareToken,
            } as Artist);
          }}
          accessibilityRole="button"
        >
          <GlassCard style={styles.card}>
            <Text style={styles.name}>{match.displayName}</Text>
            <Text style={styles.handle}>@{match.handle}</Text>
            <Text style={styles.price}>
              {t.client.fromPrice} {match.basePrice} {t.home.lev}
            </Text>
            <Text style={styles.score}>
              {match.score}% {t.search.matchScore} · {match.matchedTags.map((tag) => tagLabel(tag)).join(" · ")}
            </Text>
          </GlassCard>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  title: { ...type.display, color: palette.pearl, fontSize: 26, letterSpacing: 0.6 },
  subtitle: { ...type.body, color: palette.ash, fontSize: 13, lineHeight: 19 },
  previewWrapper: { gap: spacing.sm },
  preview: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.2),
  },
  dropzone: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: alpha(palette.blush, 0.28),
    gap: spacing.xs,
  },
  dropzonePressed: { backgroundColor: alpha(palette.blush, 0.08) },
  dropHint: { ...type.body, color: palette.pearl, fontSize: 15, fontWeight: "600" },
  formats: { ...type.body, color: palette.ash, fontSize: 12 },
  cta: {
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: "center",
    overflow: "hidden",
    ...shadows.glow,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaLabel: { fontFamily: type.body.fontFamily, color: palette.ink900, fontWeight: "500", fontSize: 15, letterSpacing: 0.2 },
  secondary: {
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    alignItems: "center",
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.35),
    backgroundColor: alpha(palette.pearl, 0.04),
  },
  secondaryLabel: { fontFamily: type.body.fontFamily, color: palette.blush, fontSize: 14, fontWeight: "500", letterSpacing: 0.2 },
  pressed: { opacity: 0.85 },
  error: { ...type.body, color: palette.danger, fontSize: 13 },
  summary: { ...type.body, color: palette.pearl, fontSize: 14, lineHeight: 20 },
  tags: { ...type.body, color: palette.ash, fontSize: 12, lineHeight: 18 },
  empty: { ...type.body, color: palette.ash, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  card: { gap: 2 },
  name: { ...type.body, color: palette.pearl, fontSize: 16, fontWeight: "700" },
  handle: { ...type.body, color: palette.ash, fontSize: 13 },
  price: { ...type.body, color: palette.blush, fontSize: 14, marginTop: spacing.xs },
  score: { ...type.body, color: palette.ash, fontSize: 12, marginTop: spacing.xs },
});
