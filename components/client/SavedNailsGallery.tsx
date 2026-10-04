"use client";

import { useMemo, useState, useEffect } from "react";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { tagLabel } from "@/lib/tags";
import { generateManicure, type ManicureConfig, type NailShape } from "@/services/manicureGenerator";
import { renderNailArt } from "./nailArtRenderer";

interface SavedItem {
  name: string;
  shape: NailShape;
  palette: string[];
  savedAt: string;
  designSpec?: {
    name: string;
    description: string;
    pattern: string;
    finish: string;
    colors: string[];
    tags: string[];
    shape: NailShape;
    complexity: "simple" | "medium" | "complex";
    layers: Array<{
      type: "fill" | "stroke" | "pattern" | "shape" | "filter";
      pattern?: string;
      colors?: string[];
      opacity?: number;
      blend?: "normal" | "multiply" | "screen" | "overlay";
      shapes?: string[];
      filter?: string;
      width?: number;
      dashArray?: string;
    }>;
    texture: string;
    motifs: Array<{
      kind: "star" | "flower" | "heart" | "butterfly" | "pearl" | "bow" | "flame" | "leaf" | "sparkle" | "gem" | "cherry" | "citrus" | "strawberry" | "rainbow";
      x: number;
      y: number;
      size: number;
      color: string;
      rotation: number;
      role: "focal" | "support" | "micro";
    }>;
  };
  nailImageUrl?: string | null;
}

const SAVED_PREFIX = "savedNail::";
const SAVED_DESIGNS_API = "/api/saved-designs";

const NAIL_SHAPE_PATHS: Record<NailShape, string> = {
  almond: "M 25 108 C 25 72, 29 44, 42 20 Q 50 9, 58 20 C 71 44, 75 72, 75 108 C 60 113, 40 113, 25 108 Z",
  coffin_ballerina: "M 25 110 L 37 15 L 63 15 L 75 110 C 60 115, 40 115, 25 110 Z",
  square: "M 25 110 L 25 20 Q 25 15, 30 15 L 70 15 Q 75 15, 75 20 L 75 110 C 60 115, 40 115, 25 110 Z",
  stiletto: "M 35 112 L 43 18 Q 50 8, 57 18 L 65 112 C 55 116, 45 116, 35 112 Z",
  oval: "M 28 108 C 28 68, 32 42, 43 22 Q 50 12, 57 22 C 68 42, 72 68, 72 108 C 60 113, 40 113, 28 108 Z",
  squoval: "M 25 110 L 25 28 Q 25 18, 35 18 L 65 18 Q 75 18, 75 28 L 75 110 C 60 115, 40 115, 25 110 Z",
  round: "M 25 102 C 25 62, 30 36, 43 20 Q 50 12, 57 20 C 70 36, 75 62, 75 102 C 62 108, 38 108, 25 102 Z",
  lipstick: "M 38 112 L 44 26 Q 50 12, 56 26 L 62 112 C 55 116, 45 116, 38 112 Z",
};

function readSaved(): SavedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const items: SavedItem[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(SAVED_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as SavedItem;
        if (parsed && parsed.name && parsed.shape) {
          items.push(parsed);
        }
      } catch {
        // skip invalid entries
      }
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchSavedFromApi(): Promise<SavedItem[]> {
  try {
    const response = await fetch(SAVED_DESIGNS_API + "?userId=anonymous");
    if (!response.ok) return [];
    const data = await response.json();
    return (data.items ?? []) as SavedItem[];
  } catch {
    return [];
  }
}

async function saveToApi(item: SavedItem) {
  try {
    await fetch(SAVED_DESIGNS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "anonymous", item }),
    });
  } catch {
    // ignore
  }
}

async function removeFromApi(item: SavedItem) {
  try {
    await fetch(SAVED_DESIGNS_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "anonymous", item }),
    });
  } catch {
    // ignore
  }
}

function clearAllSaved() {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key && key.startsWith(SAVED_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}

function NailPreview({ shape, palette, designSpec, nailImageUrl }: { shape: NailShape; palette: string[]; designSpec?: SavedItem["designSpec"]; nailImageUrl?: string | null }) {
  const path = NAIL_SHAPE_PATHS[shape] ?? NAIL_SHAPE_PATHS.almond;
  const clipId = `saved-clip-${shape}`;
  const fallback = generateManicure([]);

  if (!designSpec) {
    const [base, accent] = palette;
    return (
      <svg viewBox="0 0 100 120" className="h-full w-full">
        <defs>
          <linearGradient id={`saved-nail-${shape}`} x1="12%" y1="0%" x2="88%" y2="100%">
            <stop offset="0%" stopColor={base ?? fallback.palette[0] ?? "#E8D5CE"} />
            <stop offset="100%" stopColor={accent ?? fallback.palette[1] ?? "#D4B8B1"} />
          </linearGradient>
        </defs>
        <path d={path} fill={`url(#saved-nail-${shape})`} stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 120" className="h-full w-full">
      {renderNailArt(
        designSpec as Parameters<typeof renderNailArt>[0],
        path,
        clipId,
        nailImageUrl ?? null,
      )}
    </svg>
  );
}

export function SavedNailsGallery() {
  const { t } = useLocale();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    void fetchSavedFromApi().then(setItems);
  }, []);

  const nails = useMemo(() => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const colors = item.designSpec?.colors ?? item.palette;
      const key = `${item.name}::${item.shape}::${colors.join("-")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [items]);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSave = async (item: SavedItem) => {
    const key = `savedNail::${item.name}::${item.shape}::${(item.designSpec?.colors ?? item.palette).join("-")}`;
    const isSaved = items.some((existing) => {
      const existingKey = `savedNail::${existing.name}::${existing.shape}::${(existing.designSpec?.colors ?? existing.palette).join("-")}`;
      return existingKey === key;
    });

    if (isSaved) {
      await removeFromApi(item);
    } else {
      await saveToApi(item);
    }
    void fetchSavedFromApi().then(setItems);
  };

  return (
    <section id="saved-nails" className="mt-16 md:mt-24">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.28em] text-blush-300/70 uppercase">Saved</p>
          <h2 className="pearl-text mt-2 text-[clamp(22px,3.2vw,32px)] leading-tight">Your favorite nails</h2>
        </div>
        {mounted && items.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              clearAllSaved();
              setItems([]);
            }}
            className="btn-ghost !px-4 !py-2 !text-xs"
          >
            Clear
          </button>
        ) : null}
      </div>

      {nails.length === 0 ? (
        <p className="mt-6 text-sm text-blush-300/70">No saved nails yet. Hit the heart on a design to keep it here.</p>
      ) : (
        <div className="mt-8 w-full overflow-x-auto pb-6">
          <div className="flex gap-5 snap-x snap-mandatory">
            {nails.map((item) => {
              const date = item.savedAt ? new Date(item.savedAt) : null;
              const label = date
                ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
                : "";
              const colors = item.designSpec?.colors ?? item.palette;
              const itemKey = `${item.name}::${item.shape}::${colors.join("-")}`;
              const isExpanded = expandedKeys.has(itemKey);

              return (
                <div
                  key={itemKey}
                  className="card w-full min-w-[180px] max-w-[220px] flex-1 snap-center cursor-pointer"
                  onClick={() => toggleExpand(itemKey)}
                >
                  <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl bg-ink-900/60">
                    <NailPreview shape={item.shape} palette={item.palette} designSpec={item.designSpec} nailImageUrl={item.nailImageUrl} />
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-white/90">{item.name || "Saved look"}</p>
                    <p className="mt-1 text-xs text-blush-300/80">
                      {label}
                      {item.palette.length > 0 ? ` • ${item.palette.length} colors` : ""}
                    </p>
                    {isExpanded && colors.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {colors.map((color) => (
                          <span
                            key={color}
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/90"
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            {color.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
