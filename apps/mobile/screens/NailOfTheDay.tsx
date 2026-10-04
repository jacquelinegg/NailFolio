import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image } from "react-native";
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import Svg, { Circle, Defs, G, LinearGradient, Mask, Path, Stop, Filter, FeGaussianBlur, FeMerge, FeMergeNode, RadialGradient } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { PearlButton } from "../src/components/PearlButton";
import { generateNailOfTheDay, renderTryOn, uploadHandPhoto } from "../src/lib/clientApi";
import { alpha, palette, radii, shadows, spacing, type, fontFamilies } from "../src/theme";
import { renderNailArt } from "../src/utils/mobileNailArtRenderer";
import { emitSavedNailsChange } from "../src/utils/savedNailsEvents";
import { debugLog, flushDebugLogs } from "../src/utils/debugLogs";
import type { NailOfTheDayDesign } from "@/lib/types";

type Shape = "almond" | "coffin_ballerina" | "square" | "stiletto" | "oval" | "squoval" | "round" | "lipstick";

const SHAPES: Shape[] = [
  "almond",
  "coffin_ballerina",
  "square",
  "stiletto",
  "oval",
  "squoval",
  "round",
  "lipstick",
];

const SHAPE_LABELS: Record<Shape, string> = {
  almond: "Almond",
  coffin_ballerina: "Coffin Ballerina",
  square: "Square",
  stiletto: "Stiletto",
  oval: "Oval",
  squoval: "Squoval",
  round: "Round",
  lipstick: "Lipstick",
};

const SHAPE_PATHS: Record<Shape, string> = {
  almond: "M 25 108 C 25 72, 29 44, 42 20 Q 50 9, 58 20 C 71 44, 75 72, 75 108 C 60 113, 40 113, 25 108 Z",
  coffin_ballerina: "M 25 110 L 37 15 L 63 15 L 75 110 C 60 115, 40 115, 25 110 Z",
  square: "M 25 110 L 25 20 Q 25 15, 30 15 L 70 15 Q 75 15, 75 20 L 75 110 C 60 115, 40 115, 25 110 Z",
  stiletto: "M 25 110 Q 30 60, 50 5 Q 70 60, 75 110 C 60 115, 40 115, 25 110 Z",
  oval: "M 25 110 L 25 50 C 25 20, 75 20, 75 50 L 75 110 C 60 115, 40 115, 25 110 Z",
  squoval: "M 25 110 L 25 46 Q 25 15, 50 15 Q 75 15, 75 46 L 75 110 C 60 115, 40 115, 25 110 Z",
  round: "M 25 110 L 25 60 C 25 35, 75 35, 75 60 L 75 110 C 60 115, 40 115, 25 110 Z",
  lipstick: "M 25 110 L 25 35 L 75 15 L 75 110 C 60 115, 40 115, 25 110 Z",
};

const MOBILE_ICON_PATHS: Record<Shape, string> = {
  almond: "M 6 20 C 6 14, 7 9, 9 5 Q 10 3, 11 5 C 13 9, 14 14, 14 20 C 12 21, 8 21, 6 20 Z",
  coffin_ballerina: "M 6 21 L 8 5 L 12 5 L 14 21 C 12 22, 8 22, 6 21 Z",
  square: "M 6 21 L 6 5 Q 6 4, 7 4 L 13 4 Q 14 4, 14 5 L 14 21 C 12 22, 8 22, 6 21 Z",
  stiletto: "M 6 21 Q 7 13, 10 3 Q 13 13, 14 21 C 12 22, 8 22, 6 21 Z",
  oval: "M 6 21 L 6 11 C 6 5, 14 5, 14 11 L 14 21 C 12 22, 8 22, 6 21 Z",
  squoval: "M 6 21 L 6 10 Q 6 4, 10 4 Q 14 4, 14 10 L 14 21 C 12 22, 8 22, 6 21 Z",
  round: "M 6 21 L 6 13 C 6 8, 14 8, 14 13 L 14 21 C 12 22, 8 22, 6 21 Z",
  lipstick: "M 6 21 L 6 9 L 14 4 L 14 21 C 12 22, 8 22, 6 21 Z",
};

const MOBILE_ICON_VIEWBOX = "0 0 20 24";

const SHAPE_WEIGHTS: Record<Shape, number> = {
  almond: 3,
  coffin_ballerina: 1,
  square: 3,
  stiletto: 2,
  oval: 3,
  squoval: 2,
  round: 3,
  lipstick: 1,
};

const SPIN_DURATION = 2500;
const SECTOR_COUNT = SHAPES.length;
const SLICE_DEG = 360 / SECTOR_COUNT;
const FULL_SPINS = 3;
const NAIL_ICON_SIZE = 15;

const WHEEL_R = 150;
const WHEEL_SIZE = WHEEL_R * 2;
const CX = WHEEL_R;
const CY = WHEEL_R;

type Phase = "idle" | "spinning" | "shapeLock" | "artFill" | "generating" | "revealed";

const SPIN_TAGS = ["calm", "bold", "minimal", "maximal", "romantic", "edgy", "soft", "dramatic"];

function polarToCartesian(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function sectorPath(index: number): string {
  const start = index * SLICE_DEG;
  const end = start + SLICE_DEG;
  const p1 = polarToCartesian(start, WHEEL_R);
  const p2 = polarToCartesian(end, WHEEL_R);
  const largeArc = 0;
  return `M ${CX} ${CY} L ${p1.x} ${p1.y} A ${WHEEL_R} ${WHEEL_R} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
}

function pickWeightedShape(): Shape {
  const totalWeight = SHAPES.reduce((sum, shape) => sum + SHAPE_WEIGHTS[shape], 0);
  let random = Math.random() * totalWeight;
  for (const shape of SHAPES) {
    random -= SHAPE_WEIGHTS[shape];
    if (random <= 0) return shape;
  }
  return SHAPES[0]!;
}

const WheelSector = memo(function WheelSector({ index, active }: { index: number; active: boolean }) {
  const hue = (index * (360 / SECTOR_COUNT) + 15) % 360;
  const sat = 35 + (index % 3) * 10;
  const light = 38 + (index % 2) * 6;
  const baseColor = `hsl(${hue}, ${sat}%, ${light}%)`;
  const midColor = `hsl(${hue}, ${sat + 8}%, ${light + 12}%)`;
  const edgeColor = `hsl(${hue}, ${sat - 5}%, ${light - 8}%)`;
  const gradId = `sector-grad-${index}`;

  return (
    <G key={`sector-${index}`}>
      <Defs>
        <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={active ? "#E8D5CE" : midColor} stopOpacity={active ? 0.35 : 0.9} />
          <Stop offset="50%" stopColor={active ? "#D4B8B1" : baseColor} stopOpacity={active ? 0.25 : 0.85} />
          <Stop offset="100%" stopColor={active ? "#B99FA9" : edgeColor} stopOpacity={active ? 0.2 : 0.8} />
        </LinearGradient>
      </Defs>
      <Path
        d={sectorPath(index)}
        fill={`url(#${gradId})`}
        stroke={active ? "#E8D5CE" : "rgba(232,213,206,0.25)"}
        strokeWidth={active ? 2.6 : 1}
        opacity={active ? 1 : 0.88}
        filter={active ? "url(#soft-glow)" : undefined}
      />
    </G>
  );
});

const WheelIcon = memo(function WheelIcon({ index, active }: { index: number; active: boolean }) {
  const angle = index * SLICE_DEG + SLICE_DEG / 2;
  const pos = polarToCartesian(angle, WHEEL_R * 0.72);
  const sectorShape = SHAPES[index]!;
  const iconPath = MOBILE_ICON_PATHS[sectorShape];
  const iconSize = NAIL_ICON_SIZE;
  const gradId = `icon-grad-${sectorShape}`;

  return (
    <G key={`icon-${index}`} transform={`translate(${pos.x - iconSize / 2}, ${pos.y - iconSize / 2})`}>
      <Defs>
        <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={active ? "#FFFFFF" : "#E8D5CE"} stopOpacity={active ? 1 : 0.92} />
          <Stop offset="50%" stopColor={active ? "#E8D5CE" : "#D4B8B1"} stopOpacity={active ? 0.95 : 0.82} />
          <Stop offset="100%" stopColor={active ? "#D4B8B1" : "#B99FA9"} stopOpacity={active ? 0.9 : 0.72} />
        </LinearGradient>
        {active && (
          <Filter id={`icon-glow-${sectorShape}`}>
            <FeGaussianBlur stdDeviation="2.5" result="blur" />
            <FeMerge>
              <FeMergeNode in="blur" />
              <FeMergeNode in="SourceGraphic" />
            </FeMerge>
          </Filter>
        )}
      </Defs>
      <Path
        d={iconPath}
        fill={`url(#${gradId})`}
        stroke={active ? "#FFFFFF" : "#E8D5CE"}
        strokeWidth={active ? 2.6 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={active ? `url(#icon-glow-${sectorShape})` : undefined}
      />
    </G>
  );
});

export function NailOfTheDay({ onTryMe }: { onTryMe?: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [shape, setShape] = useState<Shape>("almond");
  const [design, setDesign] = useState<NailOfTheDayDesign | null>(null);
  const [nailImageUrl, setNailImageUrl] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [spinIndex, setSpinIndex] = useState(0);
  const spin = useRef(new Animated.Value(0)).current;
  const requestIdRef = useRef(0);
  const rotationRef = useRef(0);
  const savedKeysRef = useRef<Set<string>>(new Set());
  const [tryMode, setTryMode] = useState<"idle" | "capture" | "rendering" | "result" | "error">("idle");
  const [handPhotoUri, setHandPhotoUri] = useState<string | null>(null);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
  const [tryError, setTryError] = useState<string | null>(null);
  const [trySaved, setTrySaved] = useState(false);

  useEffect(() => {
    if (typeof AsyncStorage === 'undefined' || !AsyncStorage.getAllKeys) {
      savedKeysRef.current = new Set();
      return;
    }
    AsyncStorage.getAllKeys().then((keys) => {
      const savedKeys = keys.filter((key) => key.startsWith("savedNail::"));
      savedKeysRef.current = new Set(savedKeys);
    }).catch(() => {
      savedKeysRef.current = new Set();
    });
  }, []);

  const isDesignSaved = useCallback((designToCheck: NailOfTheDayDesign | null) => {
    if (!designToCheck) return false;
    const key = `savedNail::${designToCheck.name}::${designToCheck.shape}::${designToCheck.colors.join("-")}`;
    return savedKeysRef.current.has(key);
  }, []);

  useEffect(() => {
    if (design) {
      setSaved(isDesignSaved(design));
    }
  }, [design, isDesignSaved]);

  const toggleSaved = useCallback(async () => {
    if (!design) return;
    
    if (typeof AsyncStorage === 'undefined' || !AsyncStorage.setItem || !AsyncStorage.removeItem) {
      console.error("AsyncStorage is not available");
      return;
    }
    
    const key = `savedNail::${design.name}::${design.shape}::${design.colors.join("-")}`;
    const isCurrentlySaved = savedKeysRef.current.has(key);
    
    try {
      if (isCurrentlySaved) {
        await AsyncStorage.removeItem(key);
        savedKeysRef.current.delete(key);
        setSaved(false);
        emitSavedNailsChange();
      } else {
        const savedItem = {
          name: design.name,
          shape: design.shape as Shape,
          palette: design.colors,
          savedAt: new Date().toISOString(),
          design,
          nailImageUrl,
        };
        await AsyncStorage.setItem(key, JSON.stringify(savedItem));
        savedKeysRef.current.add(key);
        setSaved(true);
        emitSavedNailsChange();
      }
    } catch (error) {
      console.error("Failed to save/remove nail design:", error);
    }
  }, [design, nailImageUrl]);

  const startTryMe = useCallback(() => {
    setTryMode("capture");
    setHandPhotoUri(null);
    setRenderedUrl(null);
    setTryError(null);
  }, []);

  const pickHandPhoto = useCallback(
    async (fromCamera: boolean) => {
      if (!design) {
        debugLog("pickHandPhoto aborted: no design");
        return;
      }

      debugLog("pickHandPhoto start", { fromCamera, designName: design.name });
      const source = fromCamera ? "camera" : "library";
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      debugLog("permission result", { source, granted: permission.granted, status: permission.status });

      if (!permission.granted) {
        Alert.alert("Permission required", "Please allow camera or photo access to try this design.");
        return;
      }

      debugLog("launching picker", { source });
      let result;
      try {
        result = fromCamera
          ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
      } catch (pickerError) {
        debugLog("picker threw", { source, error: pickerError });
        throw pickerError;
      }

      debugLog("picker result", {
        source,
        canceled: result.canceled,
        assetCount: result.assets?.length ?? 0,
        uri: result.assets?.[0]?.uri ?? null,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        debugLog("picker canceled or empty", { source, canceled: result.canceled, assets: result.assets?.length });
        return;
      }

      const uri = result.assets[0].uri;
      const fileName = result.assets[0].fileName ?? "hand.jpg";
      const mimeType = result.assets[0].mimeType ?? "image/jpeg";
      debugLog("picker selected file", { source, uri, fileName, mimeType });

      setHandPhotoUri(uri);
      setTryMode("rendering");
      setTryError(null);

      try {
        debugLog("uploadHandPhoto start", { source, fileName, mimeType });
        const handUrl = await uploadHandPhoto({ uri, fileName, mimeType });
        debugLog("uploadHandPhoto resolved", { source, handUrl });

        const refUrl = nailImageUrl ?? "";
        if (!refUrl) {
          debugLog("missing ref image", { source });
          throw new Error("Reference design URL is missing. Please try generating a design again.");
        }
        debugLog("renderTryOn start", { source, handUrl, refUrl });
        const rendered = await renderTryOn(handUrl, refUrl);
        debugLog("renderTryOn resolved", { source, rendered });
        setRenderedUrl(rendered);
        setTryMode("result");
      } catch (error) {
        debugLog("try-on failed", { source, error, name: error instanceof Error ? error.name : null, message: error instanceof Error ? error.message : null });
        setTryError(error instanceof Error ? error.message : "Try-on failed. Please try again.");
        setTryMode("error");
      } finally {
        void flushDebugLogs();
      }
    },
    [design, nailImageUrl],
  );

  const resetTryMe = useCallback(() => {
    setTryMode("idle");
    setHandPhotoUri(null);
    setRenderedUrl(null);
    setTryError(null);
    setTrySaved(false);
  }, []);

  const toggleTrySaved = useCallback(async () => {
    if (!design || !renderedUrl) return;

    const key = `savedNail::${design.name}::${design.shape}::${design.colors.join("-")}::try`;
    const isCurrentlySaved = savedKeysRef.current.has(key);

    try {
      if (isCurrentlySaved) {
        await AsyncStorage.removeItem(key);
        savedKeysRef.current.delete(key);
        setTrySaved(false);
        emitSavedNailsChange();
      } else {
        const savedItem = {
          name: design.name,
          shape: design.shape as Shape,
          palette: design.colors,
          savedAt: new Date().toISOString(),
          design,
          nailImageUrl: renderedUrl,
          kind: "try",
        };
        await AsyncStorage.setItem(key, JSON.stringify(savedItem));
        savedKeysRef.current.add(key);
        setTrySaved(true);
        emitSavedNailsChange();
      }
    } catch (error) {
      console.error("Failed to save try-on result:", error);
    }
  }, [design, renderedUrl]);

  const spinWheel = useCallback(() => {
    console.log("[Mobile NOTD] spinWheel start", { spinIndex, rotation: rotationRef.current });
    setPhase("spinning");
    setSaved(false);
    setDesign(null);
    setNailImageUrl(null);
    setAiError(null);
    setSpinIndex((index) => index + 1);

    rotationRef.current += 360 * FULL_SPINS + 180;
    Animated.timing(spin, {
      toValue: rotationRef.current,
      duration: SPIN_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      console.log("[Mobile NOTD] spin animation complete", { rotation: rotationRef.current });
      const randomShape = pickWeightedShape();
      setShape(randomShape);
      setPhase("shapeLock");
    });
  }, [spin]);

  useEffect(() => {
    if (phase === "idle") {
      const timer = setTimeout(() => spinWheel(), 600);
      return () => clearTimeout(timer);
    }
  }, [phase, spinWheel]);

  useEffect(() => {
    if (phase === "shapeLock") {
      const timer = setTimeout(() => setPhase("artFill"), 300);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "artFill") return;

    const currentRequestId = ++requestIdRef.current;
    const tags = SPIN_TAGS.slice(0, 3 + (spinIndex % 3));
    console.log("[Mobile NOTD] artFill reached, calling generateNailOfTheDay", { shape, tags, spinIndex });

    generateNailOfTheDay(shape, tags, spinIndex)
      .then((payload) => {
        if (requestIdRef.current !== currentRequestId) return;
        console.log("[Mobile NOTD] generateNailOfTheDay resolved", payload);
        setDesign(payload.design);
        setNailImageUrl(payload.nailImageUrl);
        setPhase("revealed");
      })
      .catch((error: unknown) => {
        if (requestIdRef.current !== currentRequestId) return;
        console.error("[Mobile NOTD] generateNailOfTheDay failed", error);
        setAiError(error instanceof Error ? error.message : "AI generation failed. Please try again.");
        setPhase("revealed");
      });
  }, [phase, shape, spinIndex]);

  const shapePath = SHAPE_PATHS[shape] ?? SHAPE_PATHS.almond;
  const clipId = `notd-nail-${shape}`;
  const designColors = design?.colors ?? [];
  const memoizedNailArt = useMemo(() => {
    if (!design) return null;
    return renderNailArt(design, shapePath, clipId, nailImageUrl);
  }, [design, shapePath, clipId, nailImageUrl]);

  const formatDescription = useCallback((text: string): string[] => {
    return text
      .split(/[.\n]/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, []);

  const showReveal = phase === "shapeLock" || phase === "artFill" || phase === "generating" || phase === "revealed";

  const wheelSectors = useMemo(() => {
    const activeSector = SHAPES.findIndex((s) => s === shape);
    return SHAPES.map((_, index) => (
      <WheelSector key={`sector-${index}`} index={index} active={index === activeSector && phase !== "idle"} />
    ));
  }, [phase, shape]);

  const wheelIcons = useMemo(() => {
    const activeSector = SHAPES.findIndex((s) => s === shape);
    return SHAPES.map((_, index) => (
      <WheelIcon key={`icon-${index}`} index={index} active={index === activeSector && phase !== "idle"} />
    ));
  }, [phase, shape]);

  const wheelDots = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => {
      const angle = (i * 15 * Math.PI) / 180;
      const x = CX + (WHEEL_R - 18) * Math.cos(angle);
      const y = CY + (WHEEL_R - 18) * Math.sin(angle);
      const opacity = 0.25 + (i % 3) * 0.15;
      return <Circle key={i} cx={x} cy={y} r="1.2" fill="#E8D5CE" opacity={opacity} />;
    });
  }, []);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container} style={styles.scrollView}>
        <Text style={styles.title}>Nail of the Day</Text>
        <Text style={styles.subtitle}>Spin the wheel to reveal your next inspiration</Text>

        <View style={styles.row}>
          <View style={styles.wheelContainer}>
            {phase !== "idle" && (
              <>
                <View style={styles.needleRow}>
                  <Svg width="36" height="36" viewBox="0 0 100 100">
                    <Defs>
                      <RadialGradient id="sparkle-grad" cx="50%" cy="50%" r="50%">
                        <Stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
                        <Stop offset="35%" stopColor="#E8D5CE" stopOpacity="0.85" />
                        <Stop offset="100%" stopColor="#D4B8B1" stopOpacity="0" />
                      </RadialGradient>
                    </Defs>
                    <Path d="M 50 0 L 61 39 L 100 50 L 61 61 L 50 100 L 39 61 L 0 50 L 39 39 Z" fill="url(#sparkle-grad)" />
                  </Svg>
                </View>
                {phase === "spinning" && (
                  <View style={styles.starRow}>
                    <Text style={styles.sparkleStar}>✦</Text>
                  </View>
                )}
              </>
            )}
            <View style={styles.wheel}>
              <Animated.View
                style={[
                  styles.wheelInner,
                  {
                    transform: [
                      {
                        rotate: spin.interpolate({
                          inputRange: [0, 1000000],
                          outputRange: ["0deg", "1000000deg"],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Svg width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}>
                  <Defs>
                    <LinearGradient id="wheel-base" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor="#2d3246" />
                      <Stop offset="100%" stopColor="#1e1b2e" />
                    </LinearGradient>
                    <Filter id="wheel-glow">
                      <FeGaussianBlur stdDeviation="3" result="blur" />
                      <FeMerge>
                        <FeMergeNode in="blur" />
                        <FeMergeNode in="SourceGraphic" />
                      </FeMerge>
                    </Filter>
                    <Filter id="soft-glow">
                      <FeGaussianBlur stdDeviation="4" result="blur" />
                      <FeMerge>
                        <FeMergeNode in="SourceGraphic" />
                      </FeMerge>
                    </Filter>
                  </Defs>

                  <Circle cx={CX} cy={CY} r={WHEEL_R - 4} fill="url(#wheel-base)" />
                  {wheelSectors}
                  {wheelIcons}
                  <Circle cx={CX} cy={CY} r={WHEEL_R - 2} fill="none" stroke="rgba(232,213,206,0.15)" strokeWidth="1.5" />
                  <Circle cx={CX} cy={CY} r={28} fill="url(#wheel-base)" stroke="rgba(232,213,206,0.25)" strokeWidth="1.2" />
                  {wheelDots}
                </Svg>
              </Animated.View>
            </View>
          </View>

          <View style={styles.rightPanel}>
            {showReveal && shapePath ? (
              <View style={styles.revealCard}>
                <View style={styles.nailWrap}>
                  {(phase === "shapeLock" || phase === "artFill" || phase === "generating") && (
                    <View style={styles.loadingPulse}>
                      <ActivityIndicator color={palette.pearl} />
                    </View>
                  )}
                  <Svg width={180} height={240} viewBox="0 0 100 120">
                    <Defs>
                      <LinearGradient id="nail-base-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#FFF7F2" />
                        <Stop offset="45%" stopColor="#E8D5CE" />
                        <Stop offset="100%" stopColor="#C9A9A2" />
                      </LinearGradient>
                      <LinearGradient id="chrome-shine" x1="0%" y1="0%" x2="100%" y2="0%">
                        <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
                        <Stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.7" />
                        <Stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.2" />
                        <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                      </LinearGradient>
                      <Mask id={clipId}>
                        <Path d={shapePath} fill="white" />
                      </Mask>
                    </Defs>
                    <Path d={shapePath} fill="none" stroke="#E8D5CE" strokeWidth="2" />
                    {(phase === "generating" || phase === "shapeLock" || phase === "artFill") && (
                      <Path d={shapePath} fill="url(#nail-base-gradient)" opacity="0.85" />
                    )}
                    <G mask={`url(#${clipId})`}>
                      {design && (phase === "artFill" || phase === "revealed") &&
                        memoizedNailArt
                      }
                      {(phase === "artFill" || phase === "revealed") && (
                        <>
                          <Path d={shapePath} fill="url(#chrome-shine)" opacity={0.3} />
                          <Path d={shapePath} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
                        </>
                      )}
                    </G>
                  </Svg>
                </View>

                <View style={styles.revealText}>
                  <Text style={styles.revealLabel}>Today&apos;s Design</Text>
                  <Text style={styles.revealTitle}>{design?.name ?? SHAPE_LABELS[shape]}</Text>
                  {design?.description
                    ? formatDescription(design.description).map((line, index) => (
                        <Text key={`${line}-${index}`} style={styles.revealBody}>
                          {line}
                        </Text>
                      ))
                    : null}
                  {designColors.length > 0 && (
                    <View style={styles.colorList}>
                      {designColors.map((color, index) => (
                        <View key={`${color}-${index}`} style={styles.colorPill}>
                          <View style={[styles.colorDot, { backgroundColor: color }]} />
                          <Text style={styles.colorIndex}>{index + 1}.</Text>
                          <Text style={styles.colorHex}>{color.toUpperCase()}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                    {aiError ? (
                      <View>
                        <Text style={styles.errorText}>{aiError}</Text>
                        <PearlButton label="Retry" onPress={() => {
                          setAiError(null);
                          setPhase("artFill");
                        }} compact />
                      </View>
                    ) : null}
                </View>
              </View>
            ) : null}

            {tryMode !== "idle" ? (
              <View style={styles.tryOnCard}>
                <Text style={styles.tryOnTitle}>Try this look</Text>

                {tryMode === "capture" && (
                  <View style={styles.tryOnActions}>
                    <PearlButton
                      label="Take photo"
                      onPress={() => void pickHandPhoto(true)}
                    />
                    <PearlButton
                      label="Choose photo"
                      onPress={() => void pickHandPhoto(false)}
                    />
                    <PearlButton label="Cancel" onPress={resetTryMe} />
                  </View>
                )}

                {tryMode === "rendering" && (
                  <View style={styles.tryOnCenter}>
                    <ActivityIndicator color={palette.pearl} />
                    <Text style={styles.tryOnStatus}>Rendering your try-on…</Text>
                  </View>
                )}

                {tryMode === "result" && renderedUrl ? (
                  <View style={styles.tryOnCenter}>
                    <Image source={{ uri: renderedUrl }} style={styles.tryOnResult} resizeMode="contain" />
                    <View style={styles.tryOnActions}>
                  <Pressable
                    onPress={() => void toggleTrySaved()}
                    disabled={phase === "spinning"}
                    style={[styles.iconSaveButton, trySaved && styles.iconSaveButtonActive]}
                    hitSlop={10}
                  >
                    <Svg width={20} height={20} viewBox="0 0 24 24" pointerEvents="none">
                      <Path
                        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                        fill={trySaved ? palette.blush : "none"}
                        stroke={palette.blush}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </Pressable>
                      <PearlButton label="Back" onPress={resetTryMe} />
                    </View>
                  </View>
                ) : null}

                {tryMode === "error" && (
                  <View style={styles.tryOnCenter}>
                    <Text style={styles.errorText}>{tryError}</Text>
                    <View style={styles.tryOnActions}>
                      <PearlButton label="Back" onPress={resetTryMe} />
                    </View>
                  </View>
                )}
              </View>
            ) : null}

              <View style={styles.actions}>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => { if (phase !== "spinning") void spinWheel(); }}
                    disabled={phase === "spinning"}
                    style={[
                      styles.spinButton,
                      phase === "spinning" && styles.spinButtonInactive,
                    ]}
                  >
                    <Text style={[styles.spinButtonLabel, phase === "spinning" && styles.spinButtonLabelInactive]}>
                      {phase === "spinning" ? "Spinning..." : "Spin Again"}
                    </Text>
                    {phase === "spinning" ? (
                      <ActivityIndicator color={palette.ink900} style={styles.spinButtonLoader} />
                    ) : null}
                  </Pressable>
                  <Pressable
                    onPress={() => void toggleSaved()}
                    disabled={phase === "spinning"}
                    style={[styles.iconSaveButton, saved && styles.iconSaveButtonActive]}
                    hitSlop={10}
                  >
                    <Svg width={20} height={20} viewBox="0 0 24 24" pointerEvents="none">
                      <Path
                        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                        fill={saved ? palette.blush : "none"}
                        stroke={palette.blush}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </Pressable>
                </View>

                {design && tryMode === "idle" ? (
                  <PearlButton
                    label="Try Me"
                    onPress={() => {
                      startTryMe();
                    }}
                  />
                ) : null}
              </View>
            </View>
        </View>
        </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "relative", flex: 1 },
  scrollView: { flex: 1 },
  container: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 48 },
  title: { ...type.display, color: palette.pearl, fontSize: 32, letterSpacing: 0.8 },
  subtitle: { ...type.body, color: palette.ash, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  row: { flexDirection: "column", gap: spacing.lg },
  wheelContainer: { position: "relative", alignItems: "center", justifyContent: "center", marginTop: spacing.lg, width: WHEEL_SIZE, alignSelf: "center" },
  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_R,
    backgroundColor: alpha(palette.ink800, 0.8),
    borderWidth: 2,
    borderColor: alpha(palette.blush, 0.24),
    ...shadows.glow,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  wheelInner: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  needleRow: { position: "absolute", top: -28, left: WHEEL_SIZE / 2 - 18, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  starRow: { position: "absolute", top: -18, left: WHEEL_SIZE / 2 - 10, width: 20, height: 20, alignItems: "center", justifyContent: "center", zIndex: 1000, elevation: 1000 },
  rightPanel: { gap: spacing.sm, alignItems: "center" },
  revealCard: { gap: spacing.sm, alignItems: "center", padding: spacing.sm },
  nailWrap: { position: "relative", alignItems: "center", justifyContent: "center" },
  loadingPulse: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  revealText: { gap: spacing.sm, alignItems: "center" },
  revealLabel: { ...type.body, color: palette.blush, fontSize: 10, letterSpacing: 0.28, textTransform: "uppercase", marginBottom: 2 },
  revealTitle: { ...type.display, fontFamily: fontFamilies.displayRegular, color: palette.pearl, fontSize: 24, marginTop: 2 },
  revealBody: { ...type.body, color: "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 18, textAlign: "center", textTransform: "uppercase", letterSpacing: 3 },
  colorList: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: spacing.xs },
  colorPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  colorIndex: { ...type.body, color: palette.pearl, fontSize: 10 },
  colorHex: { ...type.body, color: palette.pearl, fontSize: 10 },
  errorText: { ...type.body, color: "#F5C97B", fontSize: 11, textAlign: "center" },
  placeholder: { padding: spacing.xl, borderRadius: radii.lg, backgroundColor: alpha(palette.ink800, 0.5), borderWidth: 1, borderColor: alpha(palette.blush, 0.14) },
  placeholderText: { ...type.body, color: palette.ash, fontSize: 12, textAlign: "center" },
  actions: { flexDirection: "column", gap: spacing.sm, marginTop: spacing.sm },
  actionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  spinButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.blush,
    paddingHorizontal: 26,
    gap: spacing.xs,
    overflow: "hidden",
  },
  spinButtonInactive: {
    backgroundColor: palette.ink900,
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.15),
  },
  spinButtonLabel: {
    ...type.body,
    color: palette.ink900,
    fontWeight: "700",
    fontSize: 15,
  },
  spinButtonLabelInactive: {
    color: palette.ashDim,
  },
  spinButtonLoader: {
    position: "absolute",
  },
  iconSaveButton: {
    height: 44,
    width: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: alpha(palette.blush, 0.3),
    backgroundColor: alpha(palette.ink900, 0.6),
  },
  iconSaveButtonActive: { backgroundColor: palette.ink900, borderColor: palette.rose, ...shadows.glow },
  sparkleOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 2 },
  sparkleQuestion: { fontSize: 40, fontWeight: "700", color: palette.blush, textShadowColor: "rgba(212,184,177,0.7)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  sparkleStar: { fontSize: 20, color: palette.blush, textAlign: "center", textShadowColor: "rgba(212,184,177,0.6)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  tryOnCard: { gap: spacing.sm, alignItems: "center", padding: spacing.sm, borderRadius: radii.lg, backgroundColor: alpha(palette.ink800, 0.5), borderWidth: 1, borderColor: alpha(palette.blush, 0.14) },
  tryOnTitle: { ...type.body, color: palette.blush, fontSize: 10, letterSpacing: 0.28, textTransform: "uppercase", marginBottom: 2 },
  tryOnStatus: { ...type.body, color: palette.pearl, fontSize: 12, marginTop: spacing.sm },
  tryOnCenter: { alignItems: "center", justifyContent: "center", gap: spacing.sm },
  tryOnActions: { flexDirection: "column", gap: spacing.sm, marginTop: spacing.sm },
  tryOnResult: { width: "100%", height: 260, borderRadius: radii.lg, backgroundColor: alpha(palette.ink800, 0.5) },
});
