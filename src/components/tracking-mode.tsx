import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { Pressable96, shade } from '@/components/ds-ui';
import { Emoji } from '@/components/emoji';
import { Candy, Font, Ink, Lift, Radius, Spacing, Surface, Type } from '@/constants/theme';
import { useNow } from '@/hooks/use-scrollwise';
import {
  PAUSED_INDEFINITELY,
  type Settings,
  type SettingsPatch,
} from '../../modules/scrollwise-core/src';

export type TrackingMode = 'bubble' | 'silent' | 'paused';

/**
 * Derived, not stored: "paused" is a pause timestamp in the future, "silent" is the
 * floating bubble switched off, "bubble" is everything on. One source of truth on
 * the native side, so the service and this screen can never disagree.
 */
export function trackingModeOf(settings: Settings, now = Date.now()): TrackingMode {
  if (settings.pausedUntil > now) return 'paused';
  return settings.overlayEnabled ? 'bubble' : 'silent';
}

const MODES: {
  value: TrackingMode;
  emoji: string;
  title: string;
  blurb: string;
  color: string;
  soft: string;
}[] = [
  {
    value: 'bubble',
    emoji: '🫧',
    title: 'Bubble',
    blurb: 'Count + floating counter',
    color: Candy.violet,
    soft: Candy.violetSoft,
  },
  {
    value: 'silent',
    emoji: '🤫',
    title: 'Silent',
    blurb: 'Count in background',
    color: Candy.mint,
    soft: Candy.mintSoft,
  },
  {
    value: 'paused',
    emoji: '😴',
    title: 'Pause',
    blurb: 'Stop counting',
    color: Candy.sun,
    soft: Candy.sunSoft,
  },
];

const PAUSES: { label: string; until: () => number }[] = [
  { label: '30 min', until: () => Date.now() + 30 * 60_000 },
  { label: '1 hour', until: () => Date.now() + 60 * 60_000 },
  {
    label: 'Till tomorrow',
    until: () => {
      const d = new Date();
      d.setHours(24, 0, 0, 0);
      return d.getTime();
    },
  },
  { label: 'Until I resume', until: () => PAUSED_INDEFINITELY },
];

/**
 * The "how should ScrollWise watch me right now" switch: three big tiles, plus a
 * duration picker when pausing. Lives on Today so it is one tap away, not buried in
 * Settings.
 */
export function TrackingModePicker({
  settings,
  update,
  overlayGranted,
  onNeedOverlay,
}: {
  settings: Settings;
  update: (patch: SettingsPatch) => void;
  overlayGranted: boolean;
  onNeedOverlay: () => void;
}) {
  const now = useNow();
  const mode = trackingModeOf(settings, now);
  const [choosingPause, setChoosingPause] = useState(false);

  const pick = (next: TrackingMode) => {
    Haptics.selectionAsync().catch(() => {});
    if (next === 'paused') {
      setChoosingPause((open) => !open);
      return;
    }
    setChoosingPause(false);
    if (next === 'bubble' && !overlayGranted) onNeedOverlay();
    update({ overlayEnabled: next === 'bubble', pausedUntil: 0 });
  };

  return (
    <Animated.View layout={LinearTransition.springify().damping(18)} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Tracking mode</Text>
        <Text style={styles.status}>{statusLine(mode, settings.pausedUntil, now)}</Text>
      </View>

      <View style={styles.tiles}>
        {MODES.map((m) => {
          const selected = mode === m.value;
          return (
            <Pressable96
              key={m.value}
              style={styles.tileWrap}
              accessibilityRole="radio"
              accessibilityLabel={`${m.title}: ${m.blurb}`}
              accessibilityState={{ selected }}
              onPress={() => pick(m.value)}>
              <View
                style={[
                  styles.tile,
                  { backgroundColor: selected ? m.color : m.soft },
                  selected && { borderBottomColor: shade(m.color), borderBottomWidth: 4 },
                ]}>
                <Emoji char={m.emoji} size={36} />
                <Text style={[styles.tileTitle, { color: selected ? '#FFFFFF' : Ink.primary }]}>
                  {m.title}
                </Text>
                <Text
                  style={[styles.tileBlurb, { color: selected ? 'rgba(255,255,255,0.9)' : Ink.muted }]}
                  numberOfLines={2}>
                  {m.blurb}
                </Text>
              </View>
            </Pressable96>
          );
        })}
      </View>

      {choosingPause || mode === 'paused' ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
          {mode === 'paused' && !choosingPause ? (
            <View style={styles.pausedRow}>
              <Text style={styles.pausedText}>
                Nothing is counted and the bubble stays away. Ellie is napping too.
              </Text>
              <Pressable96
                haptic
                onPress={() => update({ pausedUntil: 0 })}
                accessibilityLabel="Resume tracking">
                <View style={styles.resume}>
                  <Text style={styles.resumeText}>Resume</Text>
                </View>
              </Pressable96>
            </View>
          ) : (
            <>
              <Text style={styles.pauseHint}>Pause for how long?</Text>
              <View style={styles.chips}>
                {PAUSES.map((p) => (
                  <Pressable96
                    key={p.label}
                    haptic
                    onPress={() => {
                      setChoosingPause(false);
                      update({ pausedUntil: p.until() });
                    }}>
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>{p.label}</Text>
                    </View>
                  </Pressable96>
                ))}
              </View>
            </>
          )}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function statusLine(mode: TrackingMode, pausedUntil: number, now: number): string {
  if (mode === 'bubble') return 'Counting, bubble on';
  if (mode === 'silent') return 'Counting quietly';
  if (pausedUntil >= PAUSED_INDEFINITELY) return 'Paused until you resume';
  const until = new Date(pausedUntil);
  const sameDay = until.toDateString() === new Date(now).toDateString();
  const time = until.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return sameDay ? `Paused until ${time}` : `Paused until tomorrow`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Surface.card,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Lift,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  title: { ...Type.heading, color: Ink.primary },
  status: { ...Type.caption, color: Ink.muted },

  tiles: { flexDirection: 'row', gap: Spacing.sm },
  tileWrap: { flex: 1 },
  tile: {
    borderRadius: Radius.control + 4,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    minHeight: 112,
    borderBottomWidth: 4,
    borderBottomColor: 'transparent',
  },
  tileTitle: { ...Type.label, fontSize: 15, marginTop: Spacing.xs },
  tileBlurb: { ...Type.tick, textAlign: 'center', marginTop: 2 },

  pauseHint: { ...Type.caption, color: Ink.muted, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    backgroundColor: Candy.sunSoft,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipText: { ...Type.label, color: '#9A6400' },

  pausedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    backgroundColor: Candy.sunSoft,
    borderRadius: Radius.control,
    padding: Spacing.md,
  },
  pausedText: { ...Type.caption, color: Ink.secondary, flex: 1 },
  resume: {
    backgroundColor: Candy.sun,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: shade(Candy.sun),
  },
  resumeText: { ...Type.label, color: '#FFFFFF', fontFamily: Font.bold },
});
