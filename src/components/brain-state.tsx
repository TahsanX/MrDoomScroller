import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  BrainStatePalette,
  Ink,
  Radius,
  Spacing,
  Surface,
} from '@/constants/doomscroll-theme';
import type { BrainState } from '../../modules/doomscroll-core/src';

/**
 * The hero figure: today's count, with the brain state around it.
 *
 * Drawn with plain Views and Reanimated rather than Lottie or SVG. Three concentric
 * rings that pulse slower and dimmer as the state degrades says everything the asset
 * needed to say, with no extra dependency and no animation file to commission.
 *
 * The state is always spelled out in words next to the colour. It is a status
 * reading, so colour never carries it alone — and the caption says out loud that this
 * is the app's own scale rather than anything clinical.
 */
export function BrainStateHero({
  total,
  state,
  caption,
}: {
  total: number;
  state: BrainState;
  caption: string;
}) {
  const palette = BrainStatePalette[state];
  const pulse = useSharedValue(0);

  useEffect(() => {
    // Healthy breathes slowly; fried flickers. The rhythm carries the state as well
    // as the hue does, which matters for anyone who cannot separate the two colours.
    const duration = state === 'healthy' ? 3200 : state === 'fatigued' ? 2000 : 900;
    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [state, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.06 }],
    opacity: 0.25 + pulse.value * 0.35,
  }));

  return (
    <View style={styles.wrapper}>
      <View style={styles.ringStack}>
        <Animated.View
          style={[styles.ring, styles.ringOuter, { borderColor: palette.color }, ringStyle]}
        />
        <View style={[styles.ring, styles.ringInner, { borderColor: palette.color }]} />
        <View style={styles.center}>
          <Text style={styles.count}>{total}</Text>
          <Text style={styles.countLabel}>{total === 1 ? 'reel today' : 'reels today'}</Text>
        </View>
      </View>

      <View style={styles.stateRow}>
        <View style={[styles.stateDot, { backgroundColor: palette.color }]} />
        <Text style={styles.stateLabel}>{palette.label}</Text>
        <Text style={styles.stateBlurb}>{palette.blurb}</Text>
      </View>

      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

const RING = 216;

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', paddingVertical: Spacing.xl },
  ringStack: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { position: 'absolute', borderRadius: RING / 2, borderWidth: 2 },
  ringOuter: { width: RING, height: RING },
  ringInner: { width: RING - 28, height: RING - 28, opacity: 0.35 },
  center: { alignItems: 'center' },
  count: {
    color: Ink.primary,
    fontSize: 64,
    fontWeight: '600',
    lineHeight: 70,
  },
  countLabel: { color: Ink.muted, fontSize: 13, marginTop: 2 },

  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    backgroundColor: Surface.card,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  stateDot: { width: 8, height: 8, borderRadius: 4 },
  stateLabel: { color: Ink.primary, fontSize: 14, fontWeight: '600' },
  stateBlurb: { color: Ink.muted, fontSize: 13 },

  caption: {
    color: Ink.muted,
    fontSize: 11,
    marginTop: Spacing.md,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    lineHeight: 16,
  },
});
