import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, G, LinearGradient, Mask, Path, Stop, ClipPath } from "react-native-svg";

import { GlassCard } from "../src/components/GlassCard";
import { alpha, palette, radii, shadows, spacing, type } from "../src/theme";
import { renderNailArt } from "../src/utils/mobileNailArtRenderer";
import { emitSavedNailsChange, subscribeSavedNailsChange } from "../src/utils/savedNailsEvents";
import type { NailOfTheDayDesign } from "@/lib/types";

type Shape = "almond" | "coffin_ballerina" | "square" | "stiletto" | "oval" | "squoval" | "round" | "lipstick";

interface SavedItem {
  name: string;
  shape: Shape;
  palette: string[];
  savedAt: string;
  design: NailOfTheDayDesign;
  nailImageUrl: string | null;
}

const PREFIX = "savedNail::";
const SAVED_DESIGNS_API = "/api/saved-designs";

const NAIL_PATHS: Record<Shape, string> = {
  almond: "M 25 108 C 25 72, 29 44, 42 20 Q 50 9, 58 20 C 71 44, 75 72, 75 108 C 60 113, 40 113, 25 108 Z",
  coffin_ballerina: "M 25 110 L 37 15 L 63 15 L 75 110 C 60 115, 40 115, 25 110 Z",
  square: "M 25 110 L 25 20 Q 25 15, 30 15 L 70 15 Q 75 15, 75 20 L 75 110 C 60 115, 40 115, 25 110 Z",
  stiletto: "M 25 110 Q 30 60, 50 5 Q 70 60, 75 110 C 60 115, 40 115, 25 110 Z",
  oval: "M 25 110 L 25 50 C 25 20, 75 20, 75 50 L 75 110 C 60 115, 40 115, 25 110 Z",
  squoval: "M 25 110 L 25 46 Q 25 15, 50 15 Q 75 15, 75 46 L 75 110 C 60 115, 40 115, 25 110 Z",
  round: "M 25 110 L 25 60 C 25 35, 75 35, 75 60 L 75 110 C 60 115, 40 115, 25 110 Z",
  lipstick: "M 25 110 L 25 35 L 75 15 L 75 110 C 60 115, 40 115, 25 110 Z",
};

async function readSaved(): Promise<SavedItem[]> {
  try {
    if (typeof AsyncStorage === 'undefined' || !AsyncStorage.getAllKeys) {
      console.log("[SavedNails][readSaved] AsyncStorage not available");
      return [];
    }
    const keys = await AsyncStorage.getAllKeys();
    const savedKeys = keys.filter((key) => key.startsWith(PREFIX));
    console.log("[SavedNails][readSaved] found keys:", savedKeys.length, savedKeys);
    if (savedKeys.length === 0) return [];
    const values = await AsyncStorage.multiGet(savedKeys);
    const items: SavedItem[] = [];
    for (const [, raw] of values) {
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as SavedItem;
        console.log("[SavedNails][readSaved] parsed key:", parsed.name, "shape:", parsed.shape, "palette:", parsed.palette, "hasDesign:", !!parsed.design, "nailImageUrl:", parsed.nailImageUrl);
        if (parsed && parsed.design && parsed.design.name && parsed.design.shape) {
          items.push(parsed);
        } else if (parsed && parsed.name && parsed.shape) {
          items.push({
            ...parsed,
            design: parsed.design ?? {
              name: parsed.name,
              description: "",
              pattern: "",
              finish: "cream",
              tags: [],
              shape: parsed.shape,
              complexity: "simple",
              colors: parsed.palette ?? [],
              layers: [],
              motifs: [],
              texture: "",
            } as NailOfTheDayDesign,
            nailImageUrl: parsed.nailImageUrl ?? null,
          });
        }
      } catch {
        console.log("[SavedNails][readSaved] failed to parse item");
      }
    }
    console.log("[SavedNails][readSaved] total items:", items.length);
    return items;
  } catch (error) {
    console.log("[SavedNails][readSaved] error:", error);
    return [];
  }
}

async function fetchSavedFromApi(): Promise<SavedItem[]> {
  try {
    console.log("[SavedNails][fetchSavedFromApi] calling:", SAVED_DESIGNS_API + "?userId=anonymous");
    const response = await fetch(SAVED_DESIGNS_API + "?userId=anonymous");
    console.log("[SavedNails][fetchSavedFromApi] status:", response.status);
    if (!response.ok) {
      console.log("[SavedNails][fetchSavedFromApi] not ok, returning []");
      return [];
    }
    const data = await response.json();
    console.log("[SavedNails][fetchSavedFromApi] data:", JSON.stringify(data, null, 2));
    return (data.items ?? []) as SavedItem[];
  } catch (error) {
    console.log("[SavedNails][fetchSavedFromApi] error:", error);
    return [];
  }
}

async function saveToApi(item: SavedItem) {
  try {
    console.log("[SavedNails][saveToApi] posting item:", item.name, item.shape);
    await fetch(SAVED_DESIGNS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "anonymous", item }),
    });
  } catch (error) {
    console.log("[SavedNails][saveToApi] error:", error);
  }
}

async function removeFromApi(item: SavedItem) {
  try {
    console.log("[SavedNails][removeFromApi] deleting item:", item.name, item.shape);
    await fetch(SAVED_DESIGNS_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "anonymous", item }),
    });
  } catch (error) {
    console.log("[SavedNails][removeFromApi] error:", error);
  }
}

async function clearAll(): Promise<void> {
  try {
    console.log("[SavedNails][clearAll] clearing all saved nails");
    if (typeof AsyncStorage !== 'undefined' && AsyncStorage.getAllKeys) {
      const keys = await AsyncStorage.getAllKeys();
      const savedKeys = keys.filter((key) => key.startsWith(PREFIX));
      console.log("[SavedNails][clearAll] removing keys:", savedKeys.length);
      await AsyncStorage.multiRemove(savedKeys);
    }
    await fetch(SAVED_DESIGNS_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "anonymous" }),
    });
  } catch (error) {
    console.log("[SavedNails][clearAll] error:", error);
  }
}

function NailPreview({ shape, design, nailImageUrl }: { shape: Shape; design: NailOfTheDayDesign; nailImageUrl: string | null }) {
  const path = NAIL_PATHS[shape] ?? NAIL_PATHS.almond;
  const clipId = `saved-nail-${shape}`;

  console.log("[SavedNails][NailPreview] shape:", shape, "hasDesign:", !!design, "nailImageUrl:", nailImageUrl, "pathLen:", path.length);
  console.log("[SavedNails][NailPreview] path:", path);
  console.log("[SavedNails][NailPreview] preview style:", JSON.stringify(styles.preview));
  console.log("[SavedNails][NailPreview] design.layers:", JSON.stringify(design?.layers));
  console.log("[SavedNails][NailPreview] design.motifs:", JSON.stringify(design?.motifs));
  console.log("[SavedNails][NailPreview] design.texture:", design?.texture);

  return (
    <View style={styles.preview}>
      <Svg width="100%" height="100%" viewBox="0 0 100 120">
        <Defs>
          <ClipPath id={clipId}><Path d={path} fill="white" /></ClipPath>
        </Defs>
        <G clipPath={`url(#${clipId})`}>
          {renderNailArt(design, path, clipId, nailImageUrl)}
        </G>
        <Path d={path} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" />
      </Svg>
    </View>
  );
}

export function SavedNailsScreen() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof AsyncStorage === 'undefined' || !AsyncStorage.getAllKeys) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    void readSaved().then((loaded) => {
      setItems(loaded);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        setIsLoading(true);
        void readSaved().then((loaded) => {
          setItems(loaded);
          setIsLoading(false);
        });
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    return subscribeSavedNailsChange(() => {
      setIsLoading(true);
      void readSaved().then((loaded) => {
        setItems(loaded);
        setIsLoading(false);
      });
    });
  }, []);

  const nails = useMemo(() => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const colors = item.palette;
      const key = `${item.name}::${item.shape}::${colors.join("-")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [items]);

  console.log("[SavedNails] items:", JSON.stringify(items.map(i => ({ name: i.name, shape: i.shape, palette: i.palette, hasDesign: !!i.design, nailImageUrl: i.nailImageUrl })), null, 2));
  console.log("[SavedNails] nails:", JSON.stringify(nails.map(i => ({ name: i.name, shape: i.shape, palette: i.palette })), null, 2));

  const toggleSave = useCallback(async (item: SavedItem) => {
    const key = `savedNail::${item.name}::${item.shape}::${item.palette.join("-")}`;
    console.log("[SavedNails][toggleSave] tapped item:", item.name, "shape:", item.shape, "key:", key);
    if (typeof AsyncStorage !== 'undefined' && AsyncStorage.getItem) {
      const existing = await AsyncStorage.getItem(key);
      console.log("[SavedNails][toggleSave] existing:", existing ? "yes" : "no");
      if (existing) {
        await AsyncStorage.removeItem(key);
        await removeFromApi(item);
      } else {
        await AsyncStorage.setItem(key, JSON.stringify({
          name: item.name,
          shape: item.shape,
          palette: item.palette,
          savedAt: new Date().toISOString(),
          design: item.design,
          nailImageUrl: item.nailImageUrl,
        }));
        await saveToApi(item);
      }
    }
    void readSaved().then(setItems);
    emitSavedNailsChange();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>Saved</Text>
          <Text style={styles.heading}>Your favorite nails</Text>
        </View>
        {items.length > 0 ? (
          <Pressable
            onPress={async () => {
              await clearAll();
              setItems([]);
              emitSavedNailsChange();
            }}
            hitSlop={10}
          >
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={palette.blush} />
          <Text style={styles.loadingText}>Loading your saved designs...</Text>
        </View>
      ) : nails.length === 0 ? (
        <Text style={styles.empty}>No saved nails yet. Save a look to see it here.</Text>
      ) : (
        <View style={styles.grid}>
          {nails.map((item) => {
            const date = item.savedAt ? new Date(item.savedAt) : null;
            const label = date
              ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
              : "";
            const colors = item.palette;
            const itemKey = `${item.name}::${item.shape}::${colors.join("-")}`;

            console.log("[SavedNails][render] rendering item:", item.name, "shape:", item.shape, "palette:", colors);

            return (
              <Pressable
                key={itemKey}
                onPress={() => toggleSave(item)}
                style={styles.card}
              >
                <NailPreview shape={item.shape} design={item.design} nailImageUrl={item.nailImageUrl} />
                <View style={styles.cardBody}>
                  <Text style={styles.name}>{item.name || "Saved look"}</Text>
                  <Text style={styles.meta}>
                    {label}
                    {colors.length > 0 ? ` • ${colors.length} colors` : ""}
                  </Text>
                  {colors.length > 0 && (
                    <View style={styles.swatches}>
                      {colors.map((color, index) => (
                        <View key={`${color}-${index}`} style={styles.colorPill}>
                          <View style={[styles.colorDot, { backgroundColor: color }]} />
                          <Text style={styles.colorIndex}>{index + 1}.</Text>
                          <Text style={styles.colorHex}>{color.toUpperCase()}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl + 24 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  label: { ...type.body, color: palette.blush, fontSize: 11, letterSpacing: 0.28, textTransform: "uppercase" },
  heading: { ...type.display, color: palette.pearl, fontSize: 24, marginTop: spacing.xs },
  clear: { fontFamily: type.body.fontFamily, color: palette.blush, fontSize: 12, fontWeight: "500", letterSpacing: 0.2 },
  empty: { ...type.body, color: palette.ash, fontSize: 13, marginTop: spacing.xl },
  loader: { paddingVertical: spacing.xxl, alignItems: "center", gap: spacing.md },
  loadingText: { ...type.body, color: palette.ash, fontSize: 13 },
  rail: { gap: spacing.md, paddingHorizontal: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "space-between" },
  card: {
    width: "48%",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.18),
    backgroundColor: alpha(palette.ink800, 0.66),
    ...shadows.card,
    overflow: "hidden",
  },
  preview: { width: "100%", aspectRatio: 3 / 4 },
  cardBody: { padding: spacing.md, gap: spacing.xs },
  name: { ...type.body, color: palette.pearl, fontSize: 14, fontWeight: "700" },
  meta: { ...type.body, color: palette.ash, fontSize: 12 },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  colorPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.05)" },
  colorDot: { width: 8, height: 8, borderRadius: 4 },
  colorIndex: { ...type.body, color: palette.pearl, fontSize: 10 },
  colorHex: { ...type.body, color: palette.pearl, fontSize: 10 },
});
