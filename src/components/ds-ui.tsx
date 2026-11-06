import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Ink, innerRadius, Motion, Radius, Spacing, Surface, Type } from '@/constants/theme';

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
 * Press feedback shared by everything tappable.
 *
 * A scale rather than an opacity change: on a dark surface a dimming press reads as
 * the control switching off, while a shrink reads as it being pushed.
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
  style?: object | object[];
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
          press.value = withTiming(1, { duration: Motion.fast });
        }}
        onPressOut={() => {
          press.value = withTiming(0, { duration: Motion.fast });
        }}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
}) {
  return (
    <Pressable96 onPress={onPress} disabled={disabled} haptic={variant === 'primary'}>
      <View
        style={[
          styles.button,
          variant === 'primary' && styles.buttonPrimary,
          variant === 'secondary' && styles.buttonSecondary,
          variant === 'quiet' && styles.buttonQuiet,
          disabled && styles.buttonDisabled,
        ]}>
        <Text
          style={[
            styles.buttonLabel,
            variant === 'primary' && styles.buttonLabelPrimary,
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
}: {
  title: string;
  subtitle?: string;
  value?: boolean;
  onToggle?: (next: boolean) => void;
  onPress?: () => void;
  badge?: string;
  badgeTone?: 'neutral' | 'good' | 'bad';
}) {
  const content = (
    <View style={styles.row}>
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
          trackColor={{ false: Surface.gridline, true: '#2a5f3f' }}
          thumbColor={value ? '#0ca30c' : Ink.muted}
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
      style={[
        styles.pill,
        tone === 'good' && styles.pillGood,
        tone === 'bad' && styles.pillBad,
      ]}>
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

export function Panel({ children }: { children: React.ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

/** A card that enters with a short stagger, so a screen assembles rather than snaps. */
export function Stagger({ index = 0, children }: { index?: number; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(index * Motion.stagger).duration(Motion.base)}>
      {children}
    </Animated.View>
  );
}

/** A quiet one-line banner, for things that are wrong but not urgent. */
export function Banner({
  text,
  actionLabel,
  onAction,
  tone = 'warn',
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'warn' | 'bad';
}) {
  return (
    <Pressable96 onPress={onAction} disabled={!onAction}>
      <View style={[styles.banner, tone === 'bad' && styles.bannerBad]}>
        <View style={[styles.bannerDot, tone === 'bad' && styles.bannerDotBad]} />
        <Text style={styles.bannerText}>{text}</Text>
        {actionLabel ? <Text style={styles.bannerAction}>{actionLabel}</Text> : null}
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
    <Panel>
      <SectionTitle>Not available in this build</SectionTitle>
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

const CARD_PAD = Spacing.lg;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Surface.page },
  sectionTitle: { ...Type.heading, color: Ink.primary, marginBottom: Spacing.sm },
  body: { ...Type.body, color: Ink.secondary },
  bodyMuted: { color: Ink.muted },

  button: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.control,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  buttonPrimary: { backgroundColor: Ink.primary },
  buttonSecondary: {
    backgroundColor: Surface.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
  },
  buttonQuiet: { backgroundColor: 'transparent', paddingVertical: Spacing.md },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: { ...Type.label, fontSize: 15, color: Ink.primary, fontWeight: '600' },
  buttonLabelPrimary: { color: Surface.page },
  buttonLabelQuiet: { color: Ink.muted, fontWeight: '400' },

  panel: {
    backgroundColor: Surface.card,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    padding: CARD_PAD,
    marginBottom: Spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md },
  rowText: { flex: 1, paddingRight: Spacing.md },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowTitle: { ...Type.body, color: Ink.primary },
  rowSubtitle: { ...Type.caption, color: Ink.muted, marginTop: 3 },
  chevron: { color: Ink.muted, fontSize: 22, marginLeft: Spacing.sm },

  pill: {
    backgroundColor: Surface.raised,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillGood: { backgroundColor: 'rgba(12,163,12,0.16)' },
  pillBad: { backgroundColor: 'rgba(208,59,59,0.16)' },
  pillText: { ...Type.tick, color: Ink.muted, fontWeight: '600', letterSpacing: 0.4 },
  pillTextGood: { color: '#4ad24a' },
  pillTextBad: { color: '#ef7d7d' },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(250,178,25,0.12)',
    borderRadius: innerRadius(Radius.card, 4),
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  bannerBad: { backgroundColor: 'rgba(208,59,59,0.14)' },
  bannerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fab219' },
  bannerDotBad: { backgroundColor: '#d03b3b' },
  bannerText: { ...Type.caption, color: Ink.secondary, flex: 1, lineHeight: 18 },
  bannerAction: { ...Type.caption, color: Ink.primary, fontWeight: '600' },
});
