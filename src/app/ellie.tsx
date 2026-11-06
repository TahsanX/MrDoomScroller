import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Pressable96, Screen } from '@/components/ds-ui';
import { EllieFace } from '@/components/ellie';
import { Ink, MoodPalette, Motion, Radius, Spacing, Surface, Type } from '@/constants/theme';
import { useEllie } from '@/hooks/use-ellie';
import type { EllieCategory } from '@/lib/ellie';

/**
 * Asking Ellie something.
 *
 * Deliberately a set of taps rather than a text box. There is no model behind her —
 * the app has no network at all — so a free-text field would be a promise the thing
 * cannot keep. Chips say plainly what she can actually answer, and every answer is
 * derived from the user's own numbers.
 */

const PROMPTS: { label: string; category?: EllieCategory }[] = [
  { label: 'How am I doing?', category: 'status' },
  { label: 'Notice anything?', category: 'observation' },
  { label: 'Any tips?', category: 'tip' },
  { label: 'What about ads?', category: 'ad' },
  { label: 'Say something nice', category: 'encouragement' },
  { label: 'Anything at all', category: undefined },
];

type Turn = { id: string; from: 'you' | 'ellie'; text: string };

export default function EllieSheet() {
  const { mood, headline, ask, ready } = useEllie();
  const [turns, setTurns] = useState<Turn[]>([]);
  // ComponentRef rather than the component type: in this RN version ScrollView's
  // element type and its imperative handle are not the same thing.
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const seeded = useRef(false);

  // She opens with whatever is most relevant right now, so the sheet is never empty.
  useEffect(() => {
    if (seeded.current || !ready || !headline) return;
    seeded.current = true;
    setTurns([{ id: `open-${headline.id}`, from: 'ellie', text: headline.text }]);
  }, [ready, headline]);

  const onAsk = (prompt: (typeof PROMPTS)[number]) => {
    const line = ask(prompt.category);
    setTurns((current) => [
      ...current,
      { id: `you-${current.length}`, from: 'you', text: prompt.label },
      {
        id: `ellie-${current.length}-${line?.id ?? 'none'}`,
        from: 'ellie',
        text: line?.text ?? 'Not enough counted yet for me to say anything useful.',
      },
    ]);
  };

  const palette = MoodPalette[mood];

  return (
    <Screen>
      <ScrollView
        ref={scroller}
        contentContainerStyle={styles.content}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <EllieFace mood={mood} size={110} />
          <View style={styles.headerText}>
            <Text style={styles.name}>Ellie</Text>
            <View style={styles.moodRow}>
              <View style={[styles.moodDot, { backgroundColor: palette.accent }]} />
              <Text style={styles.moodLabel}>{palette.label}</Text>
            </View>
          </View>
        </View>

        {turns.map((turn, i) => (
          <Animated.View
            key={turn.id}
            entering={FadeInUp.duration(Motion.base)}
            style={[styles.turn, turn.from === 'you' ? styles.turnYou : styles.turnEllie]}>
            <Text style={turn.from === 'you' ? styles.textYou : styles.textEllie}>
              {turn.text}
            </Text>
          </Animated.View>
        ))}

        <Text style={styles.promptHint}>Ask her</Text>
        <View style={styles.chips}>
          {PROMPTS.map((prompt) => (
            <Pressable96 key={prompt.label} onPress={() => onAsk(prompt)} haptic>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{prompt.label}</Text>
              </View>
            </Pressable96>
          ))}
        </View>

        <Text style={styles.disclaimer}>
          Ellie works entirely on this phone. She has no internet and no AI behind her —
          everything she says is read straight off your own counts.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  headerText: { flex: 1 },
  name: { ...Type.title, color: Ink.primary },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  moodDot: { width: 7, height: 7, borderRadius: 4 },
  moodLabel: { ...Type.caption, color: Ink.muted },

  turn: {
    borderRadius: Radius.card,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    maxWidth: '88%',
  },
  turnEllie: {
    alignSelf: 'flex-start',
    backgroundColor: Surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderTopLeftRadius: Spacing.xs,
  },
  turnYou: {
    alignSelf: 'flex-end',
    backgroundColor: Surface.raised,
    borderTopRightRadius: Spacing.xs,
  },
  textEllie: { ...Type.speech, color: Ink.primary },
  textYou: { ...Type.body, color: Ink.secondary },

  promptHint: { ...Type.caption, color: Ink.muted, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    backgroundColor: Surface.raised,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
  },
  chipText: { ...Type.label, color: Ink.secondary },

  disclaimer: {
    ...Type.tick,
    color: Ink.muted,
    marginTop: Spacing.xl,
    lineHeight: 17,
  },
});
