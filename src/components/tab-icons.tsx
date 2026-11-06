import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Tab icons, drawn rather than pulled from a font.
 *
 * Two weights of the same shape: an outline when the tab is not selected and a fill
 * when it is. Selection therefore reads from the shape as well as the colour, which
 * is what keeps the tab bar usable for anyone who cannot separate the two tones.
 */

// react-navigation hands the tint through as a ColorValue, not a plain string.
type IconProps = { active: boolean; color: ColorValue; size?: number };

export function TodayIcon({ active, color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle
        cx="12"
        cy="12"
        r="8.5"
        stroke={color}
        strokeWidth={active ? 0 : 1.8}
        fill={active ? color : 'none'}
      />
      <Path
        d="M12 7.5 V12 L15 14"
        stroke={active ? '#0d0d0d' : color}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export function InsightsIcon({ active, color, size = 24 }: IconProps) {
  const bar = (x: number, y: number, h: number) => (
    <Rect
      x={x}
      y={y}
      width="3.4"
      height={h}
      rx="1.5"
      fill={active ? color : 'none'}
      stroke={color}
      strokeWidth={active ? 0 : 1.6}
    />
  );
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {bar(4.3, 13, 7)}
      {bar(10.3, 8, 12)}
      {bar(16.3, 4.5, 15.5)}
    </Svg>
  );
}

export function LimitsIcon({ active, color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle
        cx="12"
        cy="12"
        r="8.5"
        stroke={color}
        strokeWidth="1.8"
        fill={active ? color : 'none'}
        opacity={active ? 0.25 : 1}
      />
      {/* The arc that is "used up" — the shape the Limits screen is about. */}
      <Path
        d="M12 3.5 A8.5 8.5 0 0 1 19.4 15.8"
        stroke={color}
        strokeWidth={active ? 3.2 : 1.8}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export function SettingsIcon({ active, color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle
        cx="12"
        cy="12"
        r="3.2"
        stroke={color}
        strokeWidth="1.8"
        fill={active ? color : 'none'}
      />
      <Path
        d="M12 2.8 v2.6 M12 18.6 v2.6 M21.2 12 h-2.6 M5.4 12 H2.8 M18.5 5.5 l-1.8 1.8 M7.3 16.7 l-1.8 1.8 M18.5 18.5 l-1.8-1.8 M7.3 7.3 L5.5 5.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
