import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { GradientCard } from '@/components/ds-ui';
import { Emoji } from '@/components/emoji';
import {
  Ellie,
  Font,
  Ink,
  Lift,
  Motion,
  MoodGradient,
  MoodPalette,
  Radius,
  Spacing,
  Surface,
  Type,
  type Mood,
} from '@/constants/theme';
import { EllieFace } from './ellie-face';

/**
 * The hero: a candy gradient card with today's count on the left and Ellie on the
 * right, bobbing and flicking her tail, then her speech bubble underneath.
 *
 * The gradient follows her mood, so the whole card warms up as the day gets heavier
 * — but the mood is also written in the chip, never carried by colour alone.
 */
export function EllieHero({
  mood,
  line,
  total,
  limit = 0,
  streak = 0,
  onPress,
}: {
  mood: Mood;
  line: string;
  total: number;
  limit?: number;
  streak?: number;
  onPress?: () => void;
}) {
  const palette = MoodPalette[mood];
  const bob = useSharedValue(0);
  const tail = useSharedValue(0);
  const countPop = useSharedValue(0);
  const fill = useSharedValue(0);

  // Slow when she is calm, quicker when she is not — the rhythm carries the mood as
  // well as the colour does.
  const period = mood === 'sleepy' ? 3000 : mood === 'worried' ? 1100 : 1900;

  useEffect(() => {
    bob.value = withRepeat(
      withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    tail.value = withRepeat(
      withTiming(1, { duration: period * 0.8, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [period, bob, tail]);

  // A bouncy kick each time the number changes, so the count feels like it landed.
  useEffect(() => {
    countPop.value = withSequence(
      withSpring(1, { damping: 7, stiffness: 340 }),
      withSpring(0, { damping: 12, stiffness: 220 })
    );
  }, [total, countPop]);

  const fraction = limit > 0 ? Math.min(1, total / limit) : 0;
  useEffect(() => {
    fill.value = withDelay(250, withSpring(fraction, { damping: 16, stiffness: 90 }));
  }, [fraction, fill]);

  const ellieStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -6 * bob.value },
      { rotate: `${(bob.value - 0.5) * 4}deg` },
    ],
  }));
  const tailStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-18 + tail.value * 36}deg` }],
  }));
  const countStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + countPop.value * 0.14 }],
  }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  const over = limit > 0 && total > limit;

  return (
    <View>
      <GradientCard colors={MoodGradient[mood]}>
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Emoji char={palette.emoji} size={18} />
            <Text style={styles.chipText}>Ellie is {palette.label.toLowerCase()}</Text>
          </View>
          {streak > 0 ? (
            <View style={[styles.chip, styles.streakChip]}>
              <Emoji char="🔥" size={18} />
              <Text style={[styles.chipText, styles.streakText]}>{streak}-day streak</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={styles.countCol}>
            <Text style={styles.kicker}>Today</Text>
            <Animated.View style={[styles.countWrap, countStyle]}>
              <Text style={styles.count} adjustsFontSizeToFit numberOfLines={1}>
                {total}
              </Text>
            </Animated.View>
            <Text style={styles.unit}>{total === 1 ? 'reel scrolled' : 'reels scrolled'}</Text>

            {limit > 0 ? (
              <View style={styles.meter}>
                <View style={styles.track}>
                  <Animated.View style={[styles.fill, fillStyle]} />
                </View>
                <Text style={styles.meterText}>
                  {over ? `${total - limit} over your ${limit}` : `${limit - total} left of ${limit}`}
                </Text>
              </View>
            ) : (
              <Text style={styles.meterText}>No daily cap yet</Text>
            )}
          </View>

          <View style={styles.stage}>
            <View style={styles.halo} />
            <Animated.View style={[styles.tail, tailStyle]}>
              <Svg width={44} height={70} viewBox="0 0 54 86">
                <Path
                  d="M12 84 Q6 56 20 36 Q34 16 44 24 Q50 29 44 36 Q36 28 28 42 Q18 60 24 84 Z"
                  fill={Ellie.fur}
                  stroke={Ellie.outline}
                  strokeWidth={3}
                  strokeLinejoin="round"
                />
              </Svg>
            </Animated.View>
            <Animated.View style={ellieStyle}>
              <EllieFace mood={mood} size={132} />
            </Animated.View>
          </View>
        </View>
      </GradientCard>

      <SpeechBubble accent={palette.accent} onPress={onPress}>
        {line}
      </SpeechBubble>
    </View>
  );
}

function SpeechBubble({
  children,
  accent,
  onPress,
}: {
  children: string;
  accent: string;
  onPress?: () => void;
}) {
  const press = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * (1 - Motion.pressScale) }],
  }));

  return (
    <Animated.View style={[styles.bubbleWrap, style]}>
      <Pressable
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityHint={onPress ? 'Opens Ellie' : undefined}
        disabled={!onPress}
        onPress={onPress}
        onPressIn={() => (press.value = withSpring(1, { damping: 18, stiffness: 420 }))}
        onPressOut={() => (press.value = withSpring(0, { damping: 9, stiffness: 300 }))}>
        {/* The notch points back up at her, on the right. */}
        <View style={styles.notchRow}>
          <View style={styles.notch} />
        </View>
        <View style={[styles.bubble, { borderLeftColor: accent }]}>
          <Text style={styles.bubbleText}>{children}</Text>
          {onPress ? <Text style={[styles.bubbleCta, { color: accent }]}>Ask Ellie something →</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  chipText: { ...Type.caption, fontFamily: Font.bold, color: '#FFFFFF' },
  streakChip: { backgroundColor: '#FFFFFF' },
  streakText: { color: '#E8590C' },

  body: { flexDirection: 'row', alignItems: 'flex-end', marginTop: Spacing.md },
  countCol: { flex: 1, paddingBottom: Spacing.xs },
  kicker: { ...Type.label, color: 'rgba(255,255,255,0.85)' },
  countWrap: { alignSelf: 'flex-start' },
  count: {
    ...Type.hero,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.12)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 0,
  },
  unit: { ...Type.caption, color: 'rgba(255,255,255,0.9)', marginTop: -4 },

  meter: { marginTop: Spacing.md },
  track: {
    height: 10,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  fill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: Radius.pill },
  meterText: { ...Type.tick, fontFamily: Font.bold, color: 'rgba(255,255,255,0.92)', marginTop: 2 },

  stage: { width: 140, height: 150, alignItems: 'center', justifyContent: 'flex-end' },
  halo: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255,255,255,0.2)',
    bottom: 10,
  },
  tail: {
    position: 'absolute',
    right: 0,
    bottom: 4,
    // Rotate about the base of the tail, where it meets her.
    transformOrigin: 'bottom center',
  },

  bubbleWrap: { marginTop: Spacing.sm },
  notchRow: { alignItems: 'flex-end', paddingRight: 64 },
  notch: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: Surface.card,
  },
  bubble: {
    backgroundColor: Surface.card,
    borderRadius: Radius.card,
    borderLeftWidth: 5,
    padding: Spacing.lg,
    ...Lift,
  },
  bubbleText: { ...Type.speech, color: Ink.primary },
  bubbleCta: { ...Type.caption, fontFamily: Font.bold, marginTop: Spacing.sm },
});
