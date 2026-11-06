import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { linesFor, moodFor, pickLine, type EllieStats } from './ellie';

/**
 * The engine is a pure function, so every rule can be pinned down here with no
 * device and no React.
 *
 * The property that matters most is the negative one: a rule must stay silent when
 * its condition does not hold. Ellie telling a user something their numbers do not
 * say would be worse than Ellie saying nothing.
 */

function stats(over: Partial<EllieStats> = {}): EllieStats {
  return {
    total: 0,
    adReels: 0,
    feedMs: 0,
    dailyLimit: 0,
    week: [{ date: '2026-11-06', total: 0, feedMs: 0, adReels: 0 }],
    hours: [],
    apps: [],
    hourOfDay: 14,
    streak: 0,
    ...over,
  };
}

function ids(s: EllieStats): string[] {
  return linesFor(s).map((l) => l.id);
}

describe('mood', () => {
  it('is worried once the cap is passed', () => {
    assert.equal(moodFor(stats({ total: 50, dailyLimit: 40 })), 'worried');
  });

  it('is watchful on the approach to the cap', () => {
    assert.equal(moodFor(stats({ total: 30, dailyLimit: 40 })), 'watchful');
  });

  it('falls back to absolute thresholds when no cap is set', () => {
    assert.equal(moodFor(stats({ total: 90, dailyLimit: 0 })), 'worried');
    assert.equal(moodFor(stats({ total: 5, dailyLimit: 0 })), 'content');
  });

  it('is sleepy late at night', () => {
    assert.equal(moodFor(stats({ total: 3, hourOfDay: 1 })), 'sleepy');
  });

  it('is proud when today beats yesterday', () => {
    const s = stats({
      total: 5,
      week: [
        { date: '2026-11-05', total: 40, feedMs: 0, adReels: 0 },
        { date: '2026-11-06', total: 5, feedMs: 0, adReels: 0 },
      ],
    });
    assert.equal(moodFor(s), 'proud');
  });

  it('prefers worried over proud — the cap outranks the comparison', () => {
    const s = stats({
      total: 45,
      dailyLimit: 40,
      week: [
        { date: '2026-11-05', total: 90, feedMs: 0, adReels: 0 },
        { date: '2026-11-06', total: 45, feedMs: 0, adReels: 0 },
      ],
    });
    assert.equal(moodFor(s), 'worried');
  });
});

describe('rules stay silent without evidence', () => {
  it('says nothing about a limit when none is set', () => {
    const list = ids(stats({ total: 100 }));
    assert.ok(!list.includes('over-limit'));
    assert.ok(!list.includes('near-limit'));
  });

  it('says nothing about ads below a handful', () => {
    assert.ok(!ids(stats({ total: 30, adReels: 2 })).includes('ad-share'));
    assert.ok(ids(stats({ total: 30, adReels: 6 })).includes('ad-share'));
  });

  it('says nothing about a peak hour on thin data', () => {
    const thin = stats({ hours: [{ hour: 23, count: 4 }] });
    assert.ok(!ids(thin).includes('peak-hour'));
  });

  it('says nothing about a dominant app when usage is spread', () => {
    const spread = stats({
      total: 30,
      apps: [
        { appId: 'instagram', count: 11 },
        { appId: 'youtube', count: 10 },
        { appId: 'tiktok', count: 9 },
      ],
    });
    assert.ok(!ids(spread).includes('dominant-app'));
  });

  it('says nothing about a streak the user has not earned', () => {
    assert.ok(!ids(stats({ dailyLimit: 20, streak: 1 })).includes('streak'));
    assert.ok(ids(stats({ dailyLimit: 20, streak: 4 })).includes('streak'));
  });
});

describe('rules fire when the data supports them', () => {
  it('names the overshoot exactly', () => {
    const line = linesFor(stats({ total: 47, dailyLimit: 40 })).find((l) => l.id === 'over-limit');
    assert.ok(line);
    assert.match(line.text, /\b7\b/);
    assert.match(line.text, /\b40\b/);
  });

  it('calls out a dominant app by name', () => {
    const s = stats({
      total: 20,
      apps: [
        { appId: 'instagram', count: 18 },
        { appId: 'youtube', count: 2 },
      ],
    });
    const line = linesFor(s).find((l) => l.id === 'dominant-app');
    assert.ok(line);
    assert.match(line.text, /Instagram/);
  });

  it('reports a fast pace only when reels are actually short', () => {
    const fast = stats({ total: 40, feedMs: 40 * 4000 });
    const slow = stats({ total: 40, feedMs: 40 * 20000 });
    assert.ok(ids(fast).includes('fast-pace'));
    assert.ok(!ids(slow).includes('fast-pace'));
  });

  it('puts the most urgent line first', () => {
    const s = stats({ total: 60, dailyLimit: 40, adReels: 9, hourOfDay: 14 });
    assert.equal(linesFor(s)[0].id, 'over-limit');
  });
});

describe('picking', () => {
  it('does not repeat an excluded line', () => {
    const s = stats({ total: 60, dailyLimit: 40, adReels: 9 });
    const first = pickLine(s);
    assert.ok(first);
    const second = pickLine(s, { exclude: [first.id] });
    assert.ok(second);
    assert.notEqual(second.id, first.id);
  });

  it('honours a category', () => {
    const s = stats({ total: 60, dailyLimit: 40, adReels: 9 });
    assert.equal(pickLine(s, { category: 'ad' })?.category, 'ad');
    assert.equal(pickLine(s, { category: 'tip' })?.category, 'tip');
  });

  it('always has something to say', () => {
    assert.ok(pickLine(stats()));
  });
});
