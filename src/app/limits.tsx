import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Body, Panel, Row, Screen, SectionTitle } from '@/components/ds-ui';
import { Ink, Radius, Spacing, Surface } from '@/constants/doomscroll-theme';
import { useSettings, useToday } from '@/hooks/use-doomscroll';
import type { BlockMode } from '../../modules/doomscroll-core/src';

const DAILY_OPTIONS = [0, 20, 40, 60, 100];
const SESSION_OPTIONS = [0, 10, 20, 30, 50];

const MODES: { value: BlockMode; title: string; subtitle: string }[] = [
  {
    value: 'NOTIFY',
    title: 'Tell me',
    subtitle: 'A notification when you pass the limit. Nothing else happens.',
  },
  {
    value: 'NUDGE',
    title: 'Interrupt me',
    subtitle:
      'A full-screen panel with the number, a minute of snooze, and a way out. You can dismiss it.',
  },
  {
    value: 'HARD',
    title: 'Close the app',
    subtitle:
      'The panel, plus sending you to the home screen — and again if you come back. Still escapable by turning the service off, which this app will not hide from you.',
  },
];

export default function Limits() {
  const { settings, update } = useSettings();
  const { today } = useToday();

  if (!settings) return <Screen />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Panel>
          <SectionTitle>Daily cap</SectionTitle>
          <Body muted>
            Counted across all five apps. You are at {today?.total ?? 0} today.
          </Body>
          <Chips
            options={DAILY_OPTIONS}
            value={settings.dailyLimit}
            onChange={(dailyLimit) => update({ dailyLimit })}
          />
        </Panel>

        <Panel>
          <SectionTitle>Per sitting</SectionTitle>
          <Body muted>
            A sitting ends after five minutes away from a feed. A smaller number here
            tends to stick better than a daily total, because it lands while you are
            still in the habit rather than at the end of the day.
          </Body>
          <Chips
            options={SESSION_OPTIONS}
            value={settings.sessionLimit}
            onChange={(sessionLimit) => update({ sessionLimit })}
          />
        </Panel>

        <Panel>
          <SectionTitle>What happens at the limit</SectionTitle>
          {MODES.map((mode) => (
            <Pressable
              key={mode.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: settings.blockMode === mode.value }}
              onPress={() => update({ blockMode: mode.value })}>
              <View style={styles.modeRow}>
                <View
                  style={[
                    styles.radio,
                    settings.blockMode === mode.value && styles.radioOn,
                  ]}
                />
                <View style={styles.modeText}>
                  <Text style={styles.modeTitle}>{mode.title}</Text>
                  <Text style={styles.modeSubtitle}>{mode.subtitle}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </Panel>

        <Panel>
          <SectionTitle>Why there is no unbreakable block</SectionTitle>
          <Body muted>
            There is no honest way to build one. Android removes overlays over system
            dialogs, the back gesture and the notification shade keep working, and you
            can always switch the accessibility service off in system settings. An app
            that claimed otherwise would be lying to you. What this does instead is
            make the number impossible to ignore and put a deliberate step between you
            and the next swipe.
          </Body>
        </Panel>

        <Panel>
          <SectionTitle>Counted apps</SectionTitle>
          <Body muted>
            Switch an app off and its swipes stop being counted from that moment.
          </Body>
          <View style={styles.spacer} />
          {(['instagram', 'youtube', 'tiktok', 'facebook', 'snapchat'] as const).map(
            (appId) => (
              <Row
                key={appId}
                title={appId.charAt(0).toUpperCase() + appId.slice(1)}
                value={settings.enabledApps.includes(appId)}
                onToggle={(on) =>
                  update({
                    enabledApps: on
                      ? [...settings.enabledApps, appId]
                      : settings.enabledApps.filter((a) => a !== appId),
                  })
                }
              />
            )
          )}
        </Panel>
      </ScrollView>
    </Screen>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: number[];
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === option }}
          onPress={() => onChange(option)}
          style={[styles.chip, value === option && styles.chipOn]}>
          <Text style={[styles.chipText, value === option && styles.chipTextOn]}>
            {option === 0 ? 'Off' : option}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  spacer: { height: Spacing.sm },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  chip: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.control,
    backgroundColor: Surface.raised,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
  },
  chipOn: { backgroundColor: Ink.primary, borderColor: Ink.primary },
  chipText: { color: Ink.secondary, fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: Surface.page },

  modeRow: { flexDirection: 'row', paddingVertical: Spacing.md, gap: Spacing.md },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Ink.muted,
    marginTop: 2,
  },
  radioOn: { borderColor: Ink.primary, backgroundColor: Ink.primary },
  modeText: { flex: 1 },
  modeTitle: { color: Ink.primary, fontSize: 15, fontWeight: '600' },
  modeSubtitle: { color: Ink.muted, fontSize: 12, marginTop: 3, lineHeight: 17 },
});
