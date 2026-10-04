import * as Haptics from "expo-haptics";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { tagLabel } from "@/lib/tags";
import type { ArtistSessionView, SessionStatus } from "@/lib/types";
import { actOnSession, fetchSessions, statusLabel } from "../src/lib/api";
import { subscribeToArtistSessions } from "../src/lib/realtime";
import { useLocale } from "../src/i18n/LocaleProvider";
import { GlassCard } from "../src/components/GlassCard";
import { PearlButton } from "../src/components/PearlButton";
import { alpha, palette, radii, shadows, spacing, type } from "../src/theme";

const POLL_INTERVAL_MS = 10_000;

const STATUS_TINT: Record<SessionStatus, string> = {
  pending: palette.blush,
  confirmed: palette.mint,
  counter_offer: palette.warn,
  rejected: palette.danger,
};

function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

const CARD_HEIGHT = 280;

const SessionCard = memo(function SessionCard({
  item,
  statusTint,
  slot,
  t,
  onAct,
  onOpenCounter,
}: {
  item: ArtistSessionView;
  statusTint: string;
  slot: (iso: string | null) => string;
  t: ReturnType<typeof useLocale>["t"];
  onAct: (token: string, action: "approve" | "decline") => void;
  onOpenCounter: (item: ArtistSessionView) => void;
}) {
  const price = item.counterPrice ?? item.estimatedPrice ?? 0;
  const time = item.counterAppointmentTime ?? item.requestedAppointmentTime;
  const isOpen = item.status === "pending" || item.status === "counter_offer";

  return (
    <GlassCard style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={[styles.badge, { color: statusTint }]}>
          {statusLabel[item.status]}
        </Text>
        <Text style={styles.timestamp}>{slot(item.createdAt)}</Text>
      </View>

      {item.renderedResultUrl ? (
        <Image source={{ uri: item.renderedResultUrl }} style={styles.render} />
      ) : null}

      <Text style={styles.client}>
        {item.clientName ?? t.artist.client}
        {item.clientPhone ? ` · ${item.clientPhone}` : ""}
      </Text>

      {item.priceEstimate ? (
        <View style={styles.lines}>
          {item.priceEstimate.lineItems.map((line) => (
            <View key={line.label} style={styles.line}>
              <Text style={styles.lineLabel}>{line.label}</Text>
              <Text style={styles.lineAmount}>{money(line.amount)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.meta}>
        {money(price)} · {item.estimatedDurationMins ?? "?"} {t.artist.mins} · {slot(time)}
      </Text>

      {item.generatedPrompt ? (
        <Text style={styles.prompt}>{item.generatedPrompt}</Text>
      ) : null}

      {isOpen ? (
        <View style={styles.actions}>
          <View style={styles.actionSlot}>
            <PearlButton
              label={t.artist.approve}
              onPress={() => void onAct(item.token, "approve")}
              compact
            />
          </View>
          <View style={styles.actionSlot}>
            <PearlButton
              label={t.artist.counter}
              variant="ghost"
              onPress={() => {
                onOpenCounter(item);
              }}
              compact
            />
          </View>
          <View style={styles.actionSlot}>
            <PearlButton
              label={t.artist.decline}
              variant="ghost"
              onPress={() => void onAct(item.token, "decline")}
              compact
            />
          </View>
        </View>
      ) : null}
    </GlassCard>
  );
});

/**
 * Screen 2.2 — Realtime booking feed & action centre.
 * Polls every 10s while foregrounded and listens to the `sessions` Realtime
 * channel; a new `pending` request triggers a haptic ping.
 */
export function BookingFeed() {
  const { t, locale } = useLocale();
  const [sessions, setSessions] = useState<ArtistSessionView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counterFor, setCounterFor] = useState<ArtistSessionView | null>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [counterTime, setCounterTime] = useState("");
  const knownTokens = useRef<Set<string>>(new Set());

  const load = useCallback(
    async (initial = false) => {
      try {
        const next = (await fetchSessions()) ?? [];
        const incoming = next.filter(
          (session) => session.status === "pending" && !knownTokens.current.has(session.token),
        );
        if (!initial && incoming.length > 0) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        next.forEach((session) => knownTokens.current.add(session.token));
        setSessions(next);
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t.artist.loadError);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void load(true);
    const poller = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(poller);
  }, [load]);

  useEffect(() => {
    const unsubscribe = subscribeToArtistSessions({
      artistId: sessions[0]?.artistId ?? "",
      onChange: () => void load(),
    });
    return unsubscribe;
  }, [load, sessions]);

  const act = useCallback(
    async (token: string, action: "approve" | "decline") => {
      try {
        await actOnSession({ token, action });
        await load();
      } catch (actionError) {
        Alert.alert(
          t.artist.updateErrorTitle,
          actionError instanceof Error ? actionError.message : t.artist.tryAgain,
        );
      }
    },
    [load, t],
  );

  const submitCounter = useCallback(async () => {
    if (!counterFor) return;

    const price = Number.parseFloat(counterPrice);
    try {
      await actOnSession({
        token: counterFor.token,
        action: "counter",
        price: Number.isFinite(price) && price > 0 ? price : undefined,
        appointmentTime: counterTime ? new Date(counterTime).toISOString() : undefined,
      });
      setCounterFor(null);
      setCounterPrice("");
      setCounterTime("");
      await load();
    } catch (actionError) {
      Alert.alert(
        t.artist.counterErrorTitle,
        actionError instanceof Error ? actionError.message : t.artist.tryAgain,
      );
    }
  }, [counterFor, counterPrice, counterTime, load, t]);

  // Dates and times follow the chosen language rather than the device default.
  const slot = useCallback(
    (iso: string | null): string => {
      if (!iso) return t.artist.noTimeProposed;
      return new Date(iso).toLocaleString(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    },
    [locale, t],
  );

  if (isLoading) {
    return <ActivityIndicator style={styles.loader} color={palette.rose} />;
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.token}
        removeClippedSubviews
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        initialNumToRender={6}
        windowSize={5}
        getItemLayout={(_data, index) => ({
          length: CARD_HEIGHT,
          offset: CARD_HEIGHT * index,
          index,
        })}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              void load();
            }}
            tintColor={palette.rose}
          />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{t.artist.noRequests}</Text>}
        renderItem={({ item }) => (
          <SessionCard
            item={item}
            statusTint={STATUS_TINT[item.status]}
            slot={slot}
            t={t}
            onAct={act}
            onOpenCounter={(session) => {
              setCounterFor(session);
              setCounterPrice(session.estimatedPrice ? String(session.estimatedPrice) : "");
              setCounterTime("");
            }}
          />
        )}
      />

      <Modal
        visible={counterFor !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setCounterFor(null)}
      >
        <View style={styles.modalBackdrop}>
          <GlassCard style={styles.modalCard} padded={false}>
            <Text style={styles.modalTitle}>{t.artist.counterTitle}</Text>
            <Text style={styles.modalHint}>
              {counterFor?.clientName ?? t.artist.client} {t.artist.askedFor}{" "}
              {counterFor?.priceEstimate?.lineItems.map((line) => tagLabel(line.label)).join(" + ") ||
                t.artist.aLook}
              .
            </Text>

            <Text style={styles.inputLabel}>{t.artist.newPrice}</Text>
            <TextInput
              value={counterPrice}
              onChangeText={setCounterPrice}
              keyboardType="decimal-pad"
              placeholder="65.00"
              placeholderTextColor={palette.ashDim}
              style={styles.input}
            />

            <Text style={styles.inputLabel}>{t.artist.newDateTime}</Text>
            <TextInput
              value={counterTime}
              onChangeText={setCounterTime}
              placeholder="2026-10-02T14:00"
              placeholderTextColor={palette.ashDim}
              style={styles.input}
            />

            <View style={styles.modalActions}>
              <View style={styles.actionSlot}>
                <PearlButton
                  label={t.artist.cancel}
                  variant="ghost"
                  onPress={() => setCounterFor(null)}
                  compact
                />
              </View>
              <View style={styles.actionSlot}>
                <PearlButton label={t.artist.sendOffer} onPress={() => void submitCounter()} compact />
              </View>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  loader: { marginTop: spacing.xxl },
  list: { gap: spacing.md, paddingBottom: spacing.xl },
  error: { ...type.body, color: palette.danger, marginBottom: spacing.sm },
  empty: { ...type.body, color: palette.ash, textAlign: "center", marginTop: spacing.xl },
  card: { gap: spacing.sm },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: { ...type.body, fontSize: 12, fontWeight: "700", letterSpacing: 0.8 },
  timestamp: { ...type.body, color: palette.ashDim, fontSize: 11 },
  render: {
    width: "100%",
    height: 180,
    borderRadius: radii.md,
    backgroundColor: palette.ink800,
  },
  client: { ...type.body, color: palette.pearl, fontSize: 15, fontWeight: "600" },
  lines: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: alpha(palette.blush, 0.14),
    paddingTop: spacing.sm,
  },
  line: { flexDirection: "row", justifyContent: "space-between" },
  lineLabel: { ...type.body, color: palette.ash, fontSize: 12 },
  lineAmount: { ...type.body, color: palette.blush, fontSize: 12 },
  meta: { ...type.body, color: palette.blush, fontSize: 13 },
  prompt: { ...type.body, color: palette.ashDim, fontSize: 12, fontStyle: "italic" },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  actionSlot: { flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: alpha(palette.ink950, 0.72), justifyContent: "flex-end" },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: alpha(palette.ink900, 0.96),
    borderColor: alpha(palette.blush, 0.24),
    ...shadows.panel,
  },
  modalTitle: { ...type.display, color: palette.pearl, fontSize: 20 },
  modalHint: { ...type.body, color: palette.ash, fontSize: 13, lineHeight: 19 },
  inputLabel: { ...type.body, color: palette.ash, fontSize: 12, marginTop: spacing.xs },
  input: {
    backgroundColor: alpha(palette.ink800, 0.8),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.18),
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: palette.pearl,
    ...type.body,
  },
  modalActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
});
