import { LinearGradient } from "expo-linear-gradient";
import { memo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Svg, { Line } from "react-native-svg";
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_600SemiBold,
  useFonts,
} from "@expo-google-fonts/cormorant-garamond";

import { BookingFeed } from "./screens/BookingFeed";
import { PortfolioManager } from "./screens/PortfolioManager";
import { NailOfTheDay } from "./screens/NailOfTheDay";
import { ArtistsDirectory } from "./screens/client/ArtistsDirectory";
import { BookingStudio } from "./screens/client/BookingStudio";
import { StyleSearch } from "./screens/client/StyleSearch";
import { StatusTracker } from "./screens/client/StatusTracker";
import { SavedNailsScreen } from "./screens/SavedNailsScreen";
import type { Artist } from "@/lib/types";
import { Aura } from "./src/components/Aura";
import { DeepLinkHandler } from "./src/components/DeepLinkHandler";
import { LocaleProvider, useLocale } from "./src/i18n/LocaleProvider";
import { LanguageToggle } from "./src/i18n/LanguageToggle";
import { SideDrawer } from "./src/components/SideDrawer";
import { IconArtists, IconNailOfTheDay, IconSaved, IconSearch, IconStatus } from "./src/components/TabIcons";
import { alpha, palette, radii, shadows, spacing, type } from "./src/theme";

const HamburgerIcon = memo(function HamburgerIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={palette.pearl} strokeWidth="1.6" strokeLinecap="round">
      <Line x1="4" y1="7" x2="20" y2="7" />
      <Line x1="4" y1="12" x2="20" y2="12" />
      <Line x1="4" y1="17" x2="20" y2="17" />
    </Svg>
  );
});

// Force reload for icon update

type Tab = "requests" | "portfolio";

const TABS: { key: Tab; labelKey: "tabRequests" | "tabPortfolio" }[] = [
  { key: "requests", labelKey: "tabRequests" },
  { key: "portfolio", labelKey: "tabPortfolio" },
];

type ClientTab = "artists" | "search" | "discover" | "status";

const CLIENT_TABS: { key: ClientTab; icon: React.ReactNode }[] = [
  { key: "artists", icon: <IconArtists /> },
  { key: "search", icon: <IconSearch /> },
  { key: "discover", icon: <IconNailOfTheDay /> },
  { key: "status", icon: <IconStatus /> },
];

/**
 * One app, two roles.
 *
 * The artist half manages incoming bookings and a portfolio; the client half is
 * the zero-install funnel the web app runs at `/confirm/[token]` and
 * `/status/[token]`. Both live in the same binary because they share the same
 * Supabase project and the same design language, and a customer who is also a
 * nail artist should not need two apps.
 *
 * The client flow is a tiny explicit stack rather than a navigation library:
 * the funnel is strictly linear (artists -> studio -> status) and the project
 * is deliberately dependency-free.
 */
export default function App() {
  return (
    <LocaleProvider>
      <Shell />
    </LocaleProvider>
  );
}

function Shell() {
  const { t, ready } = useLocale();
  const [role, setRole] = useState<"artist" | "client">("artist");
  const [tab, setTab] = useState<Tab>("requests");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [clientTab, setClientTab] = useState<ClientTab>("artists");
  const [showSaved, setShowSaved] = useState(false);
  const lastToken = useRef<string | null>(null);
  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_600SemiBold,
  });

  if (!fontsLoaded) {
    return <View style={styles.boot} />;
  }

  const tabBarStyle = { paddingBottom: spacing.xxl + 8 };

  const artistDrawerItems = [
    {
      label: t.artist.tabRequests,
      onPress: () => {
        setTab("requests");
        setDrawerOpen(false);
      },
    },
    {
      label: t.artist.tabPortfolio,
      onPress: () => {
        setTab("portfolio");
        setDrawerOpen(false);
      },
    },
    {
      label: "Profile",
      onPress: () => {
        setDrawerOpen(false);
      },
    },
    {
      label: "Settings",
      onPress: () => {
        setDrawerOpen(false);
      },
    },
  ];

  return (
    <SafeAreaProvider>
      <Aura>
        <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
          <StatusBar style="light" />

          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View>
                <Text style={styles.brand}>NailFolio</Text>
                <View style={styles.roleSwitch}>
                  <Pressable
                    onPress={() => setRole("artist")}
                    style={[styles.roleChip, role === "artist" && styles.roleChipActive]}
                  >
                    <Text style={[styles.roleChipLabel, role === "artist" && styles.roleChipLabelActive]}>
                      Artist
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setRole("client")}
                    style={[styles.roleChip, role === "client" && styles.roleChipActive]}
                  >
                    <Text style={[styles.roleChipLabel, role === "client" && styles.roleChipLabelActive]}>
                      Client
                    </Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.headerActions}>
                {ready ? <LanguageToggle /> : null}
                {role === "client" ? (
                  <Pressable onPress={() => { console.log("[App][Saved] toggle showSaved:", !showSaved); setShowSaved(!showSaved); }} style={[styles.statusHeaderButton, showSaved && styles.statusHeaderButtonActive]}>
                    <IconSaved color={showSaved ? palette.ink900 : "currentColor"} />
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setDrawerOpen(true)} style={styles.menuButton}>
                  <HamburgerIcon />
                </Pressable>
              </View>
            </View>
            <View style={styles.roleRow}>
              <Text style={styles.tagline}>{role === "artist" ? t.artist.tagline : t.client.artistsBody}</Text>
            </View>
          </View>

          <View style={styles.body}>
            {role === "artist" ? (
              tab === "requests" ? (
                <BookingFeed />
              ) : (
                <PortfolioManager />
              )
            ) : (
              <ClientShell
                clientTab={clientTab}
                onClientTabChange={setClientTab}
                showSaved={showSaved}
                onShowSavedChange={setShowSaved}
              />
            )}
          </View>

          {/* A shared link takes over the body until it is resolved. */}
          <DeepLinkHandler
            initialToken={null}
            onResolved={(artist) => {
              setTab("requests");
              setRole("client");
            }}
            onExpired={() => {
              setTab("requests");
            }}
          />

          {role === "artist" ? (
            <View style={styles.tabBar}>
              {TABS.map((item) => {
                const active = tab === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setTab(item.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={[styles.tab, active && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>
                      {t.artist[item.labelKey]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <SideDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            items={artistDrawerItems}
          />
        </SafeAreaView>
      </Aura>
    </SafeAreaProvider>
  );
}

function ClientShell({
  clientTab,
  onClientTabChange,
  showSaved,
  onShowSavedChange,
}: {
  clientTab: ClientTab;
  onClientTabChange: (tab: ClientTab) => void;
  showSaved: boolean;
  onShowSavedChange: (value: boolean) => void;
}) {
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [statusToken, setStatusToken] = useState("");
  const [statusInput, setStatusInput] = useState("");

  if (selectedArtist) {
    return (
      <BookingStudio
        artist={selectedArtist}
        onBooked={(token: string) => {
          setSelectedArtist(null);
          setStatusToken(token);
          onClientTabChange("status");
        }}
        onBack={() => setSelectedArtist(null)}
      />
    );
  }

  if (showSaved) {
    console.log("[App][ClientShell] rendering SavedNailsScreen, clientTab:", clientTab);
    return (
      <View style={styles.clientShell}>
        <View style={styles.clientBody}>
          <SavedNailsScreen />
        </View>
        <View style={styles.clientTabBar}>
          {CLIENT_TABS.map((item) => {
            const active = clientTab === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  onShowSavedChange(false);
                  onClientTabChange(item.key);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.iconTab, active && styles.iconTabActive]}
              >
                {item.icon}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.clientShell}>
      <View style={styles.clientBody}>
        {clientTab === "artists" ? (
          <ArtistsDirectory onSelect={setSelectedArtist} />
        ) : clientTab === "search" ? (
          <StyleSearch onSelect={setSelectedArtist} />
        ) : clientTab === "status" ? (
          statusToken ? (
            <StatusTracker token={statusToken} />
          ) : (
            <View style={styles.statusInput}>
              <Text style={styles.statusTitle}>Enter booking token</Text>
              <Text style={styles.statusHint}>
                Paste the token from your booking confirmation link.
              </Text>
              <TextInput
                value={statusInput}
                onChangeText={setStatusInput}
                placeholder="Token"
                placeholderTextColor={palette.ash}
                style={styles.statusField}
              />
              <Pressable
                onPress={() => {
                  const trimmed = statusInput.trim();
                  if (trimmed) {
                    setStatusToken(trimmed);
                  }
                }}
                style={styles.statusButton}
              >
                <LinearGradient
                  colors={[palette.pearl, palette.blush, palette.rose]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.statusButtonLabel}>Track booking</Text>
              </Pressable>
            </View>
          )
        ) : (
          <NailOfTheDay />
        )}
      </View>
      <View style={styles.clientTabBar}>
        {CLIENT_TABS.map((item) => {
          const active = clientTab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => onClientTabChange(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.iconTab, active && styles.iconTabActive]}
            >
              {item.icon}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: palette.ink950 },
  safeArea: { flex: 1, backgroundColor: "transparent" },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  roleRow: { minHeight: 18, justifyContent: "center" },
  brand: {
    ...type.display,
    color: palette.pearl,
    fontSize: 26,
    letterSpacing: 1.2,
    textShadowColor: alpha(palette.rose, 0.5),
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  tagline: { ...type.body, color: palette.ash, fontSize: 12, letterSpacing: 0.6 },
  roleSwitch: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  roleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.2),
  },
  roleChipActive: { backgroundColor: alpha(palette.blush, 0.18), borderColor: palette.rose },
  roleChipLabel: { ...type.body, color: palette.ash, fontSize: 12, fontWeight: "500", letterSpacing: 0.2 },
  roleChipLabelActive: { color: palette.pearl, fontWeight: "600", letterSpacing: 0.2 },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha(palette.pearl, 0.08),
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.2),
  },
  statusHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha(palette.pearl, 0.08),
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.2),
  },
  statusHeaderButtonActive: {
    backgroundColor: palette.blush,
    borderColor: palette.rose,
  },
  roleBadge: {
    ...type.body,
    color: palette.blush,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 2,
  },
  body: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: alpha(palette.blush, 0.14),
    backgroundColor: alpha(palette.ink950, 0.6),
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: "center",
    backgroundColor: alpha(palette.pearl, 0.05),
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.16),
    ...shadows.chip,
  },
  tabActive: {
    backgroundColor: palette.blush,
    borderColor: palette.rose,
    ...shadows.glow,
  },
  tabDisabled: { opacity: 0.4 },
  tabText: { ...type.body, color: palette.blush, fontWeight: "500", letterSpacing: 0.2 },
  tabTextActive: { color: palette.ink900, fontWeight: "600", letterSpacing: 0.2 },
  clientTabContent: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  iconTab: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha(palette.pearl, 0.05),
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.16),
    ...shadows.chip,
    minWidth: 72,
    color: palette.blush,
  },
  iconTabActive: {
    backgroundColor: palette.blush,
    borderColor: palette.rose,
    ...shadows.glow,
    color: palette.ink900,
  },
  clientShell: { flex: 1, flexDirection: "column" },
  clientHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  backButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: alpha(palette.pearl, 0.05),
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.38),
  },
  backButtonLabel: { fontFamily: type.body.fontFamily, color: palette.pearl, fontWeight: "500", fontSize: 15, letterSpacing: 0.2 },
  clientTabBar: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: alpha(palette.blush, 0.14),
    backgroundColor: alpha(palette.ink950, 0.6),
  },
  clientBody: { flex: 1 },
  statusInput: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  statusTitle: { ...type.display, color: palette.pearl, fontSize: 22 },
  statusHint: { ...type.body, color: palette.ash, fontSize: 13, textAlign: "center" },
  statusField: {
    width: "100%",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.2),
    backgroundColor: alpha(palette.pearl, 0.05),
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: palette.pearl,
    ...type.body,
  },
  statusButton: {
    marginTop: spacing.sm,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    overflow: "hidden",
    ...shadows.glow,
  },
  statusButtonLabel: { fontFamily: type.body.fontFamily, color: palette.ink900, fontWeight: "500", fontSize: 15, letterSpacing: 0.2 },
});
