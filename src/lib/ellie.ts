import type { Mood } from '@/constants/theme';
import { AppLabels } from '@/constants/theme';
import type { AppCount, DayTotal, HourBucket } from '../../modules/scrollwise-core/src';

/**
 * What Ellie says, and why.
 *
 * A pure function of the user's own numbers — no network, no model, no randomness
 * that cannot be seeded. That is a deliberate constraint, not a shortcut: the app
 * ships with no `INTERNET` permission, and a chatbot that phoned home would cost the
 * one claim this project actually makes.
 *
 * The rule is that **every line must be earned by the data**. A line is only
 * produced when its condition holds, so Ellie can never tell the user something
 * their numbers do not say. That is why each rule returns `null` rather than a
 * fallback string.
 */

export type EllieCategory =
  | 'greeting'
  | 'status'
  | 'observation'
  | 'tip'
  | 'encouragement'
  | 'ad';

export type EllieLine = {
  /** Stable, so "do not repeat yourself" can be enforced across renders. */
  id: string;
  text: string;
  category: EllieCategory;
  /** Higher wins when several lines fit. */
  priority: number;
};

export type EllieStats = {
  total: number;
  adReels: number;
  feedMs: number;
  /** 0 when the user has set no cap. */
  dailyLimit: number;
  /** Oldest first, today last. */
  week: DayTotal[];
  hours: HourBucket[];
  apps: AppCount[];
  /** 0-23, local. */
  hourOfDay: number;
  /** Consecutive days under the cap, today excluded. */
  streak: number;
};

// ---- Mood -------------------------------------------------------------------

/**
 * Her mood, from the same numbers. Deliberately not just "count high = bad": a
 * quiet evening after a heavy day should read as pleased, not neutral.
 */
export function moodFor(stats: EllieStats): Mood {
  const { total, dailyLimit, hourOfDay } = stats;
  const late = hourOfDay >= 23 || hourOfDay < 5;

  if (total === 0) return late ? 'sleepy' : 'content';
  if (dailyLimit > 0) {
    if (total >= dailyLimit) return 'worried';
    if (total >= dailyLimit * 0.7) return 'watchful';
  } else {
    if (total >= 80) return 'worried';
    if (total >= 40) return 'watchful';
  }
  if (late) return 'sleepy';
  if (betterThanYesterday(stats) || stats.streak >= 2) return 'proud';
  return 'content';
}

// ---- Lines ------------------------------------------------------------------

/**
 * Every line that currently applies, best first. The caller picks — usually the
 * top one, or the top one in a category.
 */
export function linesFor(stats: EllieStats): EllieLine[] {
  const rules: ((s: EllieStats) => EllieLine | null)[] = [
    overLimit,
    nearLimit,
    lateNight,
    nothingYet,
    streakLine,
    betterThanYesterdayLine,
    worseThanYesterdayLine,
    peakHour,
    dominantApp,
    adShare,
    paceLine,
    averageDwell,
    weekShape,
    greeting,
    tipNoLimit,
    tipGeneric,
  ];

  return rules
    .map((rule) => rule(stats))
    .filter((line): line is EllieLine => line !== null)
    .sort((a, b) => b.priority - a.priority);
}

/**
 * The single line to show, avoiding anything said recently.
 *
 * Falls back to the best line overall rather than going silent: repeating herself is
 * better than Ellie having nothing to say at all.
 */
export function pickLine(
  stats: EllieStats,
  options: { category?: EllieCategory; exclude?: string[] } = {}
): EllieLine | null {
  const { category, exclude = [] } = options;
  const all = linesFor(stats);
  const scoped = category ? all.filter((l) => l.category === category) : all;
  const pool = scoped.length > 0 ? scoped : all;
  return pool.find((l) => !exclude.includes(l.id)) ?? pool[0] ?? null;
}

// ---- The rules --------------------------------------------------------------

function overLimit(s: EllieStats): EllieLine | null {
  if (s.dailyLimit <= 0 || s.total < s.dailyLimit) return null;
  const over = s.total - s.dailyLimit;
  return {
    id: 'over-limit',
    category: 'status',
    priority: 100,
    text:
      over === 0
        ? `That is exactly your limit of ${s.dailyLimit}. Good moment to put it down.`
        : `You are ${over} past your limit of ${s.dailyLimit}. I am not going to pretend I did not notice.`,
  };
}

function nearLimit(s: EllieStats): EllieLine | null {
  if (s.dailyLimit <= 0 || s.total >= s.dailyLimit) return null;
  if (s.total < s.dailyLimit * 0.7) return null;
  return {
    id: 'near-limit',
    category: 'status',
    priority: 90,
    text: `${s.dailyLimit - s.total} left before you hit your limit. Still your call.`,
  };
}

function lateNight(s: EllieStats): EllieLine | null {
  if (s.hourOfDay < 23 && s.hourOfDay >= 5) return null;
  if (s.total === 0) {
    return {
      id: 'late-quiet',
      category: 'status',
      priority: 70,
      text: 'Late, and nothing counted yet. I approve.',
    };
  }
  return {
    id: 'late-busy',
    category: 'status',
    priority: 85,
    text: `${s.total} today, and it is past eleven. This is the part of the day that gets expensive.`,
  };
}

function nothingYet(s: EllieStats): EllieLine | null {
  if (s.total > 0) return null;
  return {
    id: 'nothing-yet',
    category: 'status',
    priority: 60,
    text: 'Nothing counted today. Either a good day, or an early one.',
  };
}

function streakLine(s: EllieStats): EllieLine | null {
  if (s.streak < 2 || s.dailyLimit <= 0) return null;
  return {
    id: 'streak',
    category: 'encouragement',
    priority: 75,
    text: `${s.streak} days in a row under your limit. That is a habit forming, not luck.`,
  };
}

function betterThanYesterdayLine(s: EllieStats): EllieLine | null {
  const y = yesterday(s);
  if (y === null || s.total >= y || y === 0) return null;
  return {
    id: 'better-yesterday',
    category: 'encouragement',
    priority: 65,
    text: `${y - s.total} fewer than yesterday, so far.`,
  };
}

function worseThanYesterdayLine(s: EllieStats): EllieLine | null {
  const y = yesterday(s);
  if (y === null || s.total <= y * 1.5 || s.total < 20) return null;
  return {
    id: 'worse-yesterday',
    category: 'observation',
    priority: 68,
    text: `Already ${s.total}, against ${y} for all of yesterday.`,
  };
}

function peakHour(s: EllieStats): EllieLine | null {
  const total = s.hours.reduce((sum, h) => sum + h.count, 0);
  if (total < 20) return null;
  const peak = s.hours.reduce((best, h) => (h.count > best.count ? h : best), s.hours[0]);
  if (!peak || peak.count / total < 0.25) return null;
  return {
    id: 'peak-hour',
    category: 'observation',
    priority: 50,
    text: `A quarter of your scrolling happens around ${formatHour(peak.hour)}. That is your weak spot.`,
  };
}

function dominantApp(s: EllieStats): EllieLine | null {
  const total = s.apps.reduce((sum, a) => sum + a.count, 0);
  if (total < 10 || s.apps.length === 0) return null;
  const top = s.apps.reduce((best, a) => (a.count > best.count ? a : best), s.apps[0]);
  const share = top.count / total;
  if (share < 0.6) return null;
  return {
    id: 'dominant-app',
    category: 'observation',
    priority: 45,
    text: `${Math.round(share * 100)}% of it is ${AppLabels[top.appId] ?? top.appId}. If you only change one thing, change that one.`,
  };
}

function adShare(s: EllieStats): EllieLine | null {
  if (s.adReels < 3) return null;
  const share = Math.round((s.adReels / s.total) * 100);
  return {
    id: 'ad-share',
    category: 'ad',
    priority: 40,
    text: `${s.adReels} of today's ${s.total} were ads — about ${share}%. You sat through those too.`,
  };
}

function paceLine(s: EllieStats): EllieLine | null {
  if (s.total < 15 || s.feedMs <= 0) return null;
  const seconds = Math.round(s.feedMs / s.total / 1000);
  if (seconds > 6) return null;
  return {
    id: 'fast-pace',
    category: 'observation',
    priority: 55,
    text: `About ${seconds} seconds each. At that speed you are not really watching them, you are just moving.`,
  };
}

function averageDwell(s: EllieStats): EllieLine | null {
  if (s.total < 10 || s.feedMs <= 0) return null;
  const minutes = Math.round(s.feedMs / 60000);
  if (minutes < 10) return null;
  return {
    id: 'watch-time',
    category: 'observation',
    priority: 48,
    text: `${minutes} minutes of short video today. That is the number I would look at, not the count.`,
  };
}

function weekShape(s: EllieStats): EllieLine | null {
  const past = s.week.slice(0, -1).filter((d) => d.total > 0);
  if (past.length < 3) return null;
  const average = Math.round(past.reduce((sum, d) => sum + d.total, 0) / past.length);
  if (average === 0) return null;
  const diff = s.total - average;
  if (Math.abs(diff) < Math.max(5, average * 0.25)) return null;
  return {
    id: 'vs-average',
    category: 'observation',
    priority: 42,
    text:
      diff > 0
        ? `Your usual day is about ${average}. Today is running ${diff} above that.`
        : `Your usual day is about ${average}. Today is ${Math.abs(diff)} under.`,
  };
}

function greeting(s: EllieStats): EllieLine | null {
  const h = s.hourOfDay;
  const when = h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
  return {
    id: `greeting-${when.toLowerCase()}`,
    category: 'greeting',
    priority: 10,
    text: `${when}. I am keeping count — ${s.total} so far.`,
  };
}

function tipNoLimit(s: EllieStats): EllieLine | null {
  if (s.dailyLimit > 0) return null;
  return {
    id: 'tip-set-limit',
    category: 'tip',
    priority: 30,
    text: 'You have not set a limit yet. A number you chose in advance is much easier to respect than one you argue with later.',
  };
}

function tipGeneric(s: EllieStats): EllieLine | null {
  const tips: { id: string; text: string }[] = [
    {
      id: 'tip-greyscale',
      text: 'Try greyscale on your phone for a day. The feeds are engineered in colour, and they lose a lot without it.',
    },
    {
      id: 'tip-home-screen',
      text: 'Move the app off your home screen. Most of my scrolling starts with a thumb that already knew where to go.',
    },
    {
      id: 'tip-session',
      text: 'A per-sitting limit tends to stick better than a daily one. It arrives while you are still in it.',
    },
    {
      id: 'tip-notice',
      text: 'Next time you open a feed, try to say out loud what you came for. It is a surprisingly hard question.',
    },
  ];
  // Rotates with the day rather than at random, so she does not flip tips every
  // time the screen re-renders.
  const index = dayIndex(s) % tips.length;
  const tip = tips[index];
  return { id: tip.id, text: tip.text, category: 'tip', priority: 25 };
}

// ---- Helpers ----------------------------------------------------------------

function yesterday(s: EllieStats): number | null {
  if (s.week.length < 2) return null;
  return s.week[s.week.length - 2].total;
}

function betterThanYesterday(s: EllieStats): boolean {
  const y = yesterday(s);
  return y !== null && y > 0 && s.total < y;
}

/** A stable per-day number, so day-rotating content does not jitter. */
function dayIndex(s: EllieStats): number {
  const today = s.week[s.week.length - 1]?.date;
  if (!today) return 0;
  return today.split('-').reduce((sum, part) => sum + Number(part), 0);
}

export function formatHour(hour: number): string {
  if (hour === 0) return 'midnight';
  if (hour === 12) return 'midday';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}
