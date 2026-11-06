import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Body, Button, Panel, Screen, SectionTitle, StatusPill } from '@/components/ds-ui';
import { EllieFace } from '@/components/ellie';
import { Ink, Motion, Radius, Spacing, Surface, Type, type Mood } from '@/constants/theme';
import { usePermissions, useSettings } from '@/hooks/use-scrollwise';
import * as Core from '../../modules/scrollwise-core/src';

/**
 * Three steps, in Ellie's voice: what she does, the permission she needs, and the
 * optional one.
 *
 * The accessibility step has to earn the permission rather than just ask for it.
 * Android shows a blunt warning about full screen access, and a user who taps
 * through without understanding it will revoke it the moment they think about it —
 * so this screen says exactly what is read, what is stored, and what leaves the
 * phone, which is nothing. Ellie delivers it, but the disclosure itself is as
 * careful as it was before she existed.
 */
export default function Onboarding() {
  const router = useRouter();
  const { serviceEnabled, overlayGranted, refresh } = usePermissions();
  const { update } = useSettings();
  const [step, setStep] = useState(0);

  const finish = async () => {
    await update({ onboardingComplete: true });
    router.replace('/');
  };

  const mood: Mood = step === 1 && !serviceEnabled ? 'watchful' : 'content';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.progress}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.ellieRow}>
          <EllieFace mood={mood} size={96} />
          <View style={styles.introText}>
            <Text style={styles.name}>Ellie</Text>
            <Text style={styles.role}>Your counter</Text>
          </View>
        </View>

        <Animated.View key={step} entering={FadeIn.duration(Motion.base)}>
          {step === 0 ? (
            <>
              <Text style={styles.heading}>I count the reels.</Text>
              <Body>
                Every short video you swipe past in Instagram, YouTube, TikTok, Facebook
                or Snapchat adds one to a number. I keep that number on top of the app
                while you scroll, and on your home screen when you are not.
              </Body>
              <Panel>
                <SectionTitle>What I will not do</SectionTitle>
                <Body muted>
                  No account. No sign-up. No servers. ScrollWise ships without
                  Android&apos;s internet permission, so it is not able to send your data
                  anywhere even if it wanted to — including to me. Everything I say
                  comes from counts stored on this phone.
                </Body>
              </Panel>
              <Button label="Next" onPress={() => setStep(1)} />
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Text style={styles.heading}>I need one strong permission.</Text>
              <Body>
                Android only exposes scroll events through an accessibility service, so
                that is what I use. On the next screen you will find ScrollWise in the
                list and switch it on.
              </Body>

              <Panel>
                <SectionTitle>Android will warn you. Here is the honest version.</SectionTitle>
                <Body muted>
                  The permission is broad: it lets an app read screen content. This one
                  is scoped to those five apps in its service configuration and reads two
                  things there: the layout, to tell a reel feed from the rest of the app,
                  and the labels on the reel showing — username, caption — so the same
                  reel is not counted twice.
                </Body>
                <View style={styles.spacer} />
                <Body muted>
                  Those labels are turned into an anonymous code the moment they are read
                  and are never stored, logged or sent. What is stored is a daily count, a
                  per-app count, and how long each reel was on screen — on this phone
                  only.
                </Body>
              </Panel>

              <Panel>
                <View style={styles.statusRow}>
                  <SectionTitle>{serviceEnabled ? 'Counting is on' : 'Not enabled yet'}</SectionTitle>
                  <StatusPill
                    label={serviceEnabled ? 'ON' : 'OFF'}
                    tone={serviceEnabled ? 'good' : 'bad'}
                  />
                </View>
                <Body muted>
                  {serviceEnabled
                    ? 'You can turn it off any time in Android settings, and I will tell you it is off rather than pretending otherwise.'
                    : 'Tap below, find ScrollWise under Installed apps or Downloaded services, and switch it on. Then come back.'}
                </Body>
                {!serviceEnabled ? (
                  <Button
                    label="Open accessibility settings"
                    onPress={Core.openAccessibilitySettings}
                  />
                ) : null}
                <Button label="Re-check" variant="quiet" onPress={refresh} />
              </Panel>

              <Button label="Next" onPress={() => setStep(2)} />
              <Button label="Back" variant="quiet" onPress={() => setStep(0)} />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={styles.heading}>Let me show the count as you scroll.</Text>
              <Body>
                The floating counter needs permission to draw over other apps. It is a
                small pill you can drag anywhere — and drop on the ✕ to hide it for a
                while. It is the whole point: a number you cannot help seeing is what
                breaks the trance.
              </Body>

              <Panel>
                <View style={styles.statusRow}>
                  <SectionTitle>
                    {overlayGranted ? 'Granted' : 'Optional, but recommended'}
                  </SectionTitle>
                  <StatusPill
                    label={overlayGranted ? 'ON' : 'OFF'}
                    tone={overlayGranted ? 'good' : 'neutral'}
                  />
                </View>
                <Body muted>
                  {overlayGranted
                    ? 'The floating counter will appear when you open one of the five apps.'
                    : 'Skip it and counting still works — you will just have to open ScrollWise to see the number.'}
                </Body>
                {!overlayGranted ? (
                  <Button label="Allow drawing over apps" onPress={Core.openOverlaySettings} />
                ) : null}
                <Button label="Re-check" variant="quiet" onPress={refresh} />
              </Panel>

              <Button
                label={serviceEnabled ? 'Start counting' : 'Finish anyway'}
                onPress={finish}
              />
              <Button label="Back" variant="quiet" onPress={() => setStep(1)} />
            </>
          ) : null}
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  progress: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  dot: { height: 3, flex: 1, borderRadius: 2, backgroundColor: Surface.gridline },
  dotActive: { backgroundColor: Ink.secondary },

  ellieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    backgroundColor: Surface.card,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    padding: Spacing.md,
  },
  introText: { flex: 1 },
  name: { ...Type.title, color: Ink.primary },
  role: { ...Type.caption, color: Ink.muted, marginTop: 2 },

  heading: { ...Type.display, color: Ink.primary, marginBottom: Spacing.md },
  spacer: { height: Spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
