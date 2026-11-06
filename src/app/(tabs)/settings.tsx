import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet } from 'react-native';

import { Body, Button, Panel, Row, Screen, SectionTitle } from '@/components/ds-ui';
import { Spacing } from '@/constants/theme';
import { usePermissions, useSettings, useToday } from '@/hooks/use-scrollwise';
import * as Core from '../../../modules/scrollwise-core/src';

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, update } = useSettings();
  const { serviceEnabled, overlayGranted, refresh } = usePermissions();
  const { reload } = useToday();
  const [exporting, setExporting] = useState(false);

  if (!settings) return <Screen />;

  const targetApps = Core.getTargetApps();
  const experimental = targetApps.filter((app) => app.experimental);

  const exportData = async () => {
    setExporting(true);
    try {
      const bundle = await Core.exportAll();
      // Shared through the system sheet so the user picks the destination. The app
      // never writes anywhere on its own and has no network to send it over.
      await Share.share({
        title: 'ScrollWise export',
        message: JSON.stringify(bundle, null, 2),
      });
    } finally {
      setExporting(false);
    }
  };

  const confirmReset = () => {
    Alert.alert(
      "Reset today's count?",
      'Today\'s totals and the per-reel detail for today are deleted. Earlier days are untouched. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await Core.resetToday();
            reload();
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Panel>
          <SectionTitle>Permissions</SectionTitle>
          <Row
            title="Counting service"
            subtitle={
              serviceEnabled
                ? 'Enabled. Turn it off here to stop counting entirely.'
                : 'Not enabled — nothing is being counted.'
            }
            onPress={Core.openAccessibilitySettings}
            badge={serviceEnabled ? 'ON' : 'OFF'}
            badgeTone={serviceEnabled ? 'good' : 'bad'}
          />
          <Row
            title="Draw over other apps"
            subtitle={
              overlayGranted
                ? 'Granted. The floating counter can appear.'
                : 'Not granted. Counting works, but you will not see the floating counter.'
            }
            onPress={Core.openOverlaySettings}
            badge={overlayGranted ? 'ON' : 'OFF'}
            badgeTone={overlayGranted ? 'good' : 'neutral'}
          />
          <Button label="Re-check permissions" variant="quiet" onPress={refresh} />
        </Panel>

        <Panel>
          <SectionTitle>Floating counter</SectionTitle>
          <Row
            title="Show while scrolling"
            subtitle="A small pill over the feed. Drag it anywhere; the position is remembered."
            value={settings.overlayEnabled}
            onToggle={(overlayEnabled) => update({ overlayEnabled })}
          />
        </Panel>

        <Panel>
          <SectionTitle>Brain state thresholds</SectionTitle>
          <Body muted>
            Healthy up to {settings.healthyMax}, fatigued up to {settings.fatiguedMax},
            fried above that. These are your numbers, not a diagnosis — move them until
            they mean something to you.
          </Body>
        </Panel>

        {experimental.length > 0 ? (
          <Panel>
            <SectionTitle>Detection accuracy</SectionTitle>
            <Body muted>
              {experimental.length === targetApps.length
                ? 'None of the app profiles have been verified against a real device yet.'
                : `${experimental.map((a) => a.label).join(', ')} are unverified.`}{' '}
              Unverified profiles are tuned from guesswork, so they tend to under-count
              rather than over-count. Run the calibration to find out how far off yours
              is.
            </Body>
            <Button
              label="Calibrate"
              variant="secondary"
              onPress={() => router.push('/calibration')}
            />
          </Panel>
        ) : null}

        <Panel>
          <SectionTitle>Your data</SectionTitle>
          <Body muted>
            Everything lives in one database on this phone. Export gives you the whole
            thing as JSON through the share sheet, so you choose where it goes.
          </Body>
          <Button
            label={exporting ? 'Preparing…' : 'Export everything'}
            variant="secondary"
            disabled={exporting}
            onPress={exportData}
          />
          <Button label="Reset today" variant="quiet" onPress={confirmReset} />
        </Panel>

        <Panel>
          <SectionTitle>Debug logging</SectionTitle>
          <Row
            title="Log raw scroll events"
            subtitle="Writes accessibility event detail to logcat so a detection profile can be re-tuned. Off by default; it is noisy and costs battery."
            value={settings.debugLogging}
            onToggle={(debugLogging) => update({ debugLogging })}
          />
        </Panel>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
});
