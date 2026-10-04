"use client";

import { useEffect, useId, useRef } from "react";

export type FluidLoaderSize = "sm" | "md" | "lg";

export interface FluidLoaderProps {
  fullScreen?: boolean;
  size?: FluidLoaderSize;
  className?: string;
}

export const FLUID_LOADER_COLORS = {
  highlight: "#E8D5CE",
  pearl: "#F9F6F0",
  base: "#D4B8B1",
  shadow: "#4A3B47",
  deep: "#1E1B2E",
} as const;

const SIZE_PX: Record<FluidLoaderSize, number> = {
  sm: 120,
  md: 180,
  lg: 260,
};

const VIEW = 100;
const CX = VIEW / 2;
const CY = VIEW / 2;

const STAR_POLYGON = "0,-50 11,-11 50,0 11,11 0,50 -11,11 -50,0 -11,-11";

export default function FluidLoader({
  fullScreen = false,
  size = "md",
  className,
}: FluidLoaderProps) {
  const uid = useId().replace(/:/g, "");
  const ring1Id = `loader-ring1-${uid}`;
  const ring2Id = `loader-ring2-${uid}`;
  const gradId = `loader-grad-${uid}`;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const ring1Ref = useRef<SVGCircleElement | null>(null);
  const ring2Ref = useRef<SVGCircleElement | null>(null);
  const starRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ring1 = ring1Ref.current;
    const ring2 = ring2Ref.current;
    const star = starRef.current;
    if (!ring1 || !ring2 || !star) return;

    if (reduced) {
      ring1.setAttribute("stroke-dashoffset", "0");
      ring2.setAttribute("stroke-dashoffset", "0");
      star.setAttribute("transform", "scale(0.18)");
      star.setAttribute("opacity", "0.9");
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const r1 = 28;
      const r2 = 20;
      const circumference1 = 2 * Math.PI * r1;
      const circumference2 = 2 * Math.PI * r2;
      ring1.setAttribute(
        "stroke-dashoffset",
        String(((t * 28) % circumference1)),
      );
      ring2.setAttribute(
        "stroke-dashoffset",
        String(-((t * 42) % circumference2)),
      );
      const pulse = 0.18 + Math.sin(t * 2.6) * 0.03;
      const opacity = 0.7 + Math.sin(t * 2.6) * 0.2;
      star.setAttribute("transform", `scale(${pulse})`);
      star.setAttribute("opacity", String(opacity));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const px = SIZE_PX[size];

  const loader = (
    <svg
      ref={svgRef}
      width={px}
      height={px}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      role="img"
      aria-label="Loading"
      focusable="false"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <radialGradient id={`${gradId}-1`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={FLUID_LOADER_COLORS.pearl} stopOpacity="0.9" />
          <stop offset="100%" stopColor={FLUID_LOADER_COLORS.highlight} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${gradId}-2`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={FLUID_LOADER_COLORS.pearl} stopOpacity="0.95" />
          <stop offset="60%" stopColor={FLUID_LOADER_COLORS.highlight} stopOpacity="0.8" />
          <stop offset="100%" stopColor={FLUID_LOADER_COLORS.base} stopOpacity="0.3" />
        </radialGradient>
      </defs>

      <circle
        ref={ring1Ref}
        cx={CX}
        cy={CY}
        r={28}
        fill="none"
        stroke={`url(#${gradId}-1)`}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray={`${2 * Math.PI * 28 * 0.28} ${2 * Math.PI * 28 * 0.72}`}
        opacity="0.75"
      />

      <circle
        ref={ring2Ref}
        cx={CX}
        cy={CY}
        r={20}
        fill="none"
        stroke={FLUID_LOADER_COLORS.highlight}
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray={`${2 * Math.PI * 20 * 0.35} ${2 * Math.PI * 20 * 0.65}`}
        opacity="0.55"
      />

      <g transform={`translate(${CX}, ${CY})`}>
        <g ref={starRef} transform="scale(0.18)">
          <polygon
            points={STAR_POLYGON}
            fill={`url(#${gradId}-2)`}
            opacity="0.85"
          />
        </g>
      </g>
    </svg>
  );

  if (fullScreen) {
    return (
      <div
        className={className}
        role="status"
        aria-live="polite"
        aria-label="Loading"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(30, 27, 46, 0.4)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        {loader}
      </div>
    );
  }

  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      aria-label="Loading"
      style={{ display: "inline-flex", width: px, height: px }}
    >
      {loader}
    </div>
  );
}
