import { useCallback, useMemo, useRef, useState } from 'react';

import type { Mood } from '@/constants/theme';
import {
  linesFor,
  moodFor,
  pickLine,
  type EllieCategory,
  type EllieLine,
  type EllieStats,
} from '@/lib/ellie';
import { useInsights, useSettings, useToday, useWeek } from './use-scrollwise';

/**
 * Assembles everything Ellie reasons about from the hooks that already exist, and
 * keeps a short memory so she does not say the same thing twice in a row.
 */
export function useEllie() {
  const { today } = useToday();
  const { settings } = useSettings();
  const week = useWeek();
  const insights = useInsights(30);
  const spoken = useRef<string[]>([]);
  const [asked, setAsked] = useState<EllieLine | null>(null);

  const stats: EllieStats = useMemo(
    () => ({
      total: today?.total ?? 0,
      adReels: today?.adReels ?? 0,
      feedMs: today?.feedMs ?? 0,
      dailyLimit: settings?.dailyLimit ?? 0,
      week: week.days,
      hours: insights.hours,
      apps: today?.apps ?? [],
      hourOfDay: new Date().getHours(),
      streak: streakUnderLimit(week.days, settings?.dailyLimit ?? 0),
    }),
    [today, settings, week.days, insights.hours]
  );

  const mood: Mood = useMemo(() => moodFor(stats), [stats]);

  // The headline line is not part of the "recently said" memory: it is meant to be
  // the most relevant thing right now, and suppressing it because she said it a
  // minute ago would make the dashboard go vague exactly when it should be blunt.
  const headline = useMemo(() => pickLine(stats), [stats]);

  const ask = useCallback(
    (category?: EllieCategory) => {
      const line = pickLine(stats, { category, exclude: spoken.current });
      if (line) {
        spoken.current = [line.id, ...spoken.current].slice(0, 6);
        setAsked(line);
      }
      return line;
    },
    [stats]
  );

  return {
    stats,
    mood,
    headline,
    asked,
    ask,
    /** Everything she could currently say — the Ellie sheet lists these. */
    available: useMemo(() => linesFor(stats), [stats]),
    ready: today !== null && settings !== null,
  };
}

/**
 * Consecutive days under the cap, counting back from yesterday.
 *
 * Today is excluded on purpose: a streak you could still lose before bedtime is not
 * something to congratulate someone for.
 */
export function streakUnderLimit(
  week: { date: string; total: number }[],
  dailyLimit: number
): number {
  if (dailyLimit <= 0) return 0;
  let streak = 0;
  for (let i = week.length - 2; i >= 0; i--) {
    if (week[i].total > 0 && week[i].total < dailyLimit) streak++;
    else break;
  }
  return streak;
}
