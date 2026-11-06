import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Ink, Radius, Spacing, Surface } from '@/constants/theme';

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
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'quiet' && styles.buttonQuiet,
        pressed && styles.buttonPressed,
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
    </Pressable>
  );
}

export function Row({
  title,
  subtitle,
  value,
  onToggle,
  onPress,
  badge,
}: {
  title: string;
  subtitle?: string;
  value?: boolean;
  onToggle?: (next: boolean) => void;
  onPress?: () => void;
  badge?: string;
}) {
  const content = (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle}>{title}</Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {onToggle ? (
        <Switch
          value={value ?? false}
          onValueChange={onToggle}
          trackColor={{ false: Surface.gridline, true: '#2a5f3f' }}
          thumbColor={value ? '#0ca30c' : Ink.muted}
        />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress}>
        {content}
      </Pressable>
    );
  }
  return content;
}

export function Panel({ children }: { children: React.ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Surface.page },
  sectionTitle: {
    color: Ink.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  body: { color: Ink.secondary, fontSize: 14, lineHeight: 21 },
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
  buttonPressed: { opacity: 0.7 },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: { color: Ink.primary, fontSize: 15, fontWeight: '600' },
  buttonLabelPrimary: { color: Surface.page },
  buttonLabelQuiet: { color: Ink.muted, fontWeight: '400' },

  panel: {
    backgroundColor: Surface.card,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  rowText: { flex: 1, paddingRight: Spacing.md },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowTitle: { color: Ink.primary, fontSize: 15 },
  rowSubtitle: { color: Ink.muted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  badge: {
    backgroundColor: Surface.raised,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: Ink.muted, fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },
});
