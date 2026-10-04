"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, useAnimation, useReducedMotion, type Variants } from "framer-motion";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { tagLabel } from "@/lib/tags";
import type { Look } from "@/lib/types";
import { generateManicure, type ManicureConfig, type NailShape } from "@/services/manicureGenerator";
import { renderNailArt } from "./nailArtRenderer";
import { publicEnv } from "@/lib/env";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface NailOfTheDayRevealProps {
  looks: Look[];
  onComplete: (manicure: ManicureConfig, selectedLook: Look | null) => void;
}

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

type Phase =
  | "idle"
  | "spinning"
  | "generating"
  | "shapeLock"
  | "artFill"
  | "revealed";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const SPIN_DURATION = 3.5;
const SECTOR_COUNT = 8;
const SLICE_DEG = 360 / SECTOR_COUNT;
const FULL_SPINS = 5;
const EASE_OUT = [0.15, 0.85, 0.35, 1.2] as const;
const WHEEL_R = 220;
const CX = WHEEL_R;
const CY = WHEEL_R;
const WHEEL_SIZE = WHEEL_R * 2;

const SHAPE_WEIGHTS: Record<NailShape, number> = {
  almond: 3,
  coffin_ballerina: 1,
  square: 3,
  stiletto: 2,
  oval: 3,
  squoval: 2,
  round: 3,
  lipstick: 1,
};

const SHAPES: NailShape[] = [
  "almond",
  "coffin_ballerina",
  "square",
  "stiletto",
  "oval",
  "squoval",
  "round",
  "lipstick",
];

function pickWeightedShape(): NailShape {
  const totalWeight = SHAPES.reduce(
    (sum, shape) => sum + SHAPE_WEIGHTS[shape],
    0,
  );

  let random = Math.random() * totalWeight;

  for (const shape of SHAPES) {
    random -= SHAPE_WEIGHTS[shape];

    if (random <= 0) {
      return shape;
    }
  }

  return SHAPES[0]!;
}

const SHAPE_LABELS: Record<NailShape, string> = {
  almond: "Almond",
  coffin_ballerina: "Coffin Ballerina",
  square: "Square",
  stiletto: "Stiletto",
  oval: "Oval",
  squoval: "Squoval",
  round: "Round",
  lipstick: "Lipstick",
};

const NAIL_ICON_SIZE = 36;

const NAIL_SHAPE_ICONS: Record<
  NailShape,
  { path: string; viewBox: string }
> = {
  almond: {
    path: "M 25 108 C 25 72, 29 44, 42 20 Q 50 9, 58 20 C 71 44, 75 72, 75 108 C 60 113, 40 113, 25 108 Z",
    viewBox: "0 0 100 120",
  },

  coffin_ballerina: {
    path: "M 25 110 L 37 15 L 63 15 L 75 110 C 60 115, 40 115, 25 110 Z",
    viewBox: "0 0 100 120",
  },

  square: {
    path: "M 25 110 L 25 20 Q 25 15, 30 15 L 70 15 Q 75 15, 75 20 L 75 110 C 60 115, 40 115, 25 110 Z",
    viewBox: "0 0 100 120",
  },

  stiletto: {
    path: "M 25 110 Q 30 60, 50 5 Q 70 60, 75 110 C 60 115, 40 115, 25 110 Z",
    viewBox: "0 0 100 120",
  },

  oval: {
    path: "M 25 110 L 25 50 C 25 20, 75 20, 75 50 L 75 110 C 60 115, 40 115, 25 110 Z",
    viewBox: "0 0 100 120",
  },

  squoval: {
    path: "M 25 110 L 25 46 Q 25 15, 50 15 Q 75 15, 75 46 L 75 110 C 60 115, 40 115, 25 110 Z",
    viewBox: "0 0 100 120",
  },

  round: {
    path: "M 25 110 L 25 60 C 25 35, 75 35, 75 60 L 75 110 C 60 115, 40 115, 25 110 Z",
    viewBox: "0 0 100 120",
  },

  lipstick: {
    path: "M 25 110 L 25 35 L 75 15 L 75 110 C 60 115, 40 115, 25 110 Z",
    viewBox: "0 0 100 120",
  },
};

const NAIL_SHAPE_PATHS: Record<NailShape, string> = {
  almond:
    "M 25 108 C 25 72, 29 44, 42 20 Q 50 9, 58 20 C 71 44, 75 72, 75 108 C 60 113, 40 113, 25 108 Z",

  coffin_ballerina:
    "M 25 110 L 37 15 L 63 15 L 75 110 C 60 115, 40 115, 25 110 Z",

  square:
    "M 25 110 L 25 20 Q 25 15, 30 15 L 70 15 Q 75 15, 75 20 L 75 110 C 60 115, 40 115, 25 110 Z",

  stiletto:
    "M 25 110 Q 30 60, 50 5 Q 70 60, 75 110 C 60 115, 40 115, 25 110 Z",

  oval:
    "M 25 110 L 25 50 C 25 20, 75 20, 75 50 L 75 110 C 60 115, 40 115, 25 110 Z",

  squoval:
    "M 25 110 L 25 46 Q 25 15, 50 15 Q 75 15, 75 46 L 75 110 C 60 115, 40 115, 25 110 Z",

  round:
    "M 25 110 L 25 60 C 25 35, 75 35, 75 60 L 75 110 C 60 115, 40 115, 25 110 Z",

  lipstick:
    "M 25 110 L 25 35 L 75 15 L 75 110 C 60 115, 40 115, 25 110 Z",
};

/* -------------------------------------------------------------------------- */
/* Geometry helpers                                                           */
/* -------------------------------------------------------------------------- */

function polarToCartesian(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;

  return {
    x: CX + r * Math.cos(rad),
    y: CY + r * Math.sin(rad),
  };
}

function sectorPath(index: number): string {
  const start = index * SLICE_DEG;
  const end = start + SLICE_DEG;

  const p1 = polarToCartesian(start, WHEEL_R);
  const p2 = polarToCartesian(end, WHEEL_R);

  const largeArc = 0;

  return `M ${CX} ${CY} L ${p1.x} ${p1.y} A ${WHEEL_R} ${WHEEL_R} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
}

/* -------------------------------------------------------------------------- */
/* Framer Motion variants                                                     */
/* -------------------------------------------------------------------------- */

const wheelVariants: Variants = {
  idle: {
    rotate: 0,
    scale: 1,
  },

  spinning: {
    rotate: 360 * FULL_SPINS + 180,
    scale: 1.02,
    transition: {
      duration: SPIN_DURATION,
      ease: EASE_OUT,
    },
  },

  revealed: {
    rotate: 360 * FULL_SPINS + 180,
    scale: [1, 1.04, 1],
    transition: {
      duration: 0.7,
      ease: "easeOut",
    },
  },
};

const overlayVariants: Variants = {
  idle: {
    opacity: 0,
  },

  spinning: {
    opacity: 1,
    transition: {
      duration: 0.3,
    },
  },

  revealed: {
    opacity: 0,
    transition: {
      duration: 0.5,
      delay: 0.2,
    },
  },
};

const blurVariants: Variants = {
  idle: {
    filter: "blur(0px)",
  },

  spinning: {
    filter: [
      "blur(0px)",
      "blur(6px)",
      "blur(4px)",
      "blur(6px)",
      "blur(2px)",
      "blur(5px)",
      "blur(0px)",
    ],

    transition: {
      duration: SPIN_DURATION,
      times: [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1],
    },
  },

  revealed: {
    filter: "blur(0px)",
    transition: {
      duration: 0.5,
    },
  },
};

const sparkleVariants: Variants = {
  idle: {
    opacity: 0,
    scale: 0.6,
  },

  spinning: {
    opacity: [0.2, 0.9, 0.2],
    scale: [0.6, 1.3, 0.6],

    transition: {
      duration: 0.7,
      repeat: Infinity,
    },
  },

  revealed: {
    opacity: [0.5, 1, 0.5],
    scale: [1, 1.5, 1],

    transition: {
      duration: 1.8,
      repeat: Infinity,
      repeatDelay: 0.4,
    },
  },
};

const needleVariants: Variants = {
  idle: {
    y: 0,
  },

  spinning: {
    y: [0, -3, 0, -2, 0],

    transition: {
      duration: SPIN_DURATION,
      times: [0, 0.2, 0.4, 0.7, 1],
    },
  },

  revealed: {
    y: 0,

    transition: {
      duration: 0.3,
    },
  },
};

const shapeRevealVariants: Variants = {
  idle: {
    scale: 0.8,
    opacity: 0,
  },

  shapeLock: {
    scale: [0.8, 1.1, 1],
    opacity: 1,

    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },

  artFill: {
    scale: 1,
    opacity: 1,

    transition: {
      duration: 0.3,
    },
  },

  generating: {
    scale: 1,
    opacity: 1,

    transition: {
      duration: 0.3,
    },
  },

  revealed: {
    scale: 1,
    opacity: 1,
  },
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

/* -------------------------------------------------------------------------- */
/* Complex nail art renderer                                                  */
/* -------------------------------------------------------------------------- */

interface DesignSpec {
  name: string;
  description: string;
  pattern: string;
  finish: string;
  colors: string[];
  tags: string[];
  shape: NailShape;
  complexity: "simple" | "medium" | "complex";
  layers: Layer[];
  texture: string;
  motifs: Motif[];
}

interface Motif {
  kind:
    | "star"
    | "flower"
    | "heart"
    | "butterfly"
    | "pearl"
    | "bow"
    | "flame"
    | "leaf"
    | "sparkle"
    | "gem"
    | "cherry"
    | "citrus"
    | "strawberry"
    | "rainbow";

  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
  role: "focal" | "support" | "micro";
}

interface Layer {
  type: "fill" | "stroke" | "pattern" | "shape" | "filter";
  pattern?: string;
  colors?: string[];
  opacity?: number;
  blend?: "normal" | "multiply" | "screen" | "overlay";
  shapes?: string[];
  filter?: string;
  width?: number;
  dashArray?: string;
}

function renderMotif(motif: Motif, index: number) {
  const { kind, size, color } = motif;

  const transform = `translate(${motif.x} ${motif.y}) rotate(${motif.rotation})`;

  let artwork: ReactNode;

  switch (kind) {
    case "flower":
      artwork = (
        <>
          {Array.from({ length: 6 }, (_, petal) => (
            <ellipse
              key={petal}
              cx="0"
              cy={-size * 0.53}
              rx={size * 0.28}
              ry={size * 0.55}
              fill={petal % 2 ? color : "#FFF4E8"}
              transform={`rotate(${petal * 60})`}
            />
          ))}

          <circle r={size * 0.24} fill="#D7A947" />
          <circle r={size * 0.1} fill="#FFF3C4" />
        </>
      );
      break;

    case "butterfly":
      artwork = (
        <g
          stroke={color}
          strokeWidth={size * 0.12}
          strokeLinejoin="round"
        >
          <path
            d={`M 0 0 C ${-size * 0.25} ${-size * 1.05}, ${-size * 1.15} ${-size * 0.95}, ${-size * 0.9} ${-size * 0.12} C ${-size * 0.65} ${size * 0.15}, ${-size * 0.35} ${size * 0.08}, 0 0 Z`}
            fill={color}
          />

          <path
            d={`M 0 0 C ${size * 0.25} ${-size * 1.05}, ${size * 1.15} ${-size * 0.95}, ${size * 0.9} ${-size * 0.12} C ${size * 0.65} ${size * 0.15}, ${size * 0.35} ${size * 0.08}, 0 0 Z`}
            fill="#FFF1E8"
          />

          <path
            d={`M 0 ${-size * 0.55} L 0 ${size * 0.35} M 0 ${-size * 0.45} Q ${-size * 0.35} ${-size * 0.95} ${-size * 0.55} ${-size * 0.8} M 0 ${-size * 0.45} Q ${size * 0.35} ${-size * 0.95} ${size * 0.55} ${-size * 0.8}`}
            fill="none"
            stroke="#5B3445"
            strokeWidth={size * 0.1}
            strokeLinecap="round"
          />
        </g>
      );
      break;

    case "heart":
      artwork = (
        <path
          d={`M 0 ${size * 0.75} C ${-size * 1.15} ${-size * 0.05}, ${-size * 0.8} ${-size * 0.85}, 0 ${-size * 0.35} C ${size * 0.8} ${-size * 0.85}, ${size * 1.15} ${-size * 0.05}, 0 ${size * 0.75} Z`}
          fill={color}
          stroke="#FFF5F0"
          strokeWidth={size * 0.08}
        />
      );
      break;

    case "star":
    case "sparkle":
      artwork = (
        <path
          d={`M 0 ${-size} L ${size * 0.2} ${-size * 0.2} L ${size} 0 L ${size * 0.2} ${size * 0.2} L 0 ${size} L ${-size * 0.2} ${size * 0.2} L ${-size} 0 L ${-size * 0.2} ${-size * 0.2} Z`}
          fill={color}
          stroke="#FFF7E4"
          strokeWidth={size * 0.07}
        />
      );
      break;

    case "pearl":
      artwork = (
        <>
          <circle r={size} fill={color} opacity="0.3" />

          <circle
            r={size * 0.72}
            fill="#FFF8F0"
            stroke={color}
            strokeWidth={size * 0.16}
          />

          <ellipse
            cx={-size * 0.22}
            cy={-size * 0.28}
            rx={size * 0.2}
            ry={size * 0.12}
            fill="#FFFFFF"
            opacity="0.9"
          />
        </>
      );
      break;

    case "bow":
      artwork = (
        <g
          fill="none"
          stroke={color}
          strokeWidth={size * 0.22}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d={`M 0 0 C ${-size * 1.5} ${-size * 1.4}, ${-size * 1.7} ${size * 0.7}, 0 0 C ${size * 1.7} ${-size * 1.4}, ${size * 1.5} ${size * 0.7}, 0 0`}
          />

          <path
            d={`M 0 0 Q ${-size * 0.45} ${size * 0.85} ${-size * 0.9} ${size * 1.4} M 0 0 Q ${size * 0.45} ${size * 0.85} ${size * 0.9} ${size * 1.4}`}
          />

          <circle r={size * 0.22} fill="#FFF4E8" />
        </g>
      );
      break;

    case "flame":
      artwork = (
        <path
          d={`M 0 ${size} C ${-size * 1.1} ${size * 0.15}, ${-size * 0.15} ${-size * 0.25}, ${-size * 0.05} ${-size} C ${size * 0.8} ${-size * 0.15}, ${size * 0.8} ${size * 0.35}, 0 ${size} Z`}
          fill={color}
          stroke="#FFF1D8"
          strokeWidth={size * 0.1}
        />
      );
      break;

    case "leaf":
      artwork = (
        <g>
          <path
            d={`M ${-size * 0.15} ${size} C ${-size * 1.25} ${size * 0.05}, ${-size * 0.25} ${-size * 1.2}, ${size} ${-size} C ${size * 0.95} ${size * 0.1}, ${size * 0.65} ${size * 0.85}, ${-size * 0.15} ${size} Z`}
            fill={color}
          />

          <path
            d={`M ${-size * 0.2} ${size * 0.75} Q ${size * 0.25} 0 ${size * 0.8} ${-size * 0.78}`}
            fill="none"
            stroke="#FFF8E8"
            strokeWidth={size * 0.1}
          />
        </g>
      );
      break;

    case "gem":
      artwork = (
        <g
          stroke="#FFF5E8"
          strokeWidth={size * 0.08}
          strokeLinejoin="round"
        >
          <path
            d={`M ${-size} ${-size * 0.35} L ${-size * 0.45} ${-size} L ${size * 0.55} ${-size} L ${size} ${-size * 0.3} L 0 ${size} Z`}
            fill={color}
          />

          <path
            d={`M ${-size} ${-size * 0.35} L 0 ${-size * 0.3} L ${-size * 0.45} ${-size} M 0 ${-size * 0.3} L ${size * 0.55} ${-size} M 0 ${-size * 0.3} L 0 ${size}`}
            fill="none"
            opacity="0.8"
          />
        </g>
      );
      break;

    case "cherry":
      artwork = (
        <g>
          <path
            d={`M ${-size * 0.3} ${-size * 0.25} Q ${-size * 0.35} ${-size * 1.05} ${size * 0.2} ${-size * 1.15} M ${size * 0.25} ${-size * 0.25} Q ${size * 0.3} ${-size * 0.95} ${size * 0.2} ${-size * 1.15}`}
            fill="none"
            stroke="#586B4D"
            strokeWidth={size * 0.13}
            strokeLinecap="round"
          />

          <path
            d={`M ${size * 0.18} ${-size * 1.12} Q ${size * 0.7} ${-size * 1.38} ${size * 0.82} ${-size * 1.03} Q ${size * 0.5} ${-size * 0.88} ${size * 0.18} ${-size * 1.12} Z`}
            fill="#81916B"
          />

          <circle
            cx={-size * 0.33}
            cy={size * 0.2}
            r={size * 0.48}
            fill={color}
            stroke="#FFF2E8"
            strokeWidth={size * 0.08}
          />

          <circle
            cx={size * 0.35}
            cy={size * 0.23}
            r={size * 0.48}
            fill={color}
            stroke="#FFF2E8"
            strokeWidth={size * 0.08}
          />

          <ellipse
            cx={-size * 0.48}
            cy={size * 0.02}
            rx={size * 0.11}
            ry={size * 0.2}
            fill="#FFFFFF"
            opacity="0.72"
            transform={`rotate(24 ${-size * 0.48} ${size * 0.02})`}
          />

          <ellipse
            cx={size * 0.2}
            cy={size * 0.05}
            rx={size * 0.1}
            ry={size * 0.18}
            fill="#FFFFFF"
            opacity="0.72"
            transform={`rotate(24 ${size * 0.2} ${size * 0.05})`}
          />
        </g>
      );
      break;

    case "citrus":
      artwork = (
        <g>
          <circle
            r={size * 0.92}
            fill="#FFF8E8"
            stroke={color}
            strokeWidth={size * 0.15}
          />

          <circle
            r={size * 0.73}
            fill={color}
            opacity="0.84"
          />

          {Array.from({ length: 7 }, (_, segment) => (
            <path
              key={segment}
              d={`M 0 0 L 0 ${-size * 0.68}`}
              transform={`rotate(${segment * (360 / 7)})`}
              stroke="#FFF8E8"
              strokeWidth={size * 0.1}
              strokeLinecap="round"
              opacity="0.9"
            />
          ))}

          <circle r={size * 0.12} fill="#FFF8E8" />
        </g>
      );
      break;

    case "strawberry":
      artwork = (
        <g>
          <path
            d={`M 0 ${size * 0.95} C ${-size * 1.15} ${size * 0.18}, ${-size * 0.85} ${-size * 0.7}, 0 ${-size * 0.38} C ${size * 0.85} ${-size * 0.7}, ${size * 1.15} ${size * 0.18}, 0 ${size * 0.95} Z`}
            fill={color}
            stroke="#FFF1E8"
            strokeWidth={size * 0.08}
          />

          <path
            d={`M ${-size * 0.55} ${-size * 0.4} Q 0 ${-size * 0.75} ${size * 0.55} ${-size * 0.4} M ${-size * 0.38} ${-size * 0.42} L ${-size * 0.15} ${-size * 0.72} M ${size * 0.38} ${-size * 0.42} L ${size * 0.15} ${-size * 0.72}`}
            fill="none"
            stroke="#70845D"
            strokeWidth={size * 0.15}
            strokeLinecap="round"
          />

          {[-0.42, 0, 0.42].map((x, seed) => (
            <ellipse
              key={seed}
              cx={size * x}
              cy={size * (seed === 1 ? 0.05 : 0.32)}
              rx={size * 0.045}
              ry={size * 0.08}
              fill="#FFE7A8"
              transform={`rotate(18 ${size * x} ${size * (seed === 1 ? 0.05 : 0.32)})`}
            />
          ))}
        </g>
      );
      break;

    case "rainbow": {
      const stripeColors = [
        "#D99A9A",
        "#E4B995",
        "#DED19B",
        "#AFC2A2",
        "#A8BBD0",
        "#B8A8C8",
      ];

      artwork = (
        <g fill="none" strokeLinecap="round">
          {stripeColors.map((stripe, arc) => (
            <path
              key={stripe}
              d={`M ${-size} ${size * 0.28} A ${size - arc * size * 0.13} ${size - arc * size * 0.13} 0 0 1 ${size} ${size * 0.28}`}
              stroke={stripe}
              strokeWidth={size * 0.13}
            />
          ))}
        </g>
      );

      break;
    }
  }

  const twinkle = kind === "pearl" || kind === "sparkle";

  const roleScale =
    motif.role === "focal"
      ? 1
      : motif.role === "micro"
        ? 0.78
        : 0.9;

  return (
    <motion.g
      key={`motif-${index}-${kind}`}
      transform={`${transform} scale(${roleScale})`}
      opacity={motif.role === "micro" ? 0.86 : 1}
      animate={
        twinkle
          ? {
              opacity: [0.72, 1, 0.72],
            }
          : undefined
      }
      transition={
        twinkle
          ? {
              duration: 2.4,
              repeat: Infinity,
              delay: index * 0.12,
              ease: "easeInOut",
            }
          : undefined
      }
    >
      {artwork}
    </motion.g>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export function NailOfTheDayReveal({
  looks,
  onComplete,
}: NailOfTheDayRevealProps) {
  const { t } = useLocale();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("idle");
  const [manicure, setManicure] = useState<ManicureConfig | null>(null);
  const [selectedLook, setSelectedLook] = useState<Look | null>(null);
  const [winningShape, setWinningShape] = useState<NailShape | null>(null);
  const [winningTags, setWinningTags] = useState<string[]>([]);
  const [particles, setParticles] = useState<
    Array<{
      id: number;
      x: number;
      y: number;
      size: number;
      delay: number;
    }>
  >([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [designSpec, setDesignSpec] = useState<DesignSpec | null>(null);
  const [nailImageUrl, setNailImageUrl] = useState<string | null>(null);
  const [spinIndex, setSpinIndex] = useState(0);
  const [saved, setSaved] = useState(false);

  const controls = useAnimation();
  const overlayControls = useAnimation();
  const blurControls = useAnimation();
  const sparkleControls = useAnimation();
  const needleControls = useAnimation();
  const shapeControls = useAnimation();

  const reducedMotion = useReducedMotion();

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const SAVED_DESIGNS_API = "/api/saved-designs";

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

  /* ------------------------------------------------------------------------ */
  /* Saved state                                                              */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!manicure) {
      return;
    }

    const key = `savedNail::${manicure.id}`;

    setSaved(
      (prev) =>
        prev ?? Boolean(localStorage.getItem(key)),
    );
  }, [manicure?.id]);

  useEffect(() => {
    if (!manicure) {
      return;
    }

    const key = `savedNail::${manicure.id}`;

    if (saved) {
      const savedDesign = designSpec ?? null;

      localStorage.setItem(
        key,
        JSON.stringify({
          name: manicure.name,
          shape: manicure.shape,
          palette: manicure.palette,
          savedAt: new Date().toISOString(),
          designSpec: savedDesign,
          nailImageUrl,
        }),
      );
    } else {
      localStorage.removeItem(key);
    }
  }, [
    saved,
    manicure?.id,
    manicure,
    designSpec,
    nailImageUrl,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Looks                                                                     */
  /* ------------------------------------------------------------------------ */

  const shuffledLooks = useMemo(() => {
    const arr = [...looks];

    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }

    return arr;
  }, [looks]);

  const fallbackLook = useMemo(
    () => looks[0] ?? null,
    [looks],
  );

  const allTags = useMemo(() => {
    const tags = new Set<string>();

    looks.forEach((look) => {
      look.tags.forEach((tag) => {
        tags.add(tag);
      });
    });

    return Array.from(tags).filter(
      (tag) =>
        /^[a-z_]+$/.test(tag) &&
        !["relaxing", "lavender", "calm"].includes(tag),
    );
  }, [looks]);

  /* ------------------------------------------------------------------------ */
  /* AI generation                                                            */
  /* ------------------------------------------------------------------------ */

  const generateDesign = useCallback(
    async (shape: NailShape, tags: string[]) => {
      setPhase("generating");
      setAiError(null);
      setSaved(false);

      console.log(
        "[NailOfTheDay] generateDesign start",
        shape,
        tags,
        "spinIndex",
        spinIndex,
      );

      try {
        const response = await fetch(
          "/api/generate-design",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              shape,
              tags,
              salt: spinIndex,
            }),
          },
        );

        const text = await response.text();

        const payload = text
          ? (JSON.parse(text) as {
              design?: DesignSpec;
              aiGenerated?: boolean;
              nailImageUrl?: string | null;
              error?: string;
            })
          : {};

        if (!response.ok || !payload.design) {
          throw new Error(
            payload.error ?? "AI generation failed.",
          );
        }

        setAiError(null);
        setDesignSpec(payload.design);
        setNailImageUrl(
          payload.nailImageUrl ?? null,
        );

        const nextManicure =
          generateManicure([]);

        const designColors =
          payload.design.colors ??
          nextManicure.palette;

        const [
          baseColor,
          accentColor,
        ] =
          designColors.length > 0
            ? designColors
            : nextManicure.palette;

        const safeBaseColor =
          baseColor ??
          nextManicure.palette[0] ??
          "#E8D5CE";

        const safeAccentColor =
          accentColor ??
          nextManicure.palette[1] ??
          nextManicure.palette[0] ??
          "#d4b8b1";

        const merged: ManicureConfig = {
          ...nextManicure,
          name:
            payload.design.name ||
            nextManicure.name,
          description:
            payload.design.description ||
            nextManicure.description,
          shape:
            payload.design.shape ||
            shape,
          palette: [
            safeBaseColor,
            safeAccentColor,
            ...designColors.slice(2),
          ],
        };

        setManicure(merged);
        setPhase("revealed");

        onComplete(
          merged,
          fallbackLook,
        );
      } catch (error) {
        console.error(
          "[NailOfTheDay] AI generation failed:",
          error,
        );

        setAiError(
          error instanceof Error
            ? error.message
            : "AI generation failed. Please try again.",
        );

        const nextManicure = {
          ...generateManicure([]),
          shape,
        };

        setManicure(nextManicure);
        setPhase("revealed");

        onComplete(
          nextManicure,
          fallbackLook,
        );
      }
    },
    [
      fallbackLook,
      onComplete,
      spinIndex,
    ],
  );

  /* ------------------------------------------------------------------------ */
  /* Spin logic                                                               */
  /* ------------------------------------------------------------------------ */

  const spin = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
    }

    setPhase("spinning");
    setManicure(null);
    setSelectedLook(null);
    setWinningShape(null);
    setWinningTags([]);
    setParticles([]);
    setAiError(null);
    setDesignSpec(null);
    setNailImageUrl(null);
    setSaved(false);

    setSpinIndex((index) => index + 1);

    const randomShape =
      pickWeightedShape();

    const availableTags = [...allTags];

    for (
      let index = availableTags.length - 1;
      index > 0;
      index--
    ) {
      const swapIndex = Math.floor(
        Math.random() * (index + 1),
      );

      [
        availableTags[index],
        availableTags[swapIndex],
      ] = [
        availableTags[swapIndex]!,
        availableTags[index]!,
      ];
    }

    const randomTags =
      availableTags.length > 0
        ? availableTags.slice(
            0,
            Math.floor(
              Math.random() * 3,
            ) + 1,
          )
        : [
            "milky_white",
            "chrome_pearl",
          ];

    const winnerIndex =
      shuffledLooks.length > 0
        ? Math.floor(
            Math.random() *
              shuffledLooks.length,
          )
        : 0;

    const winner =
      shuffledLooks[winnerIndex] ??
      fallbackLook;

    const totalTicks = Math.ceil(
      (SPIN_DURATION * 1000) / 120,
    );

    let tickCount = 0;

    tickRef.current =
      setInterval(() => {
        tickCount++;

        if (
          tickCount >= totalTicks
        ) {
          if (tickRef.current) {
            clearInterval(
              tickRef.current,
            );
          }

          tickRef.current = null;

          setWinningShape(
            randomShape,
          );

          setWinningTags(
            randomTags,
          );

          setSelectedLook(
            winner,
          );

          setPhase("shapeLock");

          console.log(
            "[NailOfTheDay] spin complete",
            randomShape,
            randomTags,
          );
        }
      }, 120);
  }, [
    allTags,
    shuffledLooks,
    fallbackLook,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Effects                                                                  */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    return () => {
      if (tickRef.current) {
        clearInterval(
          tickRef.current,
        );
      }
    };
  }, []);

  useEffect(() => {
    if (phase === "spinning") {
      controls.start("spinning");
      overlayControls.start("spinning");
      blurControls.start("spinning");
      sparkleControls.start("spinning");
      needleControls.start("spinning");
      shapeControls.start("idle");
    } else if (phase === "revealed") {
      controls.start("revealed");
      overlayControls.start("revealed");
      blurControls.start("revealed");
      sparkleControls.start("revealed");
      needleControls.start("revealed");
      shapeControls.start("revealed");
    } else if (
      phase === "shapeLock" ||
      phase === "artFill" ||
      phase === "generating"
    ) {
      controls.start("revealed");
      overlayControls.start("revealed");
      blurControls.start("revealed");
      sparkleControls.start("revealed");
      needleControls.start("revealed");
      shapeControls.start(
        phase,
      );
    } else {
      controls.start("idle");
      overlayControls.start("idle");
      blurControls.start("idle");
      sparkleControls.start("idle");
      needleControls.start("idle");
      shapeControls.start("idle");
    }
  }, [
    phase,
    controls,
    overlayControls,
    blurControls,
    sparkleControls,
    needleControls,
    shapeControls,
  ]);

  useEffect(() => {
    if (phase !== "shapeLock") {
      return;
    }

    shapeControls.start(
      "shapeLock",
    );

    const timer =
      setTimeout(() => {
        setPhase("artFill");
        shapeControls.start(
          "artFill",
        );
      }, 500);

    return () =>
      clearTimeout(timer);
  }, [
    phase,
    shapeControls,
  ]);

  useEffect(() => {
    if (
      phase === "artFill" &&
      winningShape
    ) {
      console.log(
        "[NailOfTheDay] artFill reached, calling generateDesign",
      );

      generateDesign(
        winningShape,
        winningTags,
      );
    }
  }, [
    phase,
    winningShape,
    winningTags,
    generateDesign,
  ]);

  useEffect(() => {
    if (phase !== "revealed") {
      return;
    }

    const newParticles =
      Array.from(
        { length: 18 },
      ).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size:
          Math.random() * 6 + 3,
        delay:
          Math.random() * 0.4,
      }));

    setParticles(
      newParticles,
    );
  }, [phase]);

  /* ------------------------------------------------------------------------ */
  /* Derived state                                                            */
  /* ------------------------------------------------------------------------ */

  const displayManicure =
    useMemo(
      () =>
        manicure ??
        generateManicure([]),
      [manicure],
    );

  const displayLook =
    selectedLook ??
    fallbackLook;

  const shapePath =
    winningShape
      ? NAIL_SHAPE_PATHS[
          winningShape
        ]
      : null;

  const shapeGradient =
    useMemo(() => {
      const tags =
        winningTags.filter(
          (tag) =>
            ![
              "relaxing",
              "lavender",
              "calm",
            ].includes(tag),
        );

      if (!tags.length) {
        return "linear-gradient(135deg, #2d3246, #1e1b2e)";
      }

      const colors =
        tags
          .slice(0, 2)
          .map((tag) => {
            const hash =
              tag
                .split("")
                .reduce(
                  (a, b) =>
                    ((a << 5) -
                      a +
                      b.charCodeAt(
                        0,
                      )) |
                    0,
                  0,
                );

            const hue =
              Math.abs(
                hash % 360,
              );

            return `hsl(${hue}, 45%, 55%)`;
          });

      return `linear-gradient(135deg, ${colors.join(", ")})`;
    }, [winningTags]);

  const formatDescription = useCallback((text: string, designName?: string): string[] => {
    const prefix = designName ? `${designName}` : "";
    const body = text
      .split(/[.\n]/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return prefix ? [prefix, ...body] : body;
  }, []);

  const designColors = useMemo(() => {
    if (!designSpec) {
      return displayManicure.palette;
    }

    const colors = new Set<string>();

    designSpec.colors?.forEach((color) => colors.add(color));
    designSpec.layers?.forEach((layer) => {
      layer.colors?.forEach((color) => colors.add(color));
    });
    designSpec.motifs?.forEach((motif) => colors.add(motif.color));

    return Array.from(colors);
  }, [designSpec, displayManicure.palette]);

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <section
      aria-labelledby="notd-heading"
      className="space-y-6"
    >
      <header>
        <h1
          id="notd-heading"
          className="text-[clamp(30px,5vw,48px)] leading-[1.05]"
        >
          {t.notd.title}
        </h1>

        <p className="mt-2 mb-8 max-w-[60ch] text-white/70">
          {t.notd.body}
        </p>
      </header>

      <div className="flex w-full flex-col gap-8 !p-6 md:!p-10 lg:flex-row lg:items-center">
        {/* Wheel - left column */}

        <div className="flex w-full flex-shrink-0 items-center justify-center lg:w-1/2">
          <div className="relative w-full max-w-[440px]">
            <div
              className="relative w-full"
              style={{
                aspectRatio: "1/1",
              }}
            >
              <motion.svg
                className="h-full w-full drop-shadow-[0_0_24px_rgba(212,184,177,0.35)]"
                variants={
                  wheelVariants
                }
                animate={
                  controls
                }
                viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}
                transition={
                  reducedMotion
                    ? {
                        duration: 0,
                      }
                    : {
                        duration:
                          SPIN_DURATION,
                      }
                }
              >
                <defs>
                  <radialGradient
                    id="wheel-base"
                    cx="50%"
                    cy="50%"
                    r="50%"
                  >
                    <stop
                      offset="0%"
                      stopColor="#2d3246"
                    />

                    <stop
                      offset="100%"
                      stopColor="#1e1b2e"
                    />
                  </radialGradient>

                  <filter id="wheel-glow">
                    <feGaussianBlur
                      stdDeviation="3"
                      result="blur"
                    />

                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  <filter id="soft-glow">
                    <feGaussianBlur
                      stdDeviation="4"
                      result="blur"
                    />

                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <circle
                  cx={CX}
                  cy={CY}
                  r={WHEEL_R - 4}
                  fill="url(#wheel-base)"
                />

                {Array.from({
                  length: SECTOR_COUNT,
                }).map(
                  (_, index) => {
                    const shape =
                      SHAPES[index]!;

                    const isActive =
                      winningShape ===
                      shape;

                    const hue =
                      (index *
                        (360 /
                          SECTOR_COUNT) +
                        15) %
                      360;

                    const sat =
                      35 +
                      (index %
                        3) *
                        10;

                    const light =
                      38 +
                      (index %
                        2) *
                        6;

                    const baseColor =
                      `hsl(${hue}, ${sat}%, ${light}%)`;

                    const midColor =
                      `hsl(${hue}, ${sat + 8}%, ${light + 12}%)`;

                    const edgeColor =
                      `hsl(${hue}, ${sat - 5}%, ${light - 8}%)`;

                    const gradId =
                      `sector-grad-${index}`;

                    return (
                      <g
                        key={`sector-${index}`}
                      >
                        <defs>
                          <linearGradient
                            id={gradId}
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%"
                          >
                            <stop
                              offset="0%"
                              stopColor={
                                isActive
                                  ? "#E8D5CE"
                                  : midColor
                              }
                              stopOpacity={
                                isActive
                                  ? 0.35
                                  : 0.9
                              }
                            />

                            <stop
                              offset="50%"
                              stopColor={
                                isActive
                                  ? "#D4B8B1"
                                  : baseColor
                              }
                              stopOpacity={
                                isActive
                                  ? 0.25
                                  : 0.85
                              }
                            />

                            <stop
                              offset="100%"
                              stopColor={
                                isActive
                                  ? "#B99FA9"
                                  : edgeColor
                              }
                              stopOpacity={
                                isActive
                                  ? 0.2
                                  : 0.8
                              }
                            />
                          </linearGradient>
                        </defs>

                        <path
                          d={sectorPath(
                            index,
                          )}
                          fill={`url(#${gradId})`}
                          stroke={
                            isActive
                              ? "#E8D5CE"
                              : "rgba(232,213,206,0.25)"
                          }
                          strokeWidth={
                            isActive
                              ? 2.6
                              : 1
                          }
                          opacity={
                            isActive
                              ? 1
                              : 0.88
                          }
                          filter={
                            isActive
                              ? "url(#soft-glow)"
                              : undefined
                          }
                        />
                      </g>
                    );
                  },
                )}

                {Array.from({
                  length: SECTOR_COUNT,
                }).map(
                  (_, index) => {
                    const angle =
                      index *
                        SLICE_DEG +
                      SLICE_DEG /
                        2;

                    const pos =
                      polarToCartesian(
                        angle,
                        WHEEL_R *
                          0.72,
                      );

                    const shape =
                      SHAPES[index]!;

                    const icon =
                      NAIL_SHAPE_ICONS[
                        shape
                      ];

                    const iconSize =
                      NAIL_ICON_SIZE;

                    const isActive =
                      winningShape ===
                      shape;

                    return (
                      <g
                        key={`icon-${index}`}
                        transform={`translate(${pos.x - iconSize / 2}, ${pos.y - iconSize / 2})`}
                      >
                        <svg
                          width={
                            iconSize
                          }
                          height={
                            iconSize
                          }
                          viewBox={
                            icon.viewBox
                          }
                          fill="none"
                        >
                          <defs>
                            <linearGradient
                              id={`icon-grad-${shape}`}
                              x1="0%"
                              y1="0%"
                              x2="100%"
                              y2="100%"
                            >
                              <stop
                                offset="0%"
                                stopColor={
                                  isActive
                                    ? "#FFFFFF"
                                    : "#E8D5CE"
                                }
                                stopOpacity={
                                  isActive
                                    ? 1
                                    : 0.92
                                }
                              />

                              <stop
                                offset="50%"
                                stopColor={
                                  isActive
                                    ? "#E8D5CE"
                                    : "#D4B8B1"
                                }
                                stopOpacity={
                                  isActive
                                    ? 0.95
                                    : 0.82
                                }
                              />

                              <stop
                                offset="100%"
                                stopColor={
                                  isActive
                                    ? "#D4B8B1"
                                    : "#B99FA9"
                                }
                                stopOpacity={
                                  isActive
                                    ? 0.9
                                    : 0.72
                                }
                              />
                            </linearGradient>

                            {isActive && (
                              <filter
                                id={`icon-glow-${shape}`}
                              >
                                <feGaussianBlur
                                  stdDeviation="2.5"
                                  result="blur"
                                />

                                <feMerge>
                                  <feMergeNode in="blur" />
                                  <feMergeNode in="SourceGraphic" />
                                </feMerge>
                              </filter>
                            )}
                          </defs>

                          <path
                            d={icon.path}
                            fill={`url(#icon-grad-${shape})`}
                            stroke={
                              isActive
                                ? "#FFFFFF"
                                : "#E8D5CE"
                            }
                            strokeWidth={
                              isActive
                                ? 2.6
                                : 1.6
                            }
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            filter={
                              isActive
                                ? `url(#icon-glow-${shape})`
                                : undefined
                            }
                          />
                        </svg>
                      </g>
                    );
                  },
                )}

                <circle
                  cx={CX}
                  cy={CY}
                  r={WHEEL_R - 2}
                  fill="none"
                  stroke="rgba(232,213,206,0.15)"
                  strokeWidth="1.5"
                />

                <circle
                  cx={CX}
                  cy={CY}
                  r={28}
                  fill="url(#wheel-base)"
                  stroke="rgba(232,213,206,0.25)"
                  strokeWidth="1.2"
                />

                {Array.from({
                  length: 24,
                }).map((_, i) => {
                  const angle =
                    (i * 15 *
                      Math.PI) /
                    180;

                  const x =
                    CX +
                    (WHEEL_R - 18) *
                      Math.cos(angle);

                  const y =
                    CY +
                    (WHEEL_R - 18) *
                      Math.sin(angle);

                  const opacity =
                    0.25 +
                    (i % 3) *
                      0.15;

                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="1.2"
                      fill="#E8D5CE"
                      opacity={
                        opacity
                      }
                    />
                  );
                })}
              </motion.svg>

              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                variants={
                  overlayVariants
                }
                animate={
                  overlayControls
                }
              >
                <div className="flex flex-col items-center gap-2">
                  <motion.span
                    className="text-6xl font-bold text-blush-300"
                    variants={
                      sparkleVariants
                    }
                    animate={
                      sparkleControls
                    }
                    style={{
                      filter:
                        "drop-shadow(0 0 12px rgba(212,184,177,0.7))",
                    }}
                  >
                    ?
                  </motion.span>

                  <motion.span
                    className="text-3xl text-blush-300/90"
                    variants={
                      sparkleVariants
                    }
                    animate={
                      sparkleControls
                    }
                    transition={{
                      delay: 0.15,
                    }}
                    style={{
                      filter:
                        "drop-shadow(0 0 8px rgba(212,184,177,0.6))",
                    }}
                  >
                    ✦
                  </motion.span>
                </div>
              </motion.div>
            </div>

            <motion.div
              className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2"
              variants={
                needleVariants
              }
              animate={
                needleControls
              }
            >
              <svg
                width="36"
                height="36"
                viewBox="0 0 100 100"
                className="drop-shadow-[0_0_16px_rgba(232,213,206,0.9)]"
              >
                <defs>
                  <radialGradient
                    id="sparkle-grad"
                    cx="50%"
                    cy="50%"
                    r="50%"
                  >
                    <stop
                      offset="0%"
                      stopColor="#fff"
                      stopOpacity="0.95"
                    />

                    <stop
                      offset="35%"
                      stopColor="#E8D5CE"
                      stopOpacity="0.85"
                    />

                    <stop
                      offset="100%"
                      stopColor="#D4B8B1"
                      stopOpacity="0"
                    />
                  </radialGradient>
                </defs>

                <path
                  d="M 50 0 L 61 39 L 100 50 L 61 61 L 50 100 L 39 61 L 0 50 L 39 39 Z"
                  fill="url(#sparkle-grad)"
                />
              </svg>
            </motion.div>
          </div>
        </div>

        {/* Visualization + prompt - right column */}

        <div className="flex w-full flex-1 flex-col items-center gap-4 lg:w-1/2">
          {(phase === "generating" ||
            phase === "shapeLock" ||
            phase === "artFill" ||
            phase === "revealed") &&
          shapePath ? (
            <motion.div
              className="flex flex-col items-center gap-4"
              variants={
                shapeRevealVariants
              }
              animate={
                shapeControls
              }
              >
                <div className="relative">
                  {phase === "generating" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="relative h-16 w-16">
                        <div className="absolute inset-0 rounded-full bg-blush-300/10 nf-pulse" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="nf-spin h-8 w-8 rounded-full border-4 border-blush-300/90 border-t-transparent" />
                        </div>
                      </div>
                    </div>
                  )}

                  {(phase === "generating" ||
                    phase === "shapeLock" ||
                    phase === "artFill" ||
                    phase === "revealed") &&
                  shapePath ? (
                    <>
                    {/* ---------------------------------------------------------------- */}
                    {/* Nail SVG                                                          */}
                    {/* ---------------------------------------------------------------- */}

                    <svg
                      width="180"
                      height="240"
                      viewBox="0 0 100 120"
                      className="h-auto w-full max-w-[200px] drop-shadow-[0_0_20px_rgba(212,184,177,0.4)]"
                    >
                      <defs>
                        {/* Base nail gradient */}
                        <linearGradient
                          id="nail-base-gradient"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="100%"
                        >
                          <stop
                            offset="0%"
                            stopColor="#FFF7F2"
                          />

                          <stop
                            offset="45%"
                            stopColor="#E8D5CE"
                          />

                          <stop
                            offset="100%"
                            stopColor="#C9A9A2"
                          />
                        </linearGradient>

                        {/* Chrome/highlight overlay */}
                        <linearGradient
                          id="chrome-shine"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="0%"
                        >
                          <stop
                            offset="0%"
                            stopColor="#FFFFFF"
                            stopOpacity="0"
                          />

                          <stop
                            offset="45%"
                            stopColor="#FFFFFF"
                            stopOpacity="0.7"
                          />

                          <stop
                            offset="55%"
                            stopColor="#FFFFFF"
                            stopOpacity="0.2"
                          />

                          <stop
                            offset="100%"
                            stopColor="#FFFFFF"
                            stopOpacity="0"
                          />
                        </linearGradient>

                        {/* Fixed nail clip path.
                            This guarantees that anything rendered inside
                            the nail area stays inside the nail silhouette. */}
                        <clipPath id="nail-clip">
                          <path
                            d={
                              shapePath!
                            }
                          />
                        </clipPath>
                      </defs>

                      {/* Nail outline */}
                      {(phase ===
                        "generating" ||
                        phase ===
                          "shapeLock" ||
                        phase ===
                          "artFill" ||
                        phase ===
                          "revealed") && (
                        <path
                          d={
                            shapePath!
                          }
                          fill="none"
                          stroke="#E8D5CE"
                          strokeWidth="2"
                        />
                      )}

                      {/* Base nail while generating */}
                      {(phase ===
                        "generating" ||
                        phase ===
                          "shapeLock") && (
                        <path
                          d={
                            shapePath!
                          }
                          fill="url(#nail-base-gradient)"
                          opacity="0.85"
                        />
                      )}

                      {/* Clipped nail content */}
                      <g clipPath="url(#nail-clip)">
                        {/* AI / procedural nail art */}
                        {designSpec &&
                          shapePath &&
                          (phase ===
                            "artFill" ||
                            phase ===
                              "revealed") &&
                          (() => {
                            const clipId =
                              `nail-clip-${designSpec.name
                                .replace(
                                  /[^a-z0-9]/gi,
                                  "",
                                )
                                .slice(
                                  0,
                                  12,
                                )}`;

                            return renderNailArt(
                              designSpec,
                              shapePath,
                              clipId,
                              nailImageUrl,
                            );
                          })()}

                        {/* Final glossy highlight */}
                        {(phase ===
                          "artFill" ||
                          phase ===
                            "revealed") && (
                          <>
                            <motion.path
                              d={
                                shapePath!
                              }
                              fill="url(#chrome-shine)"
                              initial={{
                                opacity: 0,
                              }}
                              animate={{
                                opacity: [
                                  0.12,
                                  0.58,
                                  0.2,
                                ],
                              }}
                              transition={{
                                duration: 3.8,
                                delay: 0.1,
                                repeat:
                                  Infinity,
                                ease: "easeInOut",
                              }}
                            />

                            <motion.path
                              d={
                                shapePath!
                              }
                              fill="none"
                              stroke="rgba(255,255,255,0.4)"
                              strokeWidth="1"
                              initial={{
                                pathLength: 0,
                              }}
                              animate={{
                                pathLength: 1,
                              }}
                              transition={{
                                duration: 0.5,
                                delay: 0.2,
                              }}
                            />
                          </>
                        )}
                      </g>
                    </svg>
                  </>
                ) : null}

                {/* Tags */}

                {designSpec &&
                  winningTags.length >
                   0 &&
                  (phase ===
                    "artFill" ||
                    phase ===
                      "revealed") &&
                  false && (
                    <div className="absolute -right-2 -top-2 flex flex-wrap gap-1">
                      {designColors.map((color, idx) => (
                        <span
                          key={`${color}-${idx}`}
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  )}
              </div>

              {/* Design information */}

              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-blush-300">
                  Today&apos;s
                  Design
                </p>

                  <h2 className="mt-2 text-2xl font-semibold">
                    {designSpec
                      ? designSpec.name
                      : winningShape
                        ? SHAPE_LABELS[
                            winningShape
                          ]
                        : ""}
                  </h2>

                  {designSpec?.description &&
                    (() => {
                      const lines = formatDescription(
                        designSpec.description,
                        designSpec.name,
                      );

                      return (
                        <div className="mt-3 space-y-1 text-center">
                          {lines.map((line, idx) => (
                            <p
                              key={idx}
                              className="text-xs uppercase tracking-[0.25em] text-white/70"
                            >
                              {line}
                            </p>
                          ))}
                        </div>
                      );
                    })()}

                   {designSpec &&
                     designColors.length >
                      0 && (
                     <div className="mt-2 flex flex-wrap justify-center gap-2">
                       {designColors.map((color, idx) => (
                         <span
                           key={`${color}-${idx}`}
                           className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/90"
                         >
                           <span
                             className="h-2.5 w-2.5 rounded-full"
                             style={{
                               backgroundColor:
                                 color,
                             }}
                           />

                           <span className="text-white">
                             {idx + 1}.
                           </span>
                           {color.toUpperCase()}
                         </span>
                       ))}
                     </div>
                   )}

                {aiError && (
                  <p
                    role="status"
                    className="mt-2 text-sm text-amber-200"
                  >
                    {aiError}
                  </p>
                )}
              </div>

              {/* Buttons */}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={spin}
                  className="btn-pearl !px-5 !py-2.5 !text-sm"
                >
                  {t.notd
                    .surpriseMe ||
                    "Spin again"}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (!manicure) {
                      return;
                    }

                    const key = `savedNail::${manicure.id}`;
                    const isSaved = Boolean(localStorage.getItem(key));

                    try {
                      if (isSaved) {
                        localStorage.removeItem(key);
                        setSaved(false);
                        await removeFromApi({
                          name: manicure.name,
                          shape: manicure.shape,
                          palette: manicure.palette,
                          savedAt: new Date().toISOString(),
                        });
                      } else {
                        const savedDesign = designSpec ?? null;
                        const item = {
                          name: manicure.name,
                          shape: manicure.shape,
                          palette: manicure.palette,
                          savedAt: new Date().toISOString(),
                          ...(savedDesign ? { designSpec: savedDesign } : {}),
                          ...(nailImageUrl ? { nailImageUrl } : {}),
                        };
                        localStorage.setItem(key, JSON.stringify(item));
                        setSaved(true);
                        await saveToApi(item);
                      }
                    } catch (error) {
                      console.error("Save failed:", error);
                    }
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill={saved ? "#E8D5CE" : "none"}
                    stroke="#E8D5CE"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const artistId = selectedLook?.artist_id ?? publicEnv.defaultArtistId;

                  if (artistId) {
                    router.push(`/confirm/${artistId}`);
                  }
                }}
                className="btn-pearl !px-5 !py-2.5 !text-sm"
              >
                Try Me
              </button>
            </motion.div>
          ) : phase === "idle" ? (
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={spin}
                className="btn-pearl !px-5 !py-2.5 !text-sm"
              >
                Spin for Today&apos;s Magic Design
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-white/70">
                {shuffledLooks.length ===
                0
                  ? t.notd.body
                  : t.notd.empty}
              </p>

              <button
                type="button"
                onClick={
                  spin
                }
                disabled={
                  phase === "spinning" ||
                  phase === "generating" ||
                  phase === "shapeLock" ||
                  phase === "artFill"
                }
                className="btn-pearl !px-5 !py-2.5 !text-sm disabled:opacity-60"
              >
                {phase === "spinning" || phase === "generating" || phase === "shapeLock" || phase === "artFill"
                  ? "Spinning..."
                  : "Spin for Today's Magic Design"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Particles */}

      {phase ===
        "revealed" &&
        particles.length >
          0 && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {particles.map(
              (p) => (
                <motion.span
                  key={p.id}
                  className="absolute text-blush-300"
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    fontSize:
                      p.size,
                    filter:
                      "drop-shadow(0 0 6px rgba(212,184,177,0.8))",
                  }}
                  initial={{
                    opacity: 0,
                    scale: 0,
                    y: 0,
                  }}
                  animate={{
                    opacity: [
                      0,
                      1,
                      0,
                    ],
                    scale: [
                      0,
                      1.2,
                      0.8,
                    ],
                    y: [
                      0,
                      -20,
                      -40,
                    ],
                  }}
                  transition={{
                    duration: 1.4,
                    delay: p.delay,
                    ease: "easeOut",
                  }}
                >
                  ✦
                </motion.span>
              ),
            )}
          </div>
        )}
    </section>
  );
}