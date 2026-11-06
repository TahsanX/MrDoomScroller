import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import {
  Ellie,
  Ink,
  Motion,
  MoodPalette,
  Radius,
  Spacing,
  Surface,
  Type,
  type Mood,
} from '@/constants/theme';
import { EllieFace } from './ellie-face';

/**
 * Ellie, her tail, and whatever she currently has to say.
 *
 * The motion is deliberately small — a breath, a tail, a blink. She has to survive
 * being looked at every day, and anything bouncier would wear out in a week.
 */
export function EllieHero({
  mood,
  line,
  total,
  onPress,
}: {
  mood: Mood;
  line: string;
  total: number;
  onPress?: () => void;
}) {
  const palette = MoodPalette[mood];
  const breath = useSharedValue(0);
  const tail = useSharedValue(0);
  const countPop = useSharedValue(0);

  // Slow when she is calm, quicker when she is not — the rhythm carries the mood as
  // well as the colour does, which matters if you cannot separate the two hues.
  const period = mood === 'sleepy' ? 3600 : mood === 'worried' ? 1400 : 2600;

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    tail.value = withRepeat(
      withTiming(1, { duration: period * 1.3, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [period, breath, tail]);

  // A small kick each time the number changes, so the count feels like it landed.
  useEffect(() => {
    countPop.value = withSequence(
      withSpring(1, { damping: 9, stiffness: 320 }),
      withSpring(0, { damping: 14, stiffness: 220 })
    );
  }, [total, countPop]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.022 }, { translateY: breath.value * -2 }],
  }));

  const tailStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-14 + tail.value * 28}deg` }],
  }));

  const countStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + countPop.value * 0.12 }],
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        {/* A soft halo in the mood colour, behind her. */}
        <View style={[styles.halo, { backgroundColor: palette.accent }]} />

        <Animated.View style={[styles.tail, tailStyle]}>
          <Svg width={54} height={86} viewBox="0 0 54 86">
            <Path
              d="M12 84 Q6 56 20 36 Q34 16 44 24 Q50 29 44 36 Q36 28 28 42 Q18 60 24 84 Z"
              fill={Ellie.fur}
            />
            <Path d="M30 30 Q38 22 43 27" stroke={Ellie.furShade} strokeWidth="4" strokeLinecap="round" fill="none" />
          </Svg>
        </Animated.View>

        <Animated.View style={bodyStyle}>
          <EllieFace mood={mood} size={168} />
        </Animated.View>
      </View>

      <Animated.View style={[styles.countRow, countStyle]}>
        <Text style={styles.count}>{total}</Text>
        <Text style={styles.countUnit}>{total === 1 ? 'reel today' : 'reels today'}</Text>
      </Animated.View>

      <SpeechBubble accent={palette.accent} moodLabel={palette.label} onPress={onPress}>
        {line}
      </SpeechBubble>
    </View>
  );
}

function SpeechBubble({
  children,
  accent,
  moodLabel,
  onPress,
}: {
  children: string;
  accent: string;
  moodLabel: string;
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
        onPressIn={() => (press.value = withTiming(1, { duration: Motion.fast }))}
        onPressOut={() => (press.value = withTiming(0, { duration: Motion.fast }))}>
        {/* The notch that points back at her. */}
        <View style={styles.notchRow}>
          <View style={[styles.notch, { borderBottomColor: Surface.card }]} />
        </View>
        <View style={styles.bubble}>
          <View style={styles.bubbleHead}>
            <View style={[styles.moodDot, { backgroundColor: accent }]} />
            <Text style={styles.moodLabel}>Ellie · {moodLabel}</Text>
          </View>
          <Text style={styles.bubbleText}>{children}</Text>
          {onPress ? <Text style={styles.bubbleCta}>Tap to ask her something</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  stage: {
    width: 220,
    height: 190,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  halo: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.1,
    top: 18,
  },
  tail: {
    position: 'absolute',
    right: 6,
    bottom: 2,
    // Rotate about the base of the tail, where it meets her.
    transformOrigin: 'bottom center',
  },

  countRow: { alignItems: 'center', marginTop: Spacing.sm },
  count: { ...Type.hero, color: Ink.primary },
  countUnit: { ...Type.caption, color: Ink.muted, marginTop: -2 },

  bubbleWrap: { alignSelf: 'stretch', marginTop: Spacing.lg },
  notchRow: { alignItems: 'center' },
  notch: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  bubble: {
    backgroundColor: Surface.card,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    padding: Spacing.lg,
  },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  moodDot: { width: 7, height: 7, borderRadius: 4 },
  moodLabel: { ...Type.caption, color: Ink.muted, letterSpacing: 0.3 },
  bubbleText: { ...Type.speech, color: Ink.primary },
  bubbleCta: { ...Type.caption, color: Ink.muted, marginTop: Spacing.md },
});
