import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Panel, Screen, SectionTitle } from '@/components/ds-ui';
import { Ink, Spacing, Surface } from '@/constants/doomscroll-theme';
import { usePermissions, useSettings } from '@/hooks/use-doomscroll';
import * as Core from '../../modules/doomscroll-core/src';

/**
 * Three steps: what it does, the accessibility grant, the overlay grant.
 *
 * The accessibility step has to earn the permission rather than just ask for it.
 * Android shows a blunt warning about full screen access, and a user who taps
 * through without understanding it will revoke it the moment they think about it —
 * so this screen says exactly what is read, what is stored, and what leaves the
 * phone, which is nothing.
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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.progress}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
          ))}
        </View>

        {step === 0 ? (
          <>
            <Text style={styles.heading}>It counts the reels.</Text>
            <Body>
              Every short video you swipe past in Instagram, YouTube, TikTok, Facebook
              or Snapchat adds one to a number. That number sits on top of the app
              while you scroll, and on your home screen when you are not.
            </Body>
            <Panel>
              <SectionTitle>What it does not do</SectionTitle>
              <Body muted>
                No account. No sign-up. No servers. The app ships without
                Android&apos;s internet permission, so it is not able to send your data
                anywhere even if it wanted to.
              </Body>
            </Panel>
            <Button label="Next" onPress={() => setStep(1)} />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.heading}>It needs one strong permission.</Text>
            <Body>
              Android only exposes scroll events through an accessibility service, so
              that is what this app uses. On the next screen you will find
              MrDoomScroller in the list and switch it on.
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
              <SectionTitle>
                {serviceEnabled ? 'Counting is on' : 'Not enabled yet'}
              </SectionTitle>
              <Body muted>
                {serviceEnabled
                  ? 'The service is running. You can turn it off any time in Android settings, and the app will tell you it is off rather than pretending otherwise.'
                  : 'Tap below, find MrDoomScroller under Installed apps or Downloaded services, and switch it on. Then come back here.'}
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
            <Text style={styles.heading}>Show the count while you scroll.</Text>
            <Body>
              The floating counter needs permission to draw over other apps. It is a
              small pill you can drag anywhere, and it is the whole point — a number
              you cannot help seeing is what breaks the trance.
            </Body>

            <Panel>
              <SectionTitle>
                {overlayGranted ? 'Granted' : 'Optional, but recommended'}
              </SectionTitle>
              <Body muted>
                {overlayGranted
                  ? 'The floating counter will appear when you open one of the five apps.'
                  : 'Skip it and counting still works — you will just have to open this app to see the number.'}
              </Body>
              {!overlayGranted ? (
                <Button label="Allow drawing over apps" onPress={Core.openOverlaySettings} />
              ) : null}
              <Button label="Re-check" variant="quiet" onPress={refresh} />
            </Panel>

            <Button label={serviceEnabled ? 'Start counting' : 'Finish anyway'} onPress={finish} />
            <Button label="Back" variant="quiet" onPress={() => setStep(1)} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  progress: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  dot: {
    height: 3,
    flex: 1,
    borderRadius: 2,
    backgroundColor: Surface.gridline,
  },
  dotActive: { backgroundColor: Ink.secondary },
  heading: {
    color: Ink.primary,
    fontSize: 26,
    fontWeight: '600',
    lineHeight: 32,
    marginBottom: Spacing.md,
  },
  spacer: { height: Spacing.md },
});
