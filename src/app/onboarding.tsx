import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Panel, Screen, SectionTitle, StatusPill } from '@/components/ds-ui';
import { EllieFace } from '@/components/ellie';
import { Emoji } from '@/components/emoji';
import { Candy, Ink, Radius, Spacing, Surface, Type, type Mood } from '@/constants/theme';
import { usePermissions, useSettings } from '@/hooks/use-scrollwise';
import * as Core from '../../modules/scrollwise-core/src';

/**
 * Three steps, in Ellie's voice: what she does, the permission she needs, and the
 * optional one. Big friendly illustration up top, the one action down in the thumb
 * zone.
 *
 * The accessibility step has to earn the permission rather than just ask for it.
 * Android shows a blunt warning about full screen access, and a user who taps
 * through without understanding it will revoke it the moment they think about it —
 * so this screen says exactly what is read, what is stored, and what leaves the
 * phone, which is nothing.
 */

const STEPS = [
  { blob: Candy.violetSoft, accent: Candy.violet, props: ['🎯', '⚡', '🔥'] },
  { blob: Candy.mintSoft, accent: Candy.mint, props: ['🔒', '👀', '🛡️'] },
  { blob: Candy.pinkSoft, accent: Candy.pink, props: ['🫧', '🤫', '🚀'] },
] as const;

export default function Onboarding() {
  const router = useRouter();
  const { serviceEnabled, overlayGranted, refresh } = usePermissions();
  const { update } = useSettings();
  const [step, setStep] = useState(0);

  const finish = async () => {
    await update({ onboardingComplete: true });
    router.replace('/');
  };

  const mood: Mood =
    step === 1 && !serviceEnabled ? 'watchful' : step === 1 || (step === 2 && overlayGranted) ? 'proud' : 'content';
  const look = STEPS[step];

  return (
    <Screen>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View key={`art-${step}`} entering={FadeInDown.springify().damping(14)}>
            <Illustration mood={mood} blob={look.blob} props={look.props} />
          </Animated.View>

          <Animated.View key={step} entering={FadeInRight.springify().damping(18)}>
            {step === 0 ? (
              <>
                <Text style={styles.heading}>Hi, I&apos;m Ellie.{'\n'}I count the reels.</Text>
                <Text style={styles.lede}>
                  Every short video you swipe past in Instagram, YouTube, TikTok, Facebook
                  or Snapchat adds one. I float the number over the feed, so you actually
                  see it.
                </Text>
                <Panel tint={Candy.violetSoft}>
                  <SectionTitle>🙅 What I will not do</SectionTitle>
                  <Body muted>
                    No account. No servers. ScrollWise ships without Android&apos;s
                    internet permission, so it cannot send your data anywhere — not even
                    to me.
                  </Body>
                </Panel>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <Text style={styles.heading}>One strong permission.</Text>
                <Text style={styles.lede}>
                  Android only exposes scrolling through an accessibility service. On the
                  next screen, find ScrollWise and switch it on.
                </Text>

                <Panel>
                  <SectionTitle>🛡️ Android will warn you. Here is the honest version.</SectionTitle>
                  <Body muted>
                    It lets an app read screen content. Mine is scoped to those five apps
                    and reads two things there: the layout, to tell a reel feed from the
                    rest, and the labels on the reel showing — so the same reel is not
                    counted twice.
                  </Body>
                  <View style={styles.spacer} />
                  <Body muted>
                    Those labels become an anonymous code the moment they are read and
                    are never stored, logged or sent. Only counts and timings are kept,
                    on this phone.
                  </Body>
                </Panel>

                <StatusCard
                  on={serviceEnabled}
                  onTitle="Counting is on 🎉"
                  offTitle="Not enabled yet"
                  onBody="You can turn it off any time in Android settings, and I will tell you it is off."
                  offBody="Tap below, find ScrollWise under Installed apps or Downloaded services, and switch it on. Then come back."
                />
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Text style={styles.heading}>Let me float the count.</Text>
                <Text style={styles.lede}>
                  A little bubble over the feed. Drag it anywhere — it snaps to the edge.
                  Tap it to pause, or drop it on the ✕ to hide it. Prefer no bubble? Pick
                  Silent mode later and I will count quietly.
                </Text>

                <StatusCard
                  on={overlayGranted}
                  onTitle="Bubble ready 🫧"
                  offTitle="Optional, but recommended"
                  onBody="The bubble will pop up when you open one of the five apps."
                  offBody="Skip it and counting still works — you will just have to open ScrollWise to see the number."
                />
              </>
            ) : null}
          </Animated.View>
        </ScrollView>

        {/* Thumb zone: progress dots and the one action that matters on this step. */}
        <View style={styles.footer}>
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[styles.dot, i === step && [styles.dotActive, { backgroundColor: look.accent }]]}
              />
            ))}
          </View>

          {step === 0 ? <Button label="Let's go  →" color={look.accent} onPress={() => setStep(1)} /> : null}

          {step === 1 ? (
            serviceEnabled ? (
              <Button label="Next  →" color={look.accent} onPress={() => setStep(2)} />
            ) : (
              <>
                <Button label="Open accessibility settings" color={look.accent} onPress={Core.openAccessibilitySettings} />
                <View style={styles.footerRow}>
                  <Button label="Back" variant="quiet" onPress={() => setStep(0)} />
                  <Button label="Re-check" variant="quiet" onPress={refresh} />
                  <Button label="Skip" variant="quiet" onPress={() => setStep(2)} />
                </View>
              </>
            )
          ) : null}

          {step === 2 ? (
            <>
              {overlayGranted ? null : (
                <Button label="Allow the bubble" color={look.accent} onPress={Core.openOverlaySettings} />
              )}
              <Button
                label={serviceEnabled ? 'Start counting 🚀' : 'Finish anyway'}
                variant={overlayGranted ? 'primary' : 'secondary'}
                color={overlayGranted ? look.accent : Candy.violet}
                onPress={finish}
              />
              <Button label="Back" variant="quiet" onPress={() => setStep(1)} />
            </>
          ) : null}
        </View>
      </SafeAreaView>
    </Screen>
  );
}

/** Ellie on a soft blob, with three emoji props floating around her. */
function Illustration({ mood, blob, props }: { mood: Mood; blob: string; props: readonly string[] }) {
  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [float]);
  const up = useAnimatedStyle(() => ({ transform: [{ translateY: -8 * float.value }] }));
  const down = useAnimatedStyle(() => ({ transform: [{ translateY: 8 * float.value }] }));

  return (
    <View style={styles.art}>
      <View style={[styles.blob, { backgroundColor: blob }]} />
      <Animated.View style={[styles.prop, styles.propA, up]}>
        <Emoji char={props[0]} size={40} />
      </Animated.View>
      <Animated.View style={[styles.prop, styles.propB, down]}>
        <Emoji char={props[1]} size={40} />
      </Animated.View>
      <Animated.View style={[styles.prop, styles.propC, up]}>
        <Emoji char={props[2]} size={40} />
      </Animated.View>
      <Animated.View style={down}>
        <EllieFace mood={mood} size={180} />
      </Animated.View>
    </View>
  );
}

function StatusCard({
  on,
  onTitle,
  offTitle,
  onBody,
  offBody,
}: {
  on: boolean;
  onTitle: string;
  offTitle: string;
  onBody: string;
  offBody: string;
}) {
  return (
    <Panel tint={on ? Candy.mintSoft : Surface.card}>
      <View style={styles.statusRow}>
        <Text style={styles.statusTitle}>{on ? onTitle : offTitle}</Text>
        <StatusPill label={on ? 'ON' : 'OFF'} tone={on ? 'good' : 'neutral'} />
      </View>
      <Body muted>{on ? onBody : offBody}</Body>
    </Panel>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.xl, paddingBottom: Spacing.lg },

  art: { height: 240, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  blob: {
    position: 'absolute',
    width: 220,
    height: 200,
    borderRadius: 110,
    transform: [{ rotate: '-12deg' }],
  },
  prop: { position: 'absolute' },
  propA: { top: 18, left: '14%' },
  propB: { top: 40, right: '12%' },
  propC: { bottom: 20, left: '20%' },

  heading: { ...Type.display, color: Ink.primary, textAlign: 'center', marginBottom: Spacing.md },
  lede: {
    ...Type.body,
    color: Ink.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  spacer: { height: Spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  statusTitle: { ...Type.heading, color: Ink.primary, flex: 1 },

  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
    backgroundColor: Surface.page,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  dot: { width: 8, height: 8, borderRadius: Radius.pill, backgroundColor: Surface.axis },
  dotActive: { width: 28 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
