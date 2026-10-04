import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { fetchSessionStatus, respondToCounter } from "../../src/lib/clientApi";
import { useDynamicTranslation } from "../../src/hooks/useDynamicTranslation";
import { useLocale } from "../../src/i18n/LocaleProvider";
import type { Dictionary } from "../../src/i18n/getDictionary";
import { GlassCard } from "../../src/components/GlassCard";
import { PearlButton } from "../../src/components/PearlButton";
import { alpha, palette, radii, spacing, type } from "../../src/theme";
import type { SessionStatusView } from "@/lib/types";

const POLL_INTERVAL_MS = 3_000;

function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

type Status = SessionStatusView["status"];

const HEADLINES: Record<
  Status,
  { emoji: string; titleKey: keyof Dictionary["client"]; bodyKey: keyof Dictionary["client"] }
> = {
  pending: { emoji: "⏳", titleKey: "statusPendingTitle", bodyKey: "statusPendingBody" },
  confirmed: { emoji: "✅", titleKey: "statusConfirmedTitle", bodyKey: "statusConfirmedBody" },
  counter_offer: {
    emoji: "🔄",
    titleKey: "statusCounterTitle",
    bodyKey: "statusCounterBody",
  },
  rejected: { emoji: "❌", titleKey: "statusRejectedTitle", bodyKey: "statusRejectedBody" },
};

/**
 * Live booking status for the customer.
 *
 * `sessions` is RLS-locked to the owning artist, so this polls the server-side
 * proxy (service role) with nothing but the opaque token — the same contract the
 * web `/status/[token]` page uses. Polling stops once the booking settles.
 */
export function StatusTracker({ token }: { token: string }) {
  const { t, locale } = useLocale();
  const [session, setSession] = useState<SessionStatusView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResponding, setIsResponding] = useState(false);
  const hasSettled = useRef(false);

  const load = useCallback(async () => {
    try {
      const next = await fetchSessionStatus(token);
      setSession(next);
      setError(null);
      if (next.status !== "pending") hasSettled.current = true;
    } catch {
      setError(t.client.connectionLost);
    }
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (hasSettled.current) return;
      void load();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const respond = useCallback(
    async (action: "accept_counter" | "decline_counter") => {
      setIsResponding(true);
      try {
        const next = await respondToCounter(token, action);
        setSession(next);
        setError(null);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (respondError) {
        setError(respondError instanceof Error ? respondError.message : t.common.error);
      } finally {
        setIsResponding(false);
      }
    },
    [token, t],
  );

  // Receipt lines and the artist's free-text note are authored at booking time
  // in one language, so they are translated for display rather than for storage.
  // Declared before the early return below: hooks must run unconditionally.
  const dynamicText = useDynamicTranslation([
    ...(session?.priceEstimate?.lineItems ?? []).map((item) => item.label),
    ...(session?.artistNotes ? [session.artistNotes] : []),
  ]);
  const lineCount = session?.priceEstimate?.lineItems?.length ?? 0;
  const lineLabelAt = (index: number, fallback: string) => dynamicText[index] ?? fallback;
  const noteText = session?.artistNotes
    ? (dynamicText[lineCount] ?? session.artistNotes)
    : null;

  if (!session) {
    return (
      <View style={styles.centered}>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            <ActivityIndicator color={palette.rose} />
            <Text style={styles.loading}>{t.client.loadingBooking}</Text>
          </>
        )}
      </View>
    );
  }

  const headline = HEADLINES[session.status];
  const items = session.priceEstimate?.lineItems ?? [];
  const activePrice = session.counterPrice ?? session.estimatedPrice ?? session.priceEstimate?.total ?? 0;
  const activeSlot = session.counterAppointmentTime ?? session.requestedAppointmentTime;

  const slotLabel = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(locale, {
          weekday: "long",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "—";

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <GlassCard style={styles.headlineCard}>
        <Text style={styles.emoji}>{headline.emoji}</Text>
        <Text style={styles.headlineTitle}>{t.client[headline.titleKey]}</Text>
        <Text style={styles.headlineBody}>{t.client[headline.bodyKey]}</Text>
      </GlassCard>

      <GlassCard style={styles.section}>
        <Text style={styles.sectionTitle}>{t.client.yourAppointment}</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>
            {session.counterPrice ? t.client.newPrice : t.client.estimatedTotal}
          </Text>
          <Text style={styles.rowValue}>{money(activePrice)}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>
            {session.counterAppointmentTime ? t.client.newTime : t.client.requestedTime}
          </Text>
          <Text style={styles.rowValue}>{slotLabel(activeSlot)}</Text>
        </View>

        {session.estimatedDurationMins ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t.client.duration}</Text>
            <Text style={styles.rowValue}>
              {session.estimatedDurationMins} {t.artist.mins}
            </Text>
          </View>
        ) : null}

        {items.length > 0 ? (
          <View style={styles.breakdown}>
            {items.map((item, index) => (
              <View key={item.label} style={styles.breakdownLine}>
                <Text style={styles.breakdownLabel}>{lineLabelAt(index, item.label)}</Text>
                <Text style={styles.breakdownAmount}>{money(item.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </GlassCard>

      {session.renderedResultUrl ? (
        <Image source={{ uri: session.renderedResultUrl }} style={styles.render} />
      ) : null}

      {noteText ? (
        <GlassCard style={styles.section}>
          <Text style={styles.note}>
            <Text style={styles.noteLabel}>{t.client.artistNote} </Text>
            {noteText}
          </Text>
        </GlassCard>
      ) : null}

      {session.status === "counter_offer" ? (
        <GlassCard style={styles.counterCard}>
          <Text style={styles.counterText}>
            {session.counterPrice
              ? `${t.client.newTotal} ${money(session.counterPrice)}`
              : t.client.newTimeProposed}
          </Text>
          <View style={styles.counterActions}>
            <View style={styles.counterSlot}>
              <PearlButton
                label={t.client.acceptCounter}
                onPress={() => void respond("accept_counter")}
                disabled={isResponding}
                compact
              />
            </View>
            <View style={styles.counterSlot}>
              <PearlButton
                label={t.client.declineCounter}
                variant="ghost"
                onPress={() => void respond("decline_counter")}
                disabled={isResponding}
                compact
              />
            </View>
          </View>
        </GlassCard>
      ) : null}

      {error ? <Text style={styles.errorCentered}>{error}</Text> : null}

      <Text style={styles.footnote}>{t.client.keepLink}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  loading: { ...type.body, color: palette.ash, fontSize: 13 },
  errorText: { ...type.body, color: palette.danger, fontSize: 13, textAlign: "center" },
  errorCentered: { ...type.body, color: palette.danger, fontSize: 13, textAlign: "center" },
  headlineCard: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xl },
  emoji: { fontSize: 40 },
  headlineTitle: { ...type.body, color: palette.pearl, fontSize: 18, fontWeight: "700", textAlign: "center" },
  headlineBody: { ...type.body, color: palette.ash, fontSize: 13, lineHeight: 19, textAlign: "center" },
  section: { gap: spacing.xs },
  sectionTitle: { ...type.body, color: palette.pearl, fontSize: 14, fontWeight: "700", marginBottom: spacing.xs },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  rowLabel: { ...type.body, color: palette.ash, fontSize: 13 },
  rowValue: { ...type.body, color: palette.pearl, fontSize: 13, flexShrink: 1, textAlign: "right" },
  breakdown: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: alpha(palette.blush, 0.14),
    gap: 2,
  },
  breakdownLine: { flexDirection: "row", justifyContent: "space-between" },
  breakdownLabel: { ...type.body, color: palette.ash, fontSize: 11 },
  breakdownAmount: { ...type.body, color: palette.ash, fontSize: 11 },
  render: {
    width: "100%",
    height: 280,
    borderRadius: radii.lg,
    backgroundColor: palette.ink800,
  },
  note: { ...type.body, color: palette.pearl, fontSize: 13, lineHeight: 19 },
  noteLabel: { color: palette.ash, fontWeight: "700" },
  counterCard: { gap: spacing.md, borderColor: alpha(palette.blush, 0.35) },
  counterText: { ...type.body, color: palette.pearl, fontSize: 13 },
  counterActions: { flexDirection: "row", gap: spacing.sm },
  counterSlot: { flex: 1 },
  footnote: { ...type.body, color: palette.ashDim, fontSize: 11, textAlign: "center" },
});
