import { memo } from "react";
import Svg, { Circle, Defs, G, LinearGradient, Line, Path, Rect, Stop } from "react-native-svg";

export const SIZE = 18;

interface IconProps {
  color?: string;
}

export const IconSearch = memo(function IconSearch({ color = "currentColor" }: IconProps) {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 7h3l2-2h6l2 2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
      <Circle cx="12" cy="13" r="4" />
    </Svg>
  );
});

export const IconArtists = memo(function IconArtists({ color = "currentColor" }: IconProps) {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="9" cy="7" r="3.5" />
      <Circle cx="17" cy="9" r="2.5" />
      <Path d="M3 21v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" />
      <Path d="M17 17v-1a3 3 0 0 1 3-3h0a3 3 0 0 1 3 3v1" />
    </Svg>
  );
});

export const IconSaved = memo(function IconSaved({ color = "currentColor" }: IconProps) {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Svg>
  );
});

export const IconStatus = memo(function IconStatus({ color = "currentColor" }: IconProps) {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3.5 3.5" />
    </Svg>
  );
});

export const IconNailOfTheDay = memo(function IconNailOfTheDay({ color = "currentColor" }: IconProps) {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 2h6l.8 3v2l1.4 1c.5.4.8 1.1.8 1.8V20c0 1.1-.9 2-2 2H8c-1.1 0-2-.9-2-2V9.8c0-.7.3-1.4.8-1.8l1.4-1V5L9 2z" />
      <Path d="M8.2 5h7.6" />
      <Rect x="8" y="12" width="8" height="4" rx="1" />

      <G fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <G transform="translate(16 3)">
          <Path d="M0 0l.5 1.5L2.5 2.5l-1.5.5L0 4.5l-.5-1.5L-2 2.5l1.5-.5L0 0z" />
        </G>
        <G transform="translate(4 5)">
          <Path d="M0 0l.4 1.1L2 1.5l-1.1.4L0 3l-.4-1.1-1.1-.4 1.1-.4L0 0z" strokeWidth="0.9" />
        </G>
      </G>
    </Svg>
  );
});
