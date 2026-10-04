import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { resolveArtistByToken } from "../lib/clientApi";
import { useLocale } from "../i18n/LocaleProvider";
import { GlassCard } from "../components/GlassCard";
import { PearlButton } from "../components/PearlButton";
import { spacing, type } from "../theme";
import type { Artist } from "@/lib/types";

/**
 * Entry point for a shared booking link.
 *
 * The artist drops `nailfolio://confirm/<token>` into an Instagram DM and it
 * opens straight into the funnel. The web share link (`https://…/confirm/<token>`)
 * is registered as a universal link as well, so one URL works in a browser and
 * in the app.
 *
 * `expo-linking` parses both shapes, so this only has to interpret the path.
 */
export function DeepLinkHandler({
  initialToken,
  onResolved,
  onExpired,
}: {
  /** Token to open on launch, when the app was cold-started from a link. */
  initialToken: string | null;
  onResolved: (artist: Artist) => void;
  onExpired: () => void;
}) {
  const { t } = useLocale();
  const [token, setToken] = useState<string | null>(initialToken);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Links that arrive while the app is already running.
    const subscription = Linking.addEventListener("url", ({ url }) => {
      const candidate = extractToken(Linking.parse(url));
      if (candidate) {
        setFailed(false);
        setToken(candidate);
      }
    });

    void Linking.getInitialURL().then((url) => {
      if (url) setToken(extractToken(Linking.parse(url)));
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setFailed(false);

    void resolveArtistByToken(token).then((artist) => {
      if (cancelled) return;
      // No artist behind the link: show the expiry notice rather than a blank
      // screen, and let the customer dismiss back to the directory.
      if (artist) onResolved(artist);
      else setFailed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [token, onResolved]);

  if (!token) return null;

  if (!failed) {
    return (
      <View style={[styles.overlay, { pointerEvents: "auto" }]}>
        <ActivityIndicator color="#D4B8B1" />
      </View>
    );
  }

  return (
    <View style={[styles.overlay, { pointerEvents: "auto" }]}>
      <GlassCard style={styles.card}>
        <Text style={styles.title}>{t.client.linkExpired}</Text>
        <Text style={styles.body}>{t.client.linkExpiredBody}</Text>
        <View style={styles.actions}>
          <PearlButton
            label={t.common.close}
            onPress={() => {
              setToken(null);
              onExpired();
            }}
            compact
          />
        </View>
      </GlassCard>
    </View>
  );
}

/** Pulls the token out of a parsed deep link, whichever shape it arrived in. */
export function extractToken(parsed: { path?: string | null }): string | null {
  const path = parsed.path;
  if (!path) return null;

  const parts = path.split("/").filter(Boolean);
  const confirmIndex = parts.indexOf("confirm");
  if (confirmIndex === -1) return null;

  return parts[confirmIndex + 1] ?? null;
}

/** Builds a shareable link for a token, preferring the app scheme. */
export function buildShareUrl(token: string): string {
  return Linking.createURL(`/confirm/${token}`);
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: "rgba(23, 21, 31, 0.86)",
  },
  card: { gap: spacing.sm, alignSelf: "stretch" },
  title: { ...type.body, color: "#F9F6F0", fontSize: 17, fontWeight: "700" },
  body: { ...type.body, color: "#9C94A0", fontSize: 13, lineHeight: 19 },
  actions: { marginTop: spacing.sm },
});
