import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Body, Button, Panel, Screen, SectionTitle } from '@/components/ds-ui';
import { Ink, Radius, Spacing, Surface } from '@/constants/theme';
import { useToday } from '@/hooks/use-scrollwise';

/**
 * Measures how wrong the detector is, which is the only honest way to ship profiles
 * built from guesswork.
 *
 * The user scrolls a known number of reels and types it in; the difference between
 * that and what we counted is the error. Without this the app would be asking people
 * to trust a number nobody has ever checked.
 */
export default function Calibration() {
  const { today, reload } = useToday();
  const [baseline, setBaseline] = useState<number | null>(null);
  const [actual, setActual] = useState('');

  const counted = (today?.total ?? 0) - (baseline ?? 0);
  const expected = Number.parseInt(actual, 10);
  const hasResult = baseline != null && Number.isFinite(expected) && expected > 0;
  const error = hasResult ? counted - expected : 0;
  const accuracy = hasResult ? Math.round((counted / expected) * 100) : 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Panel>
          <SectionTitle>1. Start a run</SectionTitle>
          <Body muted>
            This marks where your count is now, so the rest of the test is measured
            from here.
          </Body>
          <Button
            label={baseline == null ? 'Mark my starting point' : `Started at ${baseline}`}
            onPress={() => {
              setBaseline(today?.total ?? 0);
              setActual('');
            }}
          />
        </Panel>

        <Panel>
          <SectionTitle>2. Scroll, counting as you go</SectionTitle>
          <Body muted>
            Open one of the apps and swipe through a number of reels you can keep track
            of — twenty is plenty. Scroll normally. Then come back here.
          </Body>
        </Panel>

        <Panel>
          <SectionTitle>3. How many did you actually watch?</SectionTitle>
          <TextInput
            value={actual}
            onChangeText={setActual}
            keyboardType="number-pad"
            placeholder="20"
            placeholderTextColor={Ink.muted}
            style={styles.input}
          />
          <Button label="Refresh my count" variant="quiet" onPress={reload} />

          {baseline != null ? (
            <View style={styles.resultBlock}>
              <Text style={styles.resultLine}>
                Counted since you started: <Text style={styles.resultValue}>{counted}</Text>
              </Text>
              {hasResult ? (
                <>
                  <Text style={styles.resultLine}>
                    Accuracy: <Text style={styles.resultValue}>{accuracy}%</Text>
                  </Text>
                  <Text style={styles.verdict}>{verdictFor(error, expected)}</Text>
                </>
              ) : null}
            </View>
          ) : null}
        </Panel>

        <Panel>
          <SectionTitle>If it is badly off</SectionTitle>
          <Body muted>
            Turn on debug logging in Settings, run the same test again, and pull the
            log with{' '}
            <Text style={styles.code}>adb logcat -s ScrollWise/Service</Text>. Each
            look at the screen prints whether a reel pager was found, why or why not,
            and the first characters of the reel&apos;s anonymous code — never the
            labels themselves. That is what is needed to fix that app&apos;s profile in{' '}
            <Text style={styles.code}>detection_profiles.json</Text>.
          </Body>
        </Panel>
      </ScrollView>
    </Screen>
  );
}

function verdictFor(error: number, expected: number): string {
  const ratio = Math.abs(error) / expected;
  if (ratio <= 0.05) return 'That is accurate. This profile can be trusted.';
  if (error < 0) {
    return `Under-counting by ${Math.abs(error)}. Some swipes are being rejected — usually the surface markers or the height ratio in the profile are too strict.`;
  }
  return `Over-counting by ${error}. Something other than a reel advance is being counted — most likely a comment sheet or carousel slipping past the structural checks. This is the worse direction to be wrong in.`;
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  input: {
    backgroundColor: Surface.raised,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    color: Ink.primary,
    fontSize: 18,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.lg,
  },
  resultBlock: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.border,
  },
  resultLine: { color: Ink.secondary, fontSize: 14, marginBottom: Spacing.xs },
  resultValue: { color: Ink.primary, fontWeight: '600' },
  verdict: { color: Ink.muted, fontSize: 13, lineHeight: 19, marginTop: Spacing.sm },
  code: { color: Ink.secondary, fontFamily: 'monospace', fontSize: 12 },
});
