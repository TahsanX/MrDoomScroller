import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Body, Panel, Pressable96, Row, Screen, SectionTitle, shade, Sticker } from '@/components/ds-ui';
import { LimitRing } from '@/components/limit-ring';
import {
  AppLabels,
  AppSticker,
  Candy,
  Font,
  Ink,
  Radius,
  SeriesSoft,
  Spacing,
  Surface,
  Type,
} from '@/constants/theme';
import { useSettings, useToday } from '@/hooks/use-scrollwise';
import type { BlockMode } from '../../../modules/scrollwise-core/src';

const DAILY_OPTIONS = [0, 20, 40, 60, 100];
const SESSION_OPTIONS = [0, 10, 20, 30, 50];

const MODES: { value: BlockMode; title: string; subtitle: string; emoji: string; tint: string }[] = [
  {
    value: 'NOTIFY',
    emoji: '🔔',
    tint: Candy.skySoft,
    title: 'Tell me',
    subtitle: 'A notification when you pass the limit. Nothing else happens.',
  },
  {
    value: 'NUDGE',
    emoji: '✋',
    tint: Candy.sunSoft,
    title: 'Interrupt me',
    subtitle:
      'A full-screen panel with the number, a minute of snooze, and a way out. You can dismiss it.',
  },
  {
    value: 'HARD',
    emoji: '🚪',
    tint: Candy.coralSoft,
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
          <LimitRing total={today?.total ?? 0} limit={settings.dailyLimit} />
        </Panel>

        <Panel>
          <SectionTitle>🎯 Daily cap</SectionTitle>
          <Body muted>Counted across all five apps.</Body>
          <Chips
            color={Candy.violet}
            options={DAILY_OPTIONS}
            value={settings.dailyLimit}
            onChange={(dailyLimit) => update({ dailyLimit })}
          />
        </Panel>

        <Panel>
          <SectionTitle>🛋️ Per sitting</SectionTitle>
          <Body muted>
            A sitting ends after five minutes away from a feed. A smaller number here
            tends to stick better than a daily total, because it lands while you are
            still in the habit rather than at the end of the day.
          </Body>
          <Chips
            color={Candy.pink}
            options={SESSION_OPTIONS}
            value={settings.sessionLimit}
            onChange={(sessionLimit) => update({ sessionLimit })}
          />
        </Panel>

        <Panel>
          <SectionTitle>🚦 What happens at the limit</SectionTitle>
          {MODES.map((mode) => (
            <Pressable96
              key={mode.value}
              accessibilityRole="radio"
              accessibilityLabel={mode.title}
              accessibilityState={{ selected: settings.blockMode === mode.value }}
              onPress={() => update({ blockMode: mode.value })}>
              <View
                style={[
                  styles.modeRow,
                  settings.blockMode === mode.value && { backgroundColor: mode.tint },
                ]}>
                <Sticker emoji={mode.emoji} tint={mode.tint} size={44} />
                <View style={styles.modeText}>
                  <Text style={styles.modeTitle}>{mode.title}</Text>
                  <Text style={styles.modeSubtitle}>{mode.subtitle}</Text>
                </View>
                <View
                  style={[styles.radio, settings.blockMode === mode.value && styles.radioOn]}
                />
              </View>
            </Pressable96>
          ))}
        </Panel>

        <Panel tint={Candy.violetSoft}>
          <SectionTitle>🤝 Why there is no unbreakable block</SectionTitle>
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
          <SectionTitle>📱 Counted apps</SectionTitle>
          <Body muted>
            Switch an app off and its swipes stop being counted from that moment.
          </Body>
          <View style={styles.spacer} />
          {(['instagram', 'youtube', 'tiktok', 'facebook', 'snapchat'] as const).map(
            (appId) => (
              <Row
                key={appId}
                emoji={AppSticker[appId]}
                tint={SeriesSoft[appId]}
                title={AppLabels[appId]}
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
  color,
}: {
  options: number[];
  value: number;
  onChange: (next: number) => void;
  color: string;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === option }}
          onPress={() => onChange(option)}
          style={[
            styles.chip,
            value === option && { backgroundColor: color, borderBottomColor: shade(color) },
          ]}>
          <Text style={[styles.chipText, value === option && styles.chipTextOn]}>
            {option === 0 ? 'Off' : option}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Clears the floating tab bar.
  content: { padding: Spacing.lg, paddingBottom: 120 },
  spacer: { height: Spacing.sm },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  chip: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: Radius.control,
    backgroundColor: Surface.raised,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: Surface.axis,
  },
  chipText: { ...Type.label, color: Ink.secondary },
  chipTextOn: { color: '#FFFFFF' },

  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    borderRadius: Radius.control + 4,
    marginTop: Spacing.xs,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: Surface.axis,
    backgroundColor: Surface.card,
  },
  radioOn: { borderColor: Candy.violet, borderWidth: 7 },
  modeText: { flex: 1 },
  modeTitle: { ...Type.label, fontSize: 15, color: Ink.primary, fontFamily: Font.bold },
  modeSubtitle: { ...Type.caption, color: Ink.muted, marginTop: 2 },
});
