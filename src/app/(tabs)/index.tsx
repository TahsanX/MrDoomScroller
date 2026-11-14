import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBreakdown } from '@/components/charts';
import {
  Banner,
  Screen,
  Stagger,
  Sticker,
  UnsupportedNotice,
  useHapticOn,
} from '@/components/ds-ui';
import { EllieHero } from '@/components/ellie';
import { Emoji } from '@/components/emoji';
import { TrackingModePicker } from '@/components/tracking-mode';
import { Candy, Font, Ink, Lift, Radius, Spacing, Surface, Type } from '@/constants/theme';
import { useEllie } from '@/hooks/use-ellie';
import { formatDuration, useNow, usePermissions, useSettings, useToday } from '@/hooks/use-scrollwise';
import * as Core from '../../../modules/scrollwise-core/src';

export default function Today() {
  const router = useRouter();
  const { serviceEnabled, overlayGranted, isSupported } = usePermissions();
  const { settings, update } = useSettings();
  const { today } = useToday();
  const { mood, headline, stats } = useEllie();

  // A user who has not finished setup has nothing to look at, so send them straight
  // through rather than showing a dashboard of zeros.
  useEffect(() => {
    if (settings && !settings.onboardingComplete && isSupported) {
      router.replace('/onboarding');
    }
  }, [settings, isSupported, router]);

  const limit = settings?.dailyLimit ?? 0;
  const total = today?.total ?? 0;
  const overLimit = limit > 0 && total >= limit;
  useHapticOn(overLimit);

  const perReel = today && today.total > 0 ? `${Math.round(today.feedMs / today.total / 1000)}s` : '—';
  const now = useNow();
  const paused = (settings?.pausedUntil ?? 0) > now;

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.hello}>{greeting()}</Text>
              <Text style={styles.title}>Your scroll day</Text>
            </View>
            <Sticker emoji="🐾" tint={Candy.pinkSoft} size={48} tilt={8} />
          </View>

          {!isSupported ? <UnsupportedNotice /> : null}

          {isSupported && !serviceEnabled ? (
            <Banner
              tone="bad"
              text="Counting is off — the accessibility service is not enabled."
              actionLabel="Fix"
              onAction={() => router.push('/onboarding')}
            />
          ) : null}

          {isSupported && serviceEnabled && !overlayGranted && settings?.overlayEnabled && !paused ? (
            <Banner
              text="Bubble needs “draw over apps”. Counting still works."
              actionLabel="Allow"
              onAction={Core.openOverlaySettings}
            />
          ) : null}

          <Stagger index={0}>
            <EllieHero
              mood={mood}
              total={total}
              limit={limit}
              streak={stats.streak}
              line={headline?.text ?? 'Keeping count.'}
              onPress={() => router.push('/ellie')}
            />
          </Stagger>

          <View style={styles.gap} />

          {settings ? (
            <Stagger index={1}>
              <TrackingModePicker
                settings={settings}
                update={update}
                overlayGranted={overlayGranted}
                onNeedOverlay={Core.openOverlaySettings}
              />
            </Stagger>
          ) : null}

          <Stagger index={2}>
            <View style={styles.tiles}>
              <StatTile emoji="⏱️" tint={Candy.skySoft} ink={Candy.sky} value={formatDuration(today?.feedMs ?? 0)} label="Watch time" />
              <StatTile emoji="⚡" tint={Candy.pinkSoft} ink={Candy.pink} value={perReel} label="Per reel" />
              <StatTile emoji="📢" tint={Candy.sunSoft} ink="#C98500" value={`${today?.adReels ?? 0}`} label="Ads seen" />
            </View>
          </Stagger>

          <Stagger index={3}>
            <AppBreakdown apps={today?.apps ?? []} />
          </Stagger>

          <View style={styles.footer}>
            <Text style={styles.footerText}>🔒 Stored on this phone only · no internet permission</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Up late 🌙';
  if (h < 12) return 'Good morning ☀️';
  if (h < 17) return 'Good afternoon 🌤️';
  if (h < 22) return 'Good evening 🌆';
  return 'Winding down 🌙';
}

function StatTile({
  emoji,
  tint,
  ink,
  value,
  label,
}: {
  emoji: string;
  tint: string;
  ink: string;
  value: string;
  label: string;
}) {
  return (
    <View style={[styles.tile, { backgroundColor: tint }]}>
      <View style={styles.tileIcon}>
        <Emoji char={emoji} size={22} />
      </View>
      <Text style={[styles.tileValue, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  // Clears the floating tab bar.
  content: { padding: Spacing.lg, paddingBottom: 120 },
  gap: { height: Spacing.lg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  headerText: { flex: 1 },
  hello: { ...Type.caption, color: Ink.muted },
  title: { ...Type.display, color: Ink.primary },

  tiles: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  tile: {
    flex: 1,
    borderRadius: Radius.card,
    padding: Spacing.md,
    alignItems: 'flex-start',
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    ...Lift,
    shadowOpacity: 0.08,
    elevation: 2,
  },
  tileValue: { ...Type.title, fontVariant: ['tabular-nums'] },
  tileLabel: { ...Type.tick, fontFamily: Font.bold, color: Ink.secondary },

  footer: {
    alignSelf: 'center',
    backgroundColor: Surface.raised,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
  },
  footerText: { ...Type.tick, color: Ink.muted },
});
