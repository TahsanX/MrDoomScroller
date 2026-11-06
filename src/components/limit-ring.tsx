import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Ink, MoodPalette, Spacing, Surface, Type } from '@/constants/theme';

/**
 * Where today sits against the cap.
 *
 * A ring rather than a bar because the quantity is a proportion of one fixed whole,
 * and the gap left in the ring reads as "remaining" more directly than the empty end
 * of a bar does. Past the cap the ring is full and the colour carries the overshoot,
 * with the number saying so in words underneath — the state is never colour alone.
 */
export function LimitRing({ total, limit }: { total: number; limit: number }) {
  const size = 168;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const hasLimit = limit > 0;
  const fraction = hasLimit ? Math.min(1, total / limit) : 0;
  const over = hasLimit && total > limit;
  const accent = !hasLimit
    ? Ink.muted
    : over
      ? MoodPalette.worried.accent
      : fraction >= 0.7
        ? MoodPalette.watchful.accent
        : MoodPalette.content.accent;

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={Surface.gridline}
          strokeWidth={stroke}
          fill="none"
        />
        {hasLimit ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - fraction)}
            // Start the arc at twelve o'clock rather than three.
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        ) : null}
      </Svg>

      <View style={styles.center}>
        <Text style={styles.total}>{total}</Text>
        <Text style={styles.sub}>
          {hasLimit ? `of ${limit}` : 'no limit set'}
        </Text>
      </View>

      <Text style={[styles.verdict, { color: hasLimit ? Ink.secondary : Ink.muted }]}>
        {!hasLimit
          ? 'Pick a number below and this ring will track it.'
          : over
            ? `${total - limit} past your limit.`
            : `${limit - total} left today.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: Spacing.sm },
  center: { position: 'absolute', top: 52, alignItems: 'center' },
  total: { ...Type.display, color: Ink.primary, fontVariant: ['tabular-nums'] },
  sub: { ...Type.caption, color: Ink.muted, marginTop: -2 },
  verdict: { ...Type.body, marginTop: Spacing.md, textAlign: 'center' },
});
