"use client";

interface DesignSpec {
  name: string;
  pattern: string;
  complexity: "simple" | "medium" | "complex";
  colors: string[];
  layers: Layer[];
  motifs: Motif[];
  texture: string;
}

interface Motif {
  kind: string;
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
  shapes?: string[];
  filter?: string;
  width?: number;
  dashArray?: string;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function renderNailArt(design: DesignSpec, shapePath: string, clipId: string, nailImageUrl: string | null) {
  if (nailImageUrl) {
    return (
      <>
        <defs>
          <pattern id={`texture-${clipId}`} patternUnits="userSpaceOnUse" width="100" height="120">
            <image href={nailImageUrl} x="0" y="0" width="100" height="120" preserveAspectRatio="xMidYMid slice" />
          </pattern>
          <clipPath id={clipId}><path d={shapePath} /></clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <path d={shapePath} fill={`url(#texture-${clipId})`} />
        </g>
      </>
    );
  }

  const c = design.colors;
  const base = c[0] ?? "#E8D5CE";
  const accent = c[1] ?? "#D4B8B1";
  const secondary = c[2] ?? "#B99FA9";
  const tertiary = c[3] ?? "#F5E6E0";
  const quaternary = c[4] ?? "#A67C7C";

  const filters = (
    <>
      <linearGradient id={`nail-base-${clipId}`} x1="12%" y1="0%" x2="88%" y2="100%">
        <stop offset="0%" stopColor={tertiary} />
        <stop offset="48%" stopColor={base} />
        <stop offset="100%" stopColor={secondary} />
      </linearGradient>
      <linearGradient id={`chrome-shine-${clipId}`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.02" />
        <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0.62" />
        <stop offset="54%" stopColor={tertiary} stopOpacity="0.18" />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.03" />
      </linearGradient>
      <linearGradient id={`chrome-band-${clipId}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={tertiary} />
        <stop offset="35%" stopColor={accent} />
        <stop offset="52%" stopColor="#FFFFFF" />
        <stop offset="68%" stopColor={secondary} />
        <stop offset="100%" stopColor={tertiary} />
      </linearGradient>
      <radialGradient id={`aura-${clipId}`} cx="48%" cy="43%" r="58%">
        <stop offset="0%" stopColor={accent} stopOpacity="0.92" />
        <stop offset="48%" stopColor={secondary} stopOpacity="0.52" />
        <stop offset="100%" stopColor={base} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`gloss-gradient-${clipId}`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
        <stop offset="32%" stopColor={base} stopOpacity="0.6" />
        <stop offset="100%" stopColor={base} stopOpacity="0.05" />
      </linearGradient>
      <linearGradient id={`matte-gradient-${clipId}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={secondary} stopOpacity="0.95" />
        <stop offset="50%" stopColor={base} stopOpacity="0.7" />
        <stop offset="100%" stopColor={secondary} stopOpacity="0.8" />
      </linearGradient>
    </>
  );

  const patterns = (
    <>
      {nailImageUrl && (
        <pattern id={`texture-${clipId}`} patternUnits="userSpaceOnUse" width="100" height="120">
          <image href={nailImageUrl} x="0" y="0" width="100" height="120" preserveAspectRatio="xMidYMid slice" />
        </pattern>
      )}
      <pattern id={`dots-${clipId}`} x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
        <circle cx="5" cy="5" r="2" fill={accent} opacity="0.9" />
      </pattern>
      <pattern id={`checker-${clipId}`} x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="6" height="6" fill={accent} opacity="0.85" />
        <rect x="6" y="6" width="6" height="6" fill={accent} opacity="0.85" />
      </pattern>
      <pattern id={`geometric-${clipId}`} x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
        <polygon points="8,0 16,8 8,16 0,8" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.8" />
        <circle cx="8" cy="8" r="2" fill={secondary} opacity="0.7" />
      </pattern>
      <pattern id={`lace-${clipId}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="3" fill="none" stroke={accent} strokeWidth="0.8" opacity="0.6" />
        <circle cx="0" cy="0" r="2" fill="none" stroke={secondary} strokeWidth="0.6" opacity="0.5" />
        <circle cx="20" cy="0" r="2" fill="none" stroke={secondary} strokeWidth="0.6" opacity="0.5" />
        <circle cx="0" cy="20" r="2" fill="none" stroke={secondary} strokeWidth="0.6" opacity="0.5" />
        <circle cx="20" cy="20" r="2" fill="none" stroke={secondary} strokeWidth="0.6" opacity="0.5" />
      </pattern>
      <pattern id={`glitter-pat-${clipId}`} x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="10" height="10" fill="transparent" />
        <circle cx="2" cy="2" r="1.1" fill={accent} opacity="0.9" />
        <circle cx="7" cy="7" r="1.1" fill={tertiary} opacity="0.85" />
        <circle cx="5" cy="0" r="0.6" fill={secondary} opacity="0.95" />
        <circle cx="0" cy="5" r="0.6" fill={accent} opacity="0.8" />
        <circle cx="10" cy="5" r="0.6" fill={tertiary} opacity="0.75" />
        <circle cx="5" cy="10" r="0.6" fill={secondary} opacity="0.9" />
      </pattern>
      <pattern id={`fishnet-${clipId}`} x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="10" height="10" fill="transparent" />
        <path d="M 0 0 L 10 10 M 10 0 L 0 10" stroke={accent} strokeWidth="0.8" opacity="0.85" />
        <circle cx="5" cy="5" r="1.2" fill={secondary} opacity="0.9" />
      </pattern>
      <pattern id={`sparkle-${clipId}`} x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="12" height="12" fill="transparent" />
        <path d="M 6 0 L 7 5 L 12 6 L 7 7 L 6 12 L 5 7 L 0 6 L 5 5 Z" fill={accent} opacity="0.95" />
        <circle cx="3" cy="3" r="0.7" fill={tertiary} opacity="0.9" />
        <circle cx="9" cy="9" r="0.7" fill={secondary} opacity="0.9" />
      </pattern>
      <pattern id={`metallic-stripe-${clipId}`} x="0" y="0" width="100" height="14" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="100" height="14" fill="transparent" />
        <path d="M 0 7 Q 25 0 50 7 T 100 7" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" opacity="0.9" />
        <path d="M 0 7 Q 25 14 50 7 T 100 7" fill="none" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
      </pattern>
      <pattern id={`gloss-band-${clipId}`} x="0" y="0" width="100" height="18" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="100" height="18" fill="transparent" />
        <path d="M 0 9 Q 25 0 50 9 T 100 9" fill="none" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" opacity="0.45" />
        <path d="M 0 9 Q 25 18 50 9 T 100 9" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
      </pattern>
    </>
  );

  const heartShape = (x: number, y: number, size: number, color: string, opacity = 0.85) => (
    <path
      d={`M ${x} ${y + size * 0.3} C ${x - size * 0.5} ${y - size * 0.3}, ${x - size} ${y + size * 0.1}, ${x} ${y + size * 0.6} C ${x + size} ${y + size * 0.1}, ${x + size * 0.5} ${y - size * 0.3}, ${x} ${y + size * 0.3} Z`}
      fill={color}
      opacity={opacity}
    />
  );

  const starShape = (x: number, y: number, r: number, color: string, opacity = 0.9) => {
    const points = Array.from({ length: 8 }, (_, i) => {
      const angle = (i * 45 - 90) * Math.PI / 180;
      const radius = i % 2 === 0 ? r : r * 0.4;
      return `${x + radius * Math.cos(angle)} ${y + radius * Math.sin(angle)}`;
    }).join(" ");
    return <polygon points={points} fill={color} opacity={opacity} />;
  };

  const flowerShape = (x: number, y: number, r: number, color: string, opacity = 0.85) => (
    <g opacity={opacity}>
      {Array.from({ length: 5 }, (_, i) => {
        const angle = (i * 72 - 90) * Math.PI / 180;
        const cx = x + r * 0.5 * Math.cos(angle);
        const cy = y + r * 0.5 * Math.sin(angle);
        return <ellipse key={i} cx={cx} cy={cy} rx={r * 0.4} ry={r * 0.25} fill={color} transform={`rotate(${i * 72} ${cx} ${cy})`} />;
      })}
      <circle cx={x} cy={y} r={r * 0.25} fill={tertiary} />
    </g>
  );

  const leafShape = (x: number, y: number, r: number, color: string, opacity = 0.7) => (
    <ellipse cx={x} cy={y} rx={r * 0.3} ry={r * 0.8} fill={color} opacity={opacity} transform={`rotate(${(hashString(`${x}:${y}`) % 41) - 20} ${x} ${y})`} />
  );

  const catEyeShape = (color1: string, color2: string, opacity = 0.7) => (
    <g opacity={opacity}>
      <ellipse cx="50" cy="55" rx="20" ry="28" fill={color1} />
      <ellipse cx="50" cy="55" rx="9" ry="16" fill={color2} />
      <ellipse cx="50" cy="55" rx="3" ry="8" fill="#000000" opacity="0.6" />
    </g>
  );

  const renderShapes = (shapes?: string[]) => {
    if (!shapes) return null;
    const elements: React.ReactNode[] = [];
    const seed = hashString(design.name + design.pattern);

    shapes.forEach((shapeType, i) => {
      const count = design.complexity === "complex" ? 6 : design.complexity === "medium" ? 4 : 2;
      for (let j = 0; j < count; j++) {
        const x = 30 + ((seed * (i + 1) * (j + 1) * 7) % 40);
        const y = 25 + ((seed * (i + 1) * (j + 1) * 13) % 70);
        const size = 2.5 + ((seed * (i + 1) * (j + 1)) % 4);
        const color = design.colors?.[j % (design.colors.length || 1)] ?? accent;

        if (shapeType === "heart") {
          elements.push(heartShape(x, y, size, color, 0.75 + (j % 3) * 0.1) as React.ReactNode);
        } else if (shapeType === "star") {
          elements.push(starShape(x, y, size, color, 0.75 + (j % 3) * 0.1) as React.ReactNode);
        } else if (shapeType === "flower") {
          elements.push(flowerShape(x, y, size, color, 0.7 + (j % 3) * 0.1) as React.ReactNode);
        } else if (shapeType === "leaf") {
          elements.push(leafShape(x, y, size * 1.2, color, 0.6 + (j % 3) * 0.1) as React.ReactNode);
        } else if (shapeType === "circle") {
          elements.push(<circle key={`circle-${j}`} cx={x} cy={y} r={size * 0.8} fill={color} opacity={0.7 + (j % 3) * 0.1} />);
        } else if (shapeType === "dot") {
          elements.push(<circle key={`dot-${j}`} cx={x} cy={y} r={size * 0.45} fill={color} opacity={0.8 + (j % 2) * 0.15} />);
        } else if (shapeType === "arc") {
          elements.push(
            <path
              key={`arc-${j}`}
              d={`M ${x - size * 1.2} ${y} Q ${x} ${y - size * 1.4} ${x + size * 1.2} ${y}`}
              fill="none"
              stroke={color}
              strokeWidth="1.6"
              opacity={0.6 + (j % 3) * 0.15}
              strokeLinecap="round"
            />,
          );
        } else if (shapeType === "petal") {
          elements.push(
            <ellipse key={`petal-${j}`} cx={x} cy={y - size * 0.4} rx={size * 0.35} ry={size * 0.9} fill={color} opacity={0.65 + (j % 3) * 0.1} transform={`rotate(${(seed % 40) - 20} ${x} ${y})`} />,
          );
        } else if (shapeType === "ring") {
          elements.push(<circle key={`ring-${j}`} cx={x} cy={y} r={size * 0.9} fill="none" stroke={color} strokeWidth="1.3" opacity={0.7 + (j % 2) * 0.2} />);
        } else if (shapeType === "bubble") {
          elements.push(
            <g key={`bubble-${j}`} opacity={0.7 + (j % 3) * 0.1}>
              <circle cx={x} cy={y} r={size * 0.75} fill={color} opacity="0.35" />
              <circle cx={x - size * 0.25} cy={y - size * 0.25} r={size * 0.25} fill="#FFFFFF" opacity="0.6" />
            </g>,
          );
        } else if (shapeType === "crescent") {
          elements.push(
            <path
              key={`crescent-${j}`}
              d={`M ${x - size * 0.8} ${y} Q ${x} ${y - size * 1.1} ${x + size * 0.8} ${y} Q ${x} ${y + size * 0.9} ${x - size * 0.8} ${y} Z`}
              fill={color}
              opacity={0.6 + (j % 3) * 0.1}
            />,
          );
        } else if (shapeType === "splatter") {
          elements.push(<circle key={`splatter-${j}`} cx={x} cy={y} r={size * 0.7} fill={color} opacity={0.4 + (j % 3) * 0.15} />);
        } else if (shapeType === "line") {
          elements.push(
            <path
              key={`line-${j}`}
              d={`M ${x} ${y} Q ${x + size * 2} ${y - size} ${x + size * 4} ${y + size}`}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              opacity={0.5 + (j % 3) * 0.15}
              strokeLinecap="round"
            />,
          );
        }
      }
    });
    return elements;
  };

  const renderPatternFill = (layer: Layer) => {
    const patternId = layer.pattern === "glitter" ? `glitter-pat-${clipId}` : `${layer.pattern}-${clipId}`;
    if (!layer.pattern) return null;
    if (["dots", "checker", "geometric", "lace", "glitter", "metallic_stripe", "gloss_band", "fishnet", "sparkle"].includes(layer.pattern)) {
      return <path d={shapePath} fill={`url(#${patternId})`} stroke="none" />;
    }
    return null;
  };

  const renderFilterLayer = (layer: Layer) => {
    const filterId = `${layer.filter}-${clipId}`;
    if (!layer.filter) return null;
    if (layer.filter === "marble") {
      return <path d={shapePath} fill={layer.colors?.[0] ?? secondary} opacity={layer.opacity ?? 0.4} filter={`url(#${filterId})`} stroke="none" />;
    }
    if (layer.filter === "watercolor") {
      return <path d={shapePath} fill={layer.colors?.[0] ?? accent} opacity={layer.opacity ?? 0.5} filter={`url(#${filterId})`} stroke="none" />;
    }
    if (layer.filter === "galaxy") {
      return <path d={shapePath} fill={layer.colors?.[0] ?? "#0a0a2e"} opacity={layer.opacity ?? 0.8} filter={`url(#${filterId})`} stroke="none" />;
    }
    if (layer.filter === "glitter") {
      return <path d={shapePath} fill={layer.colors?.[0] ?? accent} opacity={layer.opacity ?? 0.7} filter={`url(#${filterId})`} stroke="none" />;
    }
    if (layer.filter === "chrome") {
      return <path d={shapePath} fill={layer.colors?.[0] ?? "#C0C0C0"} opacity={layer.opacity ?? 0.4} filter={`url(#${filterId})`} stroke="none" />;
    }
    if (layer.filter === "paint") {
      return <path d={shapePath} fill={layer.colors?.[0] ?? accent} opacity={layer.opacity ?? 0.45} filter={`url(#${filterId})`} stroke="none" />;
    }
    if (layer.filter === "brush") {
      return <path d={shapePath} fill={layer.colors?.[0] ?? secondary} opacity={layer.opacity ?? 0.35} filter={`url(#${filterId})`} stroke="none" />;
    }
    return null;
  };

  const renderStrokeLayer = (layer: Layer) => {
    if (!layer.pattern) return null;
    if (layer.pattern === "french_tip") {
      return (
        <path
          d={shapePath}
          fill="none"
          stroke={layer.colors?.[0] ?? "#FFFFFF"}
          strokeWidth={layer.width ?? 6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={layer.opacity ?? 0.95}
        />
      );
    }
    if (layer.pattern === "reverse_french") {
      return (
        <path
          d={shapePath}
          fill="none"
          stroke={layer.colors?.[0] ?? "#FFFFFF"}
          strokeWidth={layer.width ?? 10}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={layer.opacity ?? 0.9}
        />
      );
    }
    if (layer.pattern === "half_moon") {
      return (
        <path
          d={shapePath}
          fill="none"
          stroke={layer.colors?.[0] ?? "#FFFFFF"}
          strokeWidth={layer.width ?? 12}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={layer.opacity ?? 0.85}
        />
      );
    }
    if (layer.pattern === "metallic_stripe") {
      return (
        <path
          d={shapePath}
          fill="none"
          stroke={layer.colors?.[0] ?? "#C0C0C0"}
          strokeWidth={layer.width ?? 6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={layer.opacity ?? 0.85}
          strokeDasharray={layer.dashArray ?? "2 3"}
        />
      );
    }
    return null;
  };

  const renderShapeLayer = (layer: Layer) => {
    if (!layer.shapes) return null;
    return <g opacity={layer.opacity ?? 0.8}>{renderShapes(layer.shapes)}</g>;
  };

  const renderFillLayer = (layer: Layer, index: number) => {
    if (layer.pattern === "chrome_band") {
      return (
        <g opacity={layer.opacity ?? 0.9}>
          <path d="M 20 82 C 39 60, 59 58, 79 36" fill="none" stroke={`url(#chrome-band-${clipId})`} strokeWidth="9" strokeLinecap="round" />
          <path d="M 23 80 C 41 61, 59 57, 77 38" fill="none" stroke="#FFFFFF" strokeWidth="1.1" strokeLinecap="round" opacity="0.9" />
        </g>
      );
    }
    if (layer.pattern === "aura_soft") {
      return <ellipse cx="50" cy="53" rx="34" ry="43" fill={`url(#aura-${clipId})`} opacity={layer.opacity ?? 0.8} />;
    }
    if (layer.pattern === "glitter") {
      return <path d={shapePath} fill={`url(#glitter-pat-${clipId})`} opacity={layer.opacity ?? 0.8} />;
    }
    if (layer.pattern === "gloss_highlight" || layer.pattern === "gloss_band") {
      const glossColors = layer.colors?.length ? layer.colors : [base, accent];
      const glossId = `gloss-dynamic-${clipId}-${index}`;
      return (
        <g opacity={layer.opacity ?? 0.9}>
          <defs>
            <linearGradient id={glossId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="28%" stopColor={glossColors[0]} stopOpacity="0.6" />
              <stop offset="100%" stopColor={glossColors[glossColors.length > 1 ? 1 : 0]} stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path d={shapePath} fill={`url(#${glossId})`} stroke="none" />
        </g>
      );
    }
    if (layer.pattern === "matte_overlay") {
      const matteColor = layer.colors?.[0] ?? secondary;
      const matteId = `matte-dynamic-${clipId}-${index}`;
      return (
        <g opacity={layer.opacity ?? 0.85}>
          <defs>
            <linearGradient id={matteId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={matteColor} stopOpacity="0.95" />
              <stop offset="50%" stopColor={base} stopOpacity="0.7" />
              <stop offset="100%" stopColor={secondary} stopOpacity="0.8" />
            </linearGradient>
          </defs>
          <path d={shapePath} fill={`url(#${matteId})`} stroke="none" />
        </g>
      );
    }

    const colors = layer.colors?.length ? layer.colors : [base];
    const gradientId = `layer-gradient-${clipId}-${index}`;
    return (
      <>
        {colors.length > 1 && (
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              {colors.map((color, colorIndex) => (
                <stop key={`${color}-${colorIndex}`} offset={`${(colorIndex / (colors.length - 1)) * 100}%`} stopColor={color} />
              ))}
            </linearGradient>
          </defs>
        )}
        <path
          d={shapePath}
          fill={colors.length > 1 ? `url(#${gradientId})` : index === 0 ? `url(#nail-base-${clipId})` : colors[0]}
          opacity={layer.opacity ?? 1}
          stroke="none"
        />
      </>
    );
  };

  const renderLayer = (layer: Layer, index: number) => {
    const key = `layer-${index}-${layer.type}`;
    switch (layer.type) {
      case "fill":
        return <g key={key}>{renderFillLayer(layer, index)}</g>;
      case "stroke":
        return <g key={key}>{renderStrokeLayer(layer)}</g>;
      case "pattern":
        return <g key={key}>{renderPatternFill(layer)}</g>;
      case "shape":
        return <g key={key}>{renderShapeLayer(layer)}</g>;
      case "filter":
        return <g key={key}>{renderFilterLayer(layer)}</g>;
      default:
        return null;
    }
  };

  const renderMotif = (motif: Motif, index: number) => {
    const { kind, size, color } = motif;
    const transform = `translate(${motif.x} ${motif.y}) rotate(${motif.rotation})`;
    let artwork: React.ReactNode;

    switch (kind) {
      case "flower":
        artwork = (
          <>
            {Array.from({ length: 6 }, (_, petal) => (
              <ellipse key={petal} cx="0" cy={-size * 0.53} rx={size * 0.28} ry={size * 0.55} fill={petal % 2 ? color : "#FFF4E8"} transform={`rotate(${petal * 60})`} />
            ))}
            <circle r={size * 0.24} fill="#D7A947" />
            <circle r={size * 0.1} fill="#FFF3C4" />
          </>
        );
        break;
      case "butterfly":
        artwork = (
          <g stroke={color} strokeWidth={size * 0.12} strokeLinejoin="round">
            <path d={`M 0 0 C ${-size * 0.25} ${-size * 1.05}, ${-size * 1.15} ${-size * 0.95}, ${-size * 0.9} ${-size * 0.12} C ${-size * 0.65} ${size * 0.15}, ${-size * 0.35} ${size * 0.08}, 0 0 Z`} fill={color} />
            <path d={`M 0 0 C ${size * 0.25} ${-size * 1.05}, ${size * 1.15} ${-size * 0.95}, ${size * 0.9} ${-size * 0.12} C ${size * 0.65} ${size * 0.15}, ${size * 0.35} ${size * 0.08}, 0 0 Z`} fill="#FFF1E8" />
            <path d={`M 0 ${-size * 0.55} L 0 ${size * 0.35} M 0 ${-size * 0.45} Q ${-size * 0.35} ${-size * 0.95} ${-size * 0.55} ${-size * 0.8} M 0 ${-size * 0.45} Q ${size * 0.35} ${-size * 0.95} ${size * 0.55} ${-size * 0.8}`} fill="none" stroke="#5B3445" strokeWidth={size * 0.1} strokeLinecap="round" />
          </g>
        );
        break;
      case "heart":
        artwork = <path d={`M 0 ${size * 0.75} C ${-size * 1.15} ${-size * 0.05}, ${-size * 0.8} ${-size * 0.85}, 0 ${-size * 0.35} C ${size * 0.8} ${-size * 0.85}, ${size * 1.15} ${-size * 0.05}, 0 ${size * 0.75} Z`} fill={color} stroke="#FFF5F0" strokeWidth={size * 0.08} />;
        break;
      case "star":
      case "sparkle":
        artwork = <path d={`M 0 ${-size} L ${size * 0.2} ${-size * 0.2} L ${size} 0 L ${size * 0.2} ${size * 0.2} L 0 ${size} L ${-size * 0.2} ${size * 0.2} L ${-size} 0 L ${-size * 0.2} ${-size * 0.2} Z`} fill={color} stroke="#FFF7E4" strokeWidth={size * 0.07} />;
        break;
      case "pearl":
        artwork = (
          <>
            <circle r={size} fill={color} opacity="0.3" />
            <circle r={size * 0.72} fill="#FFF8F0" stroke={color} strokeWidth={size * 0.16} />
            <ellipse cx={-size * 0.22} cy={-size * 0.28} rx={size * 0.2} ry={size * 0.12} fill="#FFFFFF" opacity="0.9" />
          </>
        );
        break;
      case "bow":
        artwork = (
          <g fill="none" stroke={color} strokeWidth={size * 0.22} strokeLinecap="round" strokeLinejoin="round">
            <path d={`M 0 0 C ${-size * 1.5} ${-size * 1.4}, ${-size * 1.7} ${size * 0.7}, 0 0 C ${size * 1.7} ${-size * 1.4}, ${size * 1.5} ${size * 0.7}, 0 0`} />
            <path d={`M 0 0 Q ${-size * 0.45} ${size * 0.85} ${-size * 0.9} ${size * 1.4} M 0 0 Q ${size * 0.45} ${size * 0.85} ${size * 0.9} ${size * 1.4}`} />
            <circle r={size * 0.22} fill="#FFF4E8" />
          </g>
        );
        break;
      case "flame":
        artwork = <path d={`M 0 ${size} C ${-size * 1.1} ${size * 0.15}, ${-size * 0.15} ${-size * 0.25}, ${-size * 0.05} ${-size} C ${size * 0.8} ${-size * 0.15}, ${size * 0.8} ${size * 0.35}, 0 ${size} Z`} fill={color} stroke="#FFF1D8" strokeWidth={size * 0.1} />;
        break;
      case "leaf":
        artwork = (
          <g>
            <path d={`M ${-size * 0.15} ${size} C ${-size * 1.25} ${size * 0.05}, ${-size * 0.25} ${-size * 1.2}, ${size} ${-size} C ${size * 0.95} ${size * 0.1}, ${size * 0.65} ${size * 0.85}, ${-size * 0.15} ${size} Z`} fill={color} />
            <path d={`M ${-size * 0.2} ${size * 0.75} Q ${size * 0.25} 0 ${size * 0.8} ${-size * 0.78}`} fill="none" stroke="#FFF8E8" strokeWidth={size * 0.1} />
          </g>
        );
        break;
      case "gem":
        artwork = (
          <g stroke="#FFF5E8" strokeWidth={size * 0.08} strokeLinejoin="round">
            <path d={`M ${-size} ${-size * 0.35} L ${-size * 0.45} ${-size} L ${size * 0.55} ${-size} L ${size} ${-size * 0.3} L 0 ${size} Z`} fill={color} />
            <path d={`M ${-size} ${-size * 0.35} L 0 ${-size * 0.3} L ${-size * 0.45} ${-size} M 0 ${-size * 0.3} L ${size * 0.55} ${-size} M 0 ${-size * 0.3} L 0 ${size}`} fill="none" opacity="0.8" />
          </g>
        );
        break;
      case "cherry":
        artwork = (
          <g>
            <path d={`M ${-size * 0.3} ${-size * 0.25} Q ${-size * 0.35} ${-size * 1.05} ${size * 0.2} ${-size * 1.15} M ${size * 0.25} ${-size * 0.25} Q ${size * 0.3} ${-size * 0.95} ${size * 0.2} ${-size * 1.15}`} fill="none" stroke="#586B4D" strokeWidth={size * 0.13} strokeLinecap="round" />
            <path d={`M ${size * 0.18} ${-size * 1.12} Q ${size * 0.7} ${-size * 1.38} ${size * 0.82} ${-size * 1.03} Q ${size * 0.5} ${-size * 0.88} ${size * 0.18} ${-size * 1.12} Z`} fill="#81916B" />
            <circle cx={-size * 0.33} cy={size * 0.2} r={size * 0.48} fill={color} stroke="#FFF2E8" strokeWidth={size * 0.08} />
            <circle cx={size * 0.35} cy={size * 0.23} r={size * 0.48} fill={color} stroke="#FFF2E8" strokeWidth={size * 0.08} />
            <ellipse cx={-size * 0.48} cy={size * 0.02} rx={size * 0.11} ry={size * 0.2} fill="#FFFFFF" opacity="0.72" transform={`rotate(24 ${-size * 0.48} ${size * 0.02})`} />
            <ellipse cx={size * 0.2} cy={size * 0.05} rx={size * 0.1} ry={size * 0.18} fill="#FFFFFF" opacity="0.72" transform={`rotate(24 ${size * 0.2} ${size * 0.05})`} />
          </g>
        );
        break;
      case "citrus":
        artwork = (
          <g>
            <circle r={size * 0.92} fill="#FFF8E8" stroke={color} strokeWidth={size * 0.15} />
            <circle r={size * 0.73} fill={color} opacity="0.84" />
            {Array.from({ length: 7 }, (_, segment) => (
              <path key={segment} d={`M 0 0 L 0 ${-size * 0.68}`} transform={`rotate(${segment * (360 / 7)})`} stroke="#FFF8E8" strokeWidth={size * 0.1} strokeLinecap="round" opacity="0.9" />
            ))}
            <circle r={size * 0.12} fill="#FFF8E8" />
          </g>
        );
        break;
      case "strawberry":
        artwork = (
          <g>
            <path d={`M 0 ${size * 0.95} C ${-size * 1.15} ${size * 0.18}, ${-size * 0.85} ${-size * 0.7}, 0 ${-size * 0.38} C ${size * 0.85} ${-size * 0.7}, ${size * 1.15} ${size * 0.18}, 0 ${size * 0.95} Z`} fill={color} stroke="#FFF1E8" strokeWidth={size * 0.08} />
            <path d={`M ${-size * 0.55} ${-size * 0.4} Q 0 ${-size * 0.75} ${size * 0.55} ${-size * 0.4} M ${-size * 0.38} ${-size * 0.42} L ${-size * 0.15} ${-size * 0.72} M ${size * 0.38} ${-size * 0.42} L ${size * 0.15} ${-size * 0.72}`} fill="none" stroke="#70845D" strokeWidth={size * 0.15} strokeLinecap="round" />
            {[-0.42, 0, 0.42].map((x, seed) => <ellipse key={seed} cx={size * x} cy={size * (seed === 1 ? 0.05 : 0.32)} rx={size * 0.045} ry={size * 0.08} fill="#FFE7A8" transform={`rotate(18 ${size * x} ${size * (seed === 1 ? 0.05 : 0.32)})`} />)}
          </g>
        );
        break;
      case "rainbow": {
        const stripeColors = ["#D99A9A", "#E4B995", "#DED19B", "#AFC2A2", "#A8BBD0", "#B8A8C8"];
        artwork = (
          <g fill="none" strokeLinecap="round">
            {stripeColors.map((stripe, arc) => (
              <path key={stripe} d={`M ${-size} ${size * 0.28} A ${size - arc * size * 0.13} ${size - arc * size * 0.13} 0 0 1 ${size} ${size * 0.28}`} stroke={stripe} strokeWidth={size * 0.13} />
            ))}
          </g>
        );
        break;
      }
      default:
        artwork = <circle r={size} fill={color} />;
    }

    return (
      <g key={index} transform={`${transform} scale(${motif.role === "focal" ? 1 : motif.role === "micro" ? 0.78 : 0.9})`} opacity={motif.role === "micro" ? 0.86 : 1}>
        {artwork}
      </g>
    );
  };

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <path d={shapePath} />
        </clipPath>
      </defs>
      {filters}
      {patterns}
      <g clipPath={`url(#${clipId})`}>
        {nailImageUrl && (
          <path d={shapePath} fill={`url(#texture-${clipId})`} />
        )}
        {design.layers.map((layer, i) => renderLayer(layer, i))}
        {design.motifs.map((motif, index) => renderMotif(motif, index))}
        {design.texture === "glitter" && (
          <path d={shapePath} fill={`url(#glitter-pat-${clipId})`} opacity="0.7" stroke="none" />
        )}
        {design.texture === "fishnet" && (
          <path d={shapePath} fill={`url(#fishnet-${clipId})`} opacity="0.75" stroke="none" />
        )}
        {design.texture === "sparkle" && (
          <path d={shapePath} fill={`url(#sparkle-${clipId})`} opacity="0.8" stroke="none" />
        )}
        {design.texture === "gloss" && (
          <path d={shapePath} fill={`url(#gloss-gradient-${clipId})`} opacity="0.7" stroke="none" />
        )}
        {design.texture === "matte" && (
          <path d={shapePath} fill={`url(#matte-gradient-${clipId})`} opacity="0.7" stroke="none" />
        )}
        <path d="M 31 96 C 38 100, 62 100, 69 96" fill="none" stroke="#4A3035" strokeWidth="1.15" opacity="0.24" />
        <path d="M 29 91 C 27 69, 28 43, 36 25 M 71 91 C 73 69, 72 43, 64 25" fill="none" stroke="#FFFFFF" strokeWidth="1.15" strokeLinecap="round" opacity="0.38" />
      </g>
    </>
  );
}
