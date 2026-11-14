import * as Haptics from 'expo-haptics';
import { useEffect, useId } from 'react';
import { Pressable, StyleSheet, Switch, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Emoji } from '@/components/emoji';

import {
  Candy,
  Font,
  Ink,
  innerRadius,
  Lift,
  Motion,
  Radius,
  Spacing,
  Surface,
  Type,
} from '@/constants/theme';

/** Children are optional so `<Screen />` works as the empty loading state. */
export function Screen({ children }: { children?: React.ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Body({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && styles.bodyMuted]}>{children}</Text>;
}

/**
 * Press feedback shared by everything tappable: a springy squish, like pressing a
 * rubber sticker. A scale rather than a dim, so pressing never reads as "disabled".
 */
export function Pressable96({
  children,
  onPress,
  disabled,
  haptic = false,
  style,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityState,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  haptic?: boolean;
  style?: ViewStyle | ViewStyle[];
  accessibilityRole?: 'button' | 'radio' | 'tab' | 'link';
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
}) {
  const press = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * (1 - Motion.pressScale) }],
  }));

  return (
    <Animated.View style={[animated, style]}>
      <Pressable
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        disabled={disabled}
        onPress={() => {
          if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress?.();
        }}
        onPressIn={() => {
          press.value = withSpring(1, { damping: 18, stiffness: 420 });
        }}
        onPressOut={() => {
          press.value = withSpring(0, { damping: 9, stiffness: 300 });
        }}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

/**
 * Chunky candy button. The primary has a darker "lip" underneath, so it looks like
 * something you can actually push in.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  color = Candy.violet,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
  color?: string;
}) {
  return (
    <Pressable96 onPress={onPress} disabled={disabled} haptic={variant === 'primary'}>
      <View
        style={[
          styles.button,
          variant === 'primary' && [styles.buttonPrimary, { backgroundColor: color, borderBottomColor: shade(color) }],
          variant === 'secondary' && styles.buttonSecondary,
          variant === 'quiet' && styles.buttonQuiet,
          disabled && styles.buttonDisabled,
        ]}>
        <Text
          style={[
            styles.buttonLabel,
            variant === 'primary' && styles.buttonLabelPrimary,
            variant === 'secondary' && { color },
            variant === 'quiet' && styles.buttonLabelQuiet,
          ]}>
          {label}
        </Text>
      </View>
    </Pressable96>
  );
}

export function Row({
  title,
  subtitle,
  value,
  onToggle,
  onPress,
  badge,
  badgeTone = 'neutral',
  emoji,
  tint,
}: {
  title: string;
  subtitle?: string;
  value?: boolean;
  onToggle?: (next: boolean) => void;
  onPress?: () => void;
  badge?: string;
  badgeTone?: 'neutral' | 'good' | 'bad';
  emoji?: string;
  tint?: string;
}) {
  const content = (
    <View style={styles.row}>
      {emoji ? <Sticker emoji={emoji} tint={tint ?? Candy.violetSoft} size={44} /> : null}
      <View style={styles.rowText}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle}>{title}</Text>
          {badge ? <StatusPill label={badge} tone={badgeTone} /> : null}
        </View>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {onToggle ? (
        <Switch
          value={value ?? false}
          onValueChange={(next) => {
            Haptics.selectionAsync().catch(() => {});
            onToggle(next);
          }}
          trackColor={{ false: Surface.axis, true: '#B8A6FF' }}
          thumbColor={value ? Candy.violet : '#FFFFFF'}
        />
      ) : null}
      {onPress ? <Text style={styles.chevron}>›</Text> : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable96 onPress={onPress} accessibilityLabel={title}>
        {content}
      </Pressable96>
    );
  }
  return content;
}

/** Status never rides on colour alone — the pill always carries its word. */
export function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'good' | 'bad';
}) {
  return (
    <View
      style={[styles.pill, tone === 'good' && styles.pillGood, tone === 'bad' && styles.pillBad]}>
      <Text
        style={[
          styles.pillText,
          tone === 'good' && styles.pillTextGood,
          tone === 'bad' && styles.pillTextBad,
        ]}>
        {label}
      </Text>
    </View>
  );
}

/** White floating card. `tint` swaps the white for a soft candy wash. */
export function Panel({ children, tint }: { children: React.ReactNode; tint?: string }) {
  return <View style={[styles.panel, tint ? { backgroundColor: tint } : null]}>{children}</View>;
}

/**
 * An emoji sitting on a soft rounded blob, tilted a few degrees so a column of them
 * looks hand-placed rather than gridded. One place to swap in 3D art later.
 */
export function Sticker({
  emoji,
  tint,
  size = 48,
  tilt = -6,
}: {
  emoji: string;
  tint: string;
  size?: number;
  tilt?: number;
}) {
  return (
    <View
      style={[
        styles.sticker,
        {
          width: size,
          height: size,
          borderRadius: size * 0.36,
          backgroundColor: tint,
          transform: [{ rotate: `${tilt}deg` }],
        },
      ]}>
      <Emoji char={emoji} size={size * 0.58} />
    </View>
  );
}

/**
 * A card with a diagonal two-stop gradient behind its content. Reserved for hero
 * moments — the count, the streak — so the gradient keeps meaning "this matters".
 */
export function GradientCard({
  colors,
  children,
  style,
}: {
  colors: [string, string];
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View style={[styles.gradientCard, { shadowColor: colors[0] }, style]}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="1" stopColor={colors[1]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
      </Svg>
      {/* Two soft bubbles for depth: cartoon light, not a photo effect. */}
      <View style={[styles.blob, styles.blobA]} />
      <View style={[styles.blob, styles.blobB]} />
      {children}
    </View>
  );
}

/** A card that bounces in with a short stagger, so a screen assembles rather than snaps. */
export function Stagger({ index = 0, children }: { index?: number; children: React.ReactNode }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * Motion.stagger).springify().damping(16).stiffness(180)}>
      {children}
    </Animated.View>
  );
}

/** A one-line banner, for things that are wrong but not urgent. */
export function Banner({
  text,
  actionLabel,
  onAction,
  tone = 'warn',
  emoji,
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'warn' | 'bad' | 'info';
  emoji?: string;
}) {
  const palette =
    tone === 'bad'
      ? { bg: Candy.coralSoft, fg: Candy.coral }
      : tone === 'info'
        ? { bg: Candy.violetSoft, fg: Candy.violet }
        : { bg: Candy.sunSoft, fg: '#B87700' };
  return (
    <Pressable96 onPress={onAction} disabled={!onAction}>
      <View style={[styles.banner, { backgroundColor: palette.bg }]}>
        <Text style={styles.bannerEmoji}>{emoji ?? (tone === 'bad' ? '⚠️' : '💡')}</Text>
        <Text style={styles.bannerText}>{text}</Text>
        {actionLabel ? (
          <View style={[styles.bannerAction, { backgroundColor: palette.fg }]}>
            <Text style={styles.bannerActionText}>{actionLabel}</Text>
          </View>
        ) : null}
      </View>
    </Pressable96>
  );
}

/**
 * Shown when the native module is missing — on web, in Expo Go, or in any build
 * without the module compiled in. Saying so plainly beats a dashboard of zeros that
 * looks like the counter is simply not working.
 */
export function UnsupportedNotice() {
  return (
    <Panel tint={Candy.sunSoft}>
      <SectionTitle>🧪 Not available in this build</SectionTitle>
      <Body muted>
        Counting needs the native Android module, which is not present here. Run a
        development or release build on an Android device — Expo Go and the web bundle
        cannot see scroll events.
      </Body>
    </Panel>
  );
}

/** Fires a haptic once when `when` becomes true. */
export function useHapticOn(when: boolean, style = Haptics.NotificationFeedbackType.Warning) {
  useEffect(() => {
    if (when) Haptics.notificationAsync(style).catch(() => {});
  }, [when, style]);
}

/** A darker step of a hex colour, for button lips. */
export function shade(hex: string, amount = 0.22): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.round(c * (1 - amount)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const CARD_PAD = Spacing.xl;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Surface.page },
  sectionTitle: { ...Type.heading, color: Ink.primary, marginBottom: Spacing.sm },
  body: { ...Type.body, color: Ink.secondary },
  bodyMuted: { color: Ink.muted },

  button: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  buttonPrimary: { borderBottomWidth: 4, ...Lift, shadowOpacity: 0.25 },
  buttonSecondary: { backgroundColor: Candy.violetSoft },
  buttonQuiet: { backgroundColor: 'transparent', minHeight: 44, paddingVertical: Spacing.sm },
  buttonDisabled: { opacity: 0.45 },
  buttonLabel: { ...Type.label, fontSize: 16, color: Ink.primary },
  buttonLabelPrimary: { color: '#FFFFFF' },
  buttonLabelQuiet: { color: Ink.muted, fontFamily: Font.regular },

  panel: {
    backgroundColor: Surface.card,
    borderRadius: Radius.card,
    padding: CARD_PAD,
    marginBottom: Spacing.lg,
    ...Lift,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.md },
  rowText: { flex: 1 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  rowTitle: { ...Type.label, fontSize: 15, color: Ink.primary },
  rowSubtitle: { ...Type.caption, color: Ink.muted, marginTop: 2 },
  chevron: { color: Ink.muted, fontSize: 26, marginLeft: Spacing.xs },

  pill: {
    backgroundColor: Surface.raised,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillGood: { backgroundColor: Candy.mintSoft },
  pillBad: { backgroundColor: Candy.coralSoft },
  pillText: { ...Type.tick, fontFamily: Font.bold, color: Ink.muted, letterSpacing: 0.5 },
  pillTextGood: { color: '#0B8A66' },
  pillTextBad: { color: '#D63A4E' },

  sticker: { alignItems: 'center', justifyContent: 'center' },

  gradientCard: {
    borderRadius: Radius.sheet,
    overflow: 'hidden',
    padding: CARD_PAD,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  blobA: { width: 180, height: 180, top: -60, right: -50 },
  blobB: { width: 120, height: 120, bottom: -50, left: -30 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: innerRadius(Radius.card, 4),
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  bannerEmoji: { fontSize: 20 },
  bannerText: { ...Type.caption, color: Ink.secondary, flex: 1 },
  bannerAction: { borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 6 },
  bannerActionText: { ...Type.label, fontSize: 13, color: '#FFFFFF' },
});
