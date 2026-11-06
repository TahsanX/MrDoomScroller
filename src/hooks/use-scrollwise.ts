import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import * as Core from '../../modules/scrollwise-core/src';
import type {
  Insights,
  RangeResult,
  Settings,
  Today,
} from '../../modules/scrollwise-core/src';

/**
 * Both permissions, re-checked whenever the app comes back to the foreground.
 *
 * Polling on resume is the only way to know: Android has no callback for an
 * accessibility grant, and the user grants it by leaving for system settings and
 * coming back, which is exactly an AppState transition.
 */
export function usePermissions() {
  const [serviceEnabled, setServiceEnabled] = useState(() => Core.isServiceEnabled());
  const [overlayGranted, setOverlayGranted] = useState(() => Core.hasOverlayPermission());

  const refresh = useCallback(() => {
    setServiceEnabled(Core.isServiceEnabled());
    setOverlayGranted(Core.hasOverlayPermission());
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return { serviceEnabled, overlayGranted, refresh, isSupported: Core.isSupported };
}

/**
 * Today's counts, kept live.
 *
 * Seeded from the database, then nudged by the native `onReelCounted` event rather
 * than re-queried, so the number on screen tracks the user's thumb. The event
 * carries the authoritative running total, so there is no drift to reconcile.
 */
export function useToday() {
  const [today, setToday] = useState<Today | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const next = await Core.getToday();
    setToday(next);
    setLoading(false);
  }, []);

  // Initial load. Guarded rather than calling reload() directly, so a screen the
  // user leaves before the query lands does not set state on an unmounted hook.
  useEffect(() => {
    let cancelled = false;
    Core.getToday().then((next) => {
      if (cancelled) return;
      setToday(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const subscription = Core.addListener('onReelCounted', (event) => {
      setToday((current) => {
        if (!current) return current;
        const apps = [...current.apps];
        const index = apps.findIndex((a) => a.appId === event.appId);
        if (index >= 0) {
          apps[index] = { ...apps[index], count: apps[index].count + 1 };
        } else {
          apps.push({ appId: event.appId, count: 1 });
        }
        apps.sort((a, b) => b.count - a.count);
        return {
          ...current,
          total: event.total,
          feedMs: current.feedMs + event.dwellMs,
          adReels: current.adReels + (event.isAd ? 1 : 0),
          apps,
        };
      });
    });
    return () => subscription.remove();
  }, []);

  // The brain state threshold may be crossed by a live event, and recomputing it
  // here would duplicate the native thresholds. A reload on resume keeps the two in
  // step without a second source of truth.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload();
    });
    return () => subscription.remove();
  }, [reload]);

  return { today, loading, reload };
}

export function useWeek() {
  const [range, setRange] = useState<RangeResult>({ days: [], apps: [] });

  useEffect(() => {
    const to = isoDaysAgo(0);
    const from = isoDaysAgo(6);
    Core.getRange(from, to).then((result) => {
      // The database only holds days that had activity; the chart needs all seven,
      // zeros included, or a quiet week renders as a misleadingly dense one.
      const byDate = new Map(result.days.map((d) => [d.date, d]));
      const days = Array.from({ length: 7 }, (_, i) => {
        const date = isoDaysAgo(6 - i);
        return byDate.get(date) ?? { date, total: 0, feedMs: 0, adReels: 0 };
      });
      setRange({ days, apps: result.apps });
    });
  }, []);

  return range;
}

export function useInsights(days = 30) {
  const [insights, setInsights] = useState<Insights>({ hours: [], averageDwellMs: 0 });

  useEffect(() => {
    Core.getInsights(days).then(setInsights);
  }, [days]);

  return insights;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    Core.getSettings().then(setSettings);
  }, []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    if (pending.current) return;
    pending.current = true;
    try {
      // Optimistic, so a toggle does not wait on a round trip; the native result is
      // authoritative and overwrites it.
      setSettings((current) => (current ? { ...current, ...patch } : current));
      const next = await Core.setSettings(patch);
      setSettings(next);
    } finally {
      pending.current = false;
    }
  }, []);

  return { settings, update };
}

export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  // Built from local parts rather than toISOString, which would convert to UTC and
  // hand back yesterday's date for most of the evening east of Greenwich.
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
