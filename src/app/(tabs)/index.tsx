import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBreakdown } from '@/components/charts';
import { EllieHero } from '@/components/ellie';
import {
  Banner,
  Screen,
  Stagger,
  UnsupportedNotice,
  useHapticOn,
} from '@/components/ds-ui';
import { Ink, Radius, Spacing, Surface, Type } from '@/constants/theme';
import { useEllie } from '@/hooks/use-ellie';
import { formatDuration, usePermissions, useSettings, useToday } from '@/hooks/use-scrollwise';

export default function Today() {
  const router = useRouter();
  const { serviceEnabled, overlayGranted, isSupported } = usePermissions();
  const { settings } = useSettings();
  const { today } = useToday();
  const { mood, headline } = useEllie();

  // A user who has not finished setup has nothing to look at, so send them straight
  // through rather than showing a dashboard of zeros.
  useEffect(() => {
    if (settings && !settings.onboardingComplete && isSupported) {
      router.replace('/onboarding');
    }
  }, [settings, isSupported, router]);

  const overLimit = (settings?.dailyLimit ?? 0) > 0 && (today?.total ?? 0) >= settings!.dailyLimit;
  useHapticOn(overLimit);

  const perReel =
    today && today.total > 0 ? `${Math.round(today.feedMs / today.total / 1000)}s` : '—';

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {!isSupported ? <UnsupportedNotice /> : null}

          {isSupported && !serviceEnabled ? (
            <Banner
              tone="bad"
              text="Counting is off — the accessibility service is not enabled."
              actionLabel="Fix"
              onAction={() => router.push('/onboarding')}
            />
          ) : null}

          {isSupported && serviceEnabled && !overlayGranted ? (
            <Banner
              text="The floating counter is off. Counting still works."
              actionLabel="Fix"
              onAction={() => router.push('/settings')}
            />
          ) : null}

          <Stagger index={0}>
            <EllieHero
              mood={mood}
              total={today?.total ?? 0}
              line={headline?.text ?? 'Keeping count.'}
              onPress={() => router.push('/ellie')}
            />
          </Stagger>

          <Stagger index={1}>
            <View style={styles.statStrip}>
              <Stat label="Watch time" value={formatDuration(today?.feedMs ?? 0)} />
              <View style={styles.statDivider} />
              <Stat label="Per reel" value={perReel} />
              <View style={styles.statDivider} />
              <Stat label="Ads" value={`${today?.adReels ?? 0}`} />
            </View>
          </Stagger>

          <Stagger index={2}>
            <AppBreakdown apps={today?.apps ?? []} />
          </Stagger>

          <Text style={styles.footer}>
            Stored on this phone only. ScrollWise has no internet permission.
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

  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Surface.card,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    paddingVertical: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { ...Type.title, color: Ink.primary, fontVariant: ['tabular-nums'] },
  statLabel: { ...Type.tick, color: Ink.muted, marginTop: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: Surface.border },

  footer: {
    ...Type.tick,
    color: Ink.muted,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
});
