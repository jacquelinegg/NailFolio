import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  createSession,
  generateSurprise,
  listLooks,
  renderTryOn,
  uploadHandPhoto,
} from "../../src/lib/clientApi";
import { getApiUrl } from "../../src/config";
import { useLocale } from "../../src/i18n/LocaleProvider";
import { BeforeAfterCompare } from "../../src/components/BeforeAfterCompare";
import { useDynamicTranslation } from "../../src/hooks/useDynamicTranslation";
import { GlassCard } from "../../src/components/GlassCard";
import { PearlButton } from "../../src/components/PearlButton";
import { CalendarPicker } from "../../src/components/CalendarPicker";
import { alpha, palette, radii, shadows, spacing, type } from "../../src/theme";
import { tagLabel } from "@/lib/tags";
import type { Artist, ArtistAwareDesign, Look } from "@/lib/types";

const DAYS_AHEAD = 30;

type Phase = "idle" | "designing" | "rendering" | "ready" | "design-only";

function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** `mins` is passed in so the unit follows the active language. */
function durationLabel(mins: number, unit: string): string {
  if (mins < 60) return `${mins} ${unit}`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} ${unit}`;
}

/**
 * The client funnel: pick a look -> hand photo -> AI try-on -> booking request.
 *
 * Mirrors the web `BookingStudio` (`LookScroller`, `HandPhotoUpload`,
 * `AITryOnStudio`, `CheckoutSummary`) as one scrolling screen, because on a phone
 * the steps read better stacked than paginated. A failed render never loses the
 * design: the customer can still book it and the artist confirms the finish on
 * the day.
 */
export function BookingStudio({
  artist,
  onBooked,
  onBack,
}: {
  artist: Artist;
  onBooked: (token: string) => void;
  onBack: () => void;
}) {
  const { t, locale } = useLocale();

  const [looks, setLooks] = useState<Look[]>([]);
  const [selectedLookId, setSelectedLookId] = useState<string | null>(null);

  const [handPhotoUrl, setHandPhotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [design, setDesign] = useState<ArtistAwareDesign | null>(null);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [studioError, setStudioError] = useState<string | null>(null);

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: DAYS_AHEAD }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      return date;
    });
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedHour, setSelectedHour] = useState<string>("10");
  const [selectedMinute, setSelectedMinute] = useState<string>("00");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const renderSteps = useMemo(
    () => [t.client.renderStepOne, t.client.renderStepTwo, t.client.renderStepThree],
    [t],
  );

  // --- Step 1: the artist's portfolio --------------------------------------

  useEffect(() => {
    let cancelled = false;
    void listLooks(artist.id)
      .then((rows) => {
        if (!cancelled) setLooks(rows);
      })
      .catch(() => {
        // The rail degrades to the surprise-only state rather than blocking the
        // funnel: a client can still book without browsing a portfolio.
        if (!cancelled) setLooks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [artist.id]);

  /**
   * Switching look invalidates everything derived from the previous one, so the
   * design and its render are dropped rather than left describing another look.
   */
  const selectLook = useCallback((lookId: string | null) => {
    setSelectedLookId(lookId);
    setDesign(null);
    setRenderedUrl(null);
    setPhase("idle");
  }, []);

  // --- Step 2: hand photo -------------------------------------------------

  const pickPhoto = useCallback(
    async (fromCamera: boolean) => {
      setStudioError(null);

      if (fromCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(t.artist.permissionTitle, t.artist.permissionBody);
          return;
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(t.artist.permissionTitle, t.artist.permissionBody);
          return;
        }
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.9 });

      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      if (!asset) return;

      setIsUploading(true);
      try {
        const url = await uploadHandPhoto({
          uri: asset.uri,
          fileName: asset.fileName ?? `hand-${Date.now()}.jpg`,
          mimeType: asset.mimeType ?? "image/jpeg",
        });
        setHandPhotoUrl(url);
      } catch (uploadError) {
        setStudioError(
          uploadError instanceof Error ? uploadError.message : t.artist.uploadErrorTitle,
        );
      } finally {
        setIsUploading(false);
      }
    },
    [t],
  );

  // --- Step 3: AI try-on + render -----------------------------------------

  const generate = useCallback(async () => {
    if (!handPhotoUrl) return;

    setStudioError(null);
    setPhase("designing");
    setStepIndex(0);

    let nextDesign: ArtistAwareDesign;
    try {
      nextDesign = await generateSurprise(artist.id, selectedLookId);
    } catch (designError) {
      setStudioError(designError instanceof Error ? designError.message : t.client.rendering);
      setPhase("idle");
      return;
    }

    setDesign(nextDesign);
    setPhase("rendering");
    setStepIndex(0);

    const ticker = setInterval(() => {
      setStepIndex((index) => Math.min(index + 1, renderSteps.length - 1));
    }, 4_000);

    try {
      const url = await renderTryOn(handPhotoUrl, nextDesign.refImageUrl);
      setRenderedUrl(url);
      setPhase("ready");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (renderError) {
      setStudioError(renderError instanceof Error ? renderError.message : t.client.rendering);
      setPhase("design-only");
    } finally {
      clearInterval(ticker);
    }
  }, [artist.id, handPhotoUrl, renderSteps, selectedLookId, t]);

  // --- Step 4: booking ----------------------------------------------------

  const canSubmit = Boolean(
    design && handPhotoUrl && selectedDate && clientName.trim() && clientPhone.trim(),
  );

  const submit = useCallback(async () => {
    if (!design || !handPhotoUrl || !selectedDate) return;

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const normalizedHour = Math.max(0, Math.min(23, Number(selectedHour) || 0));
      const normalizedMinute = Math.max(0, Math.min(59, Number(selectedMinute) || 0));

      const slot = new Date(selectedDate);
      slot.setHours(normalizedHour, normalizedMinute, 0, 0);

      const token = await createSession({
        artistId: artist.id,
        clientHandImageUrl: handPhotoUrl,
        renderedResultUrl: renderedUrl,
        generatedPrompt: design.prompt,
        priceEstimate: design.estimate,
        usedTags: design.usedTags,
        complexity: design.complexity,
        selectedLookId: design.sourceLookId ?? null,
        requestedAppointmentTime: slot.toISOString(),
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail.trim() || null,
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onBooked(token);
    } catch (submitFailure) {
      setSubmitError(
        submitFailure instanceof Error ? submitFailure.message : t.client.stepFourBody,
      );
      setIsSubmitting(false);
    }
  }, [
    artist.id,
    clientEmail,
    clientName,
    clientPhone,
    design,
    handPhotoUrl,
    onBooked,
    renderedUrl,
    selectedDate,
    selectedHour,
    selectedMinute,
    t,
  ]);

  const isBusy = phase === "designing" || phase === "rendering";
  const estimate = design?.estimate ?? null;

  // The design copy is AI-generated, so its wording is not fixed: translate it
  // at runtime rather than shipping a catalogue entry for something unbounded.
  const [designText] = useDynamicTranslation(design ? [design.description] : []);

  // Receipt labels are produced server-side in one language and stored on the
  // session, so they are translated at display time rather than at write time.
  const lineLabels = useDynamicTranslation(estimate?.lineItems.map((item) => item.label) ?? []);

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.topBar}>
        <Pressable onPress={onBack} accessibilityRole="button" style={styles.back}>
          <Text style={styles.backLabel}>←</Text>
        </Pressable>
        <Text style={styles.brand}>NailFolio</Text>
      </View>

      <Text style={styles.artistName}>{artist.display_name}</Text>
      <Text style={styles.intro}>{t.client.studioIntro}</Text>

      {/* 1. Portfolio ---------------------------------------------------- */}
      <GlassCard style={styles.section}>
        <Text style={styles.sectionTitle}>{t.client.looksTitle}</Text>
        <Text style={styles.sectionBody}>{t.client.looksBody}</Text>

        {looks.length === 0 ? (
          <Text style={styles.hint}>{t.client.looksEmpty}</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
          >
            <Pressable
              onPress={() => selectLook(null)}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedLookId === null }}
              style={[styles.lookCard, styles.surpriseCard, selectedLookId === null && styles.lookCardActive]}
            >
              <Text style={styles.lookTitle}>{t.client.looksSurpriseTitle}</Text>
              <Text style={styles.lookMeta}>{t.client.looksSurpriseBody}</Text>
            </Pressable>

            {looks.map((look) => {
              const active = look.id === selectedLookId;
              return (
                <Pressable
                  key={look.id}
                  onPress={() => selectLook(look.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.lookCard, active && styles.lookCardActive]}
                >
                  <Image source={{ uri: look.image_url }} style={styles.lookImage} />
                  <Text style={styles.lookMeta} numberOfLines={2}>
                    {look.tags.map((tag) => tagLabel(tag)).join(" · ")}
                  </Text>
                  <Text style={styles.lookPrice}>
                    {t.client.fromPrice} {look.base_price} {t.home.lev}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </GlassCard>

      {/* 2. Hand photo --------------------------------------------------- */}
      <GlassCard style={styles.section}>
        <Text style={styles.sectionTitle}>{t.client.stepOneTitle}</Text>
        <Text style={styles.sectionBody}>{t.client.stepOneBody}</Text>

        {handPhotoUrl ? (
          <>
            <Image source={{ uri: handPhotoUrl }} style={styles.preview} />
            <View style={styles.buttonRow}>
              <Pressable onPress={() => void pickPhoto(true)} style={styles.secondary}>
                <Text style={styles.secondaryLabel}>{t.client.retakePhoto}</Text>
              </Pressable>
              <Pressable onPress={() => void pickPhoto(false)} style={styles.secondary}>
                <Text style={styles.secondaryLabel}>{t.client.chooseFromLibrary}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.dropZone}>
            {/* Example shot, served by the web app so both dropzones show the
                same photograph. Decorative: the hint below describes the step. */}
            <Image
              source={{ uri: getApiUrl("/hand.png") }}
              style={styles.dropShot}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <Text style={styles.dropHint}>{t.client.photoHint}</Text>
            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => void pickPhoto(true)}
                disabled={isUploading}
                style={styles.primary}
              >
                <LinearGradient
                  colors={[palette.pearl, palette.blush, palette.rose]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.primaryLabel}>{t.client.takePhoto}</Text>
              </Pressable>
              <Pressable
                onPress={() => void pickPhoto(false)}
                disabled={isUploading}
                style={styles.secondary}
              >
                <Text style={styles.secondaryLabel}>{t.client.chooseFromLibrary}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {isUploading ? (
          <Text style={styles.status}>{t.client.uploadingPhoto}</Text>
        ) : null}
      </GlassCard>

      {/* 3. AI try-on ---------------------------------------------------- */}
      <GlassCard style={styles.section}>
        <Text style={styles.sectionTitle}>{t.client.stepThreeTitle}</Text>
        <Text style={styles.sectionBody}>
          {selectedLookId ? t.client.stepThreeBodyPicked : t.client.stepThreeBody}
        </Text>

        <View style={styles.surpriseWrap}>
          <PearlButton
            label={
              isBusy
                ? t.client.rendering
                : selectedLookId
                  ? t.client.tryThisLook
                  : t.client.surpriseButton
            }
            onPress={() => void generate()}
            disabled={!handPhotoUrl || isBusy}
            loading={isBusy}
          />
        </View>

        {!handPhotoUrl ? <Text style={styles.hint}>{t.client.needsPhoto}</Text> : null}

        {isBusy ? (
          <View style={styles.progress}>
            <ActivityIndicator color={palette.rose} />
            <Text style={styles.status}>
              {phase === "rendering"
                ? renderSteps[stepIndex] ?? t.client.stepReadPortfolio
                : t.client.stepReadPortfolio}
            </Text>
          </View>
        ) : null}

        {studioError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{studioError}</Text>
            <Pressable onPress={() => void generate()} style={styles.secondary}>
              <Text style={styles.secondaryLabel}>{t.common.retry}</Text>
            </Pressable>
          </View>
        ) : null}

        {design ? (
          <View style={styles.designBox}>
            <Text style={styles.designText}>{designText}</Text>
            <View style={styles.tagRow}>
              {design.usedTags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagLabel}>{tagLabel(tag)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {handPhotoUrl && renderedUrl ? (
          <View style={styles.compareWrap}>
            <BeforeAfterCompare
              beforeUri={handPhotoUrl}
              afterUri={renderedUrl}
              beforeLabel={t.client.beforeLabel}
              afterLabel={t.client.afterLabel}
            />
          </View>
        ) : null}

        {phase === "design-only" ? (
          <Text style={styles.hint}>{t.client.designOnlyNote}</Text>
        ) : null}
      </GlassCard>

      {/* 4. Booking ------------------------------------------------------ */}
      <GlassCard style={styles.section}>
        <Text style={styles.sectionTitle}>{t.client.stepFourTitle}</Text>
        <Text style={styles.sectionBody}>{t.client.stepFourBody}</Text>

        {estimate ? (
          <View style={styles.receipt}>
            <Text style={styles.receiptTitle}>{t.client.estimatedPrice}</Text>
            {estimate.lineItems.map((item, index) => (
              <View key={item.label} style={styles.receiptLine}>
                <Text style={styles.receiptLabel}>{lineLabels[index] ?? item.label}</Text>
                <Text style={styles.receiptAmount}>{money(item.amount)}</Text>
              </View>
            ))}
            <View style={[styles.receiptLine, styles.receiptTotal]}>
              <Text style={styles.receiptTotalLabel}>{t.client.total}</Text>
              <Text style={styles.receiptTotalAmount}>{money(estimate.total)}</Text>
            </View>
            <Text style={styles.receiptDuration}>
              {t.client.estimatedDuration}: {durationLabel(estimate.durationMins, t.artist.mins)}
            </Text>
          </View>
        ) : (
          <Text style={styles.hint}>{t.client.generateForPrice}</Text>
        )}

        <Text style={styles.fieldLabel}>{t.client.pickDay}</Text>
        <CalendarPicker selectedDate={selectedDate} onSelectDate={setSelectedDate} daysAhead={30} />

        <Text style={styles.fieldLabel}>{t.client.pickTime}</Text>
        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <TextInput
              value={selectedHour}
              onChangeText={setSelectedHour}
              placeholder="09"
              placeholderTextColor={palette.ashDim}
              keyboardType="number-pad"
              maxLength={2}
              style={styles.timeInput}
            />
            <Text style={styles.timeSeparator}>:</Text>
            <TextInput
              value={selectedMinute}
              onChangeText={setSelectedMinute}
              placeholder="00"
              placeholderTextColor={palette.ashDim}
              keyboardType="number-pad"
              maxLength={2}
              style={styles.timeInput}
            />
          </View>
        </View>

        <Text style={styles.fieldLabel}>{t.client.yourName}</Text>
        <TextInput
          value={clientName}
          onChangeText={setClientName}
          placeholder="Alex Rivera"
          placeholderTextColor={palette.ashDim}
          maxLength={120}
          style={styles.input}
        />

        <Text style={styles.fieldLabel}>{t.client.phone}</Text>
        <TextInput
          value={clientPhone}
          onChangeText={setClientPhone}
          placeholder="+1 555 010 2024"
          placeholderTextColor={palette.ashDim}
          keyboardType="phone-pad"
          maxLength={32}
          style={styles.input}
        />

        <Text style={styles.fieldLabel}>{t.client.emailOptional}</Text>
        <TextInput
          value={clientEmail}
          onChangeText={setClientEmail}
          placeholder="alex@example.com"
          placeholderTextColor={palette.ashDim}
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={320}
          style={styles.input}
        />

        {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

        <View style={styles.submitWrap}>
          <PearlButton
            label={isSubmitting ? t.client.sending : t.client.submitBooking}
            onPress={() => void submit()}
            disabled={!canSubmit || isSubmitting}
            loading={isSubmitting}
          />
        </View>
        {!design ? <Text style={styles.hintCentered}>{t.client.needsDesign}</Text> : null}
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  topBar: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha(palette.pearl, 0.08),
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.35),
  },
  backLabel: { fontFamily: type.body.fontFamily, color: palette.pearl, fontSize: 17, fontWeight: "500" },
  brand: { ...type.body, color: palette.ash, fontSize: 12, letterSpacing: 1.4 },
  artistName: { ...type.display, color: palette.pearl, fontSize: 28, letterSpacing: 0.6 },
  intro: { ...type.body, color: palette.ash, fontSize: 14, lineHeight: 20, marginTop: -spacing.sm },
  section: { gap: spacing.sm },
  sectionTitle: { ...type.body, color: palette.pearl, fontSize: 16, fontWeight: "700" },
  sectionBody: { ...type.body, color: palette.ash, fontSize: 12, lineHeight: 18 },
  preview: {
    width: "100%",
    height: 220,
    borderRadius: radii.lg,
    backgroundColor: palette.ink800,
  },
  dropZone: {
    borderRadius: radii.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: alpha(palette.blush, 0.24),
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  dropHint: { ...type.body, color: palette.ash, fontSize: 12 },
  dropShot: {
    width: "100%",
    maxWidth: 280,
    // The cut-out's own proportions. `contain` plus no border: a frame around
    // mostly transparent pixels would read as an empty box.
    aspectRatio: 1207 / 559,
    marginBottom: spacing.xs,
  },
  buttonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  primary: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: "center",
    overflow: "hidden",
    ...shadows.glow,
  },
  primaryLabel: { fontFamily: type.body.fontFamily, color: palette.ink900, fontWeight: "500", fontSize: 15, letterSpacing: 0.2 },
  secondary: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: "center",
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.35),
    backgroundColor: alpha(palette.pearl, 0.04),
  },
  secondaryLabel: { fontFamily: type.body.fontFamily, color: palette.pearl, fontSize: 14, fontWeight: "500", letterSpacing: 0.2 },
  status: { ...type.body, color: palette.ash, fontSize: 12, marginTop: spacing.xs },
  hint: { ...type.body, color: palette.ashDim, fontSize: 12, lineHeight: 18 },
  hintCentered: { ...type.body, color: palette.ashDim, fontSize: 12, textAlign: "center" },
  surpriseWrap: { marginTop: spacing.xs },

  /* Portfolio rail. Fixed card width rather than flex so the next look always
     peeks in from the edge — the affordance that the rail scrolls at all. */
  rail: { gap: spacing.sm, paddingVertical: spacing.xs },

  lookCard: {
    width: 148,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: alpha(palette.pearl, 0.05),
    padding: spacing.sm,
    gap: spacing.xs,
    overflow: "hidden",
  },
  lookCardActive: { borderColor: palette.rose, backgroundColor: alpha(palette.rose, 0.16) },
  surpriseCard: { borderStyle: "dashed", borderColor: alpha(palette.pearl, 0.25), justifyContent: "center" },
  lookImage: { width: "100%", aspectRatio: 4 / 5, borderRadius: radii.md },
  lookTitle: { ...type.body, color: palette.pearl, fontWeight: "600" },
  lookMeta: { ...type.body, color: palette.ash, fontSize: 11, lineHeight: 15 },
  lookPrice: { ...type.body, color: palette.ashDim, fontSize: 11 },
  progress: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: alpha(palette.pearl, 0.05),
  },
  errorBox: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: alpha(palette.danger, 0.12),
  },
  errorText: { ...type.body, color: palette.danger, fontSize: 13 },
  designBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: alpha(palette.pearl, 0.05),
    gap: spacing.sm,
  },
  designText: { ...type.body, color: palette.pearl, fontSize: 13, lineHeight: 19 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: alpha(palette.pearl, 0.1),
  },
  tagLabel: { ...type.body, color: palette.pearl, fontSize: 11 },
  compareWrap: { marginTop: spacing.sm },
  receipt: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: alpha(palette.pearl, 0.05),
    gap: spacing.xs,
  },
  receiptTitle: { ...type.body, color: palette.ash, fontSize: 12, fontWeight: "700" },
  receiptLine: { flexDirection: "row", justifyContent: "space-between" },
  receiptLabel: { ...type.body, color: palette.ash, fontSize: 12 },
  receiptAmount: { ...type.body, color: palette.pearl, fontSize: 12 },
  receiptTotal: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: alpha(palette.blush, 0.16),
  },
  receiptTotalLabel: { ...type.body, color: palette.pearl, fontSize: 13, fontWeight: "700" },
  receiptTotalAmount: { ...type.body, color: palette.pearl, fontSize: 15, fontWeight: "700" },
  receiptDuration: { ...type.body, color: palette.ashDim, fontSize: 11, textAlign: "right" },
  fieldLabel: { ...type.body, color: palette.pearl, fontSize: 12, fontWeight: "600", marginTop: spacing.md },
  timeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  timeField: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.18),
    backgroundColor: alpha(palette.ink800, 0.8),
  },
  timeInput: {
    minWidth: 56,
    color: palette.pearl,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    ...type.body,
  },
  timeSeparator: { ...type.body, color: palette.pearl, fontSize: 18, fontWeight: "700" },
  input: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.18),
    backgroundColor: alpha(palette.ink800, 0.8),
    color: palette.pearl,
    ...type.body,
  },
  submitWrap: { marginTop: spacing.lg },
});
