import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrainStateHero } from '@/components/brain-state';
import { AppBreakdown, Card, HourHeatmap, WeekBars } from '@/components/charts';
import { Body, Button, Panel, Screen, SectionTitle, UnsupportedNotice } from '@/components/ds-ui';
import { Ink, Spacing } from '@/constants/doomscroll-theme';
import {
  formatDuration,
  useInsights,
  usePermissions,
  useSettings,
  useToday,
  useWeek,
} from '@/hooks/use-doomscroll';

export default function Dashboard() {
  const router = useRouter();
  const { serviceEnabled, overlayGranted, isSupported } = usePermissions();
  const { settings } = useSettings();
  const { today } = useToday();
  const week = useWeek();
  const insights = useInsights(30);

  // A user who has not finished setup has nothing to look at, so send them
  // straight through rather than showing a dashboard of zeros.
  useEffect(() => {
    if (settings && !settings.onboardingComplete && isSupported) {
      router.replace('/onboarding');
    }
  }, [settings, isSupported, router]);

  return (
    <Screen>
      <SafeAreaView edges={['bottom']} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          {!isSupported ? <UnsupportedNotice /> : null}

          {isSupported && !serviceEnabled ? (
            <Panel>
              <SectionTitle>Counting is off</SectionTitle>
              <Body muted>
                The accessibility service is not enabled, so nothing is being counted
                right now.
              </Body>
              <Button label="Turn counting on" onPress={() => router.push('/onboarding')} />
            </Panel>
          ) : null}

          <BrainStateHero
            total={today?.total ?? 0}
            state={today?.brainState ?? 'healthy'}
            caption="Brain state is this app's own scale, set by the thresholds in Settings. It is not a medical measure."
          />

          <Card title="Today" subtitle="Watch time and pace">
            <View style={styles.statRow}>
              <Stat label="Watch time" value={formatDuration(today?.feedMs ?? 0)} />
              <Stat
                label="Average per reel"
                value={
                  today && today.total > 0
                    ? `${Math.round(today.feedMs / today.total / 1000)}s`
                    : '—'
                }
              />
              <Stat label="Of which ads" value={`${today?.adReels ?? 0}`} />
            </View>
          </Card>

          <AppBreakdown apps={today?.apps ?? []} />
          <WeekBars days={week.days} />
          <HourHeatmap hours={insights.hours} />

          {!overlayGranted && isSupported ? (
            <Panel>
              <SectionTitle>Floating counter is off</SectionTitle>
              <Body muted>
                Without the draw-over-apps permission the count still works, but you
                will only see it in here.
              </Body>
              <Button
                label="Fix in Settings"
                variant="secondary"
                onPress={() => router.push('/settings')}
              />
            </Panel>
          ) : null}

          <View style={styles.navRow}>
            <Button label="Limits" variant="secondary" onPress={() => router.push('/limits')} />
            <Button label="History" variant="secondary" onPress={() => router.push('/history')} />
            <Button
              label="Settings"
              variant="secondary"
              onPress={() => router.push('/settings')}
            />
          </View>

          <Text style={styles.footer}>
            Everything on this screen is stored on this phone only. The app has no
            internet permission.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  statRow: { flexDirection: 'row', gap: Spacing.lg },
  stat: { flex: 1 },
  statValue: { color: Ink.primary, fontSize: 20, fontWeight: '600' },
  statLabel: { color: Ink.muted, fontSize: 11, marginTop: 2 },
  navRow: { gap: Spacing.sm },
  footer: {
    color: Ink.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.xl,
    lineHeight: 16,
  },
});
