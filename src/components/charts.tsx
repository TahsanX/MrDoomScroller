import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AppLabels,
  HeatRamp,
  Ink,
  Radius,
  SequentialBase,
  Series,
  Spacing,
  Surface,
} from '@/constants/theme';
// Relative rather than a tsconfig path alias: the native module lives outside src/,
// and a relative specifier resolves identically in Metro, tsc and jest.
import type { AppCount, DayTotal, HourBucket } from '../../modules/scrollwise-core/src';

/**
 * Charts are plain Views rather than a charting library.
 *
 * Every form here is a rectangle whose length encodes one number, which RN layout
 * already does exactly; a chart dependency would add weight and a second styling
 * system for no gain. Marks follow the house spec: 4px rounded data-ends anchored to
 * the baseline, a 2px surface gap between adjacent marks, recessive gridlines, and
 * selective direct labels rather than a value on every mark.
 */

const BAR_AREA_HEIGHT = 120;

function Card({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

/**
 * Seven days of totals. One series, so no legend: the title names it, and only the
 * highest and today's bars are labelled rather than all seven.
 */
export const WeekBars = memo(function WeekBars({ days }: { days: DayTotal[] }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <Card title="Last 7 days" subtitle="Short videos counted per day">
      <View style={styles.barRow}>
        {days.map((day) => {
          const isToday = day.date === todayIso;
          const isPeak = day.total === max && max > 0;
          const height = Math.max(day.total === 0 ? 2 : 6, (day.total / max) * BAR_AREA_HEIGHT);
          return (
            <View key={day.date} style={styles.barColumn}>
              {/* Label only the peak and today; a number on every bar is noise. */}
              <Text style={[styles.barValue, !(isPeak || isToday) && styles.hidden]}>
                {day.total}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height,
                      backgroundColor: day.total === 0 ? Surface.gridline : SequentialBase,
                      opacity: isToday || isPeak ? 1 : 0.72,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.axisLabel, isToday && styles.axisLabelStrong]}>
                {weekdayLetter(day.date)}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
});

/**
 * Per-app breakdown. Horizontal bars rather than a donut: the job is comparing
 * magnitudes, and every bar carries its app name and count as a direct label, so the
 * colour is a second channel rather than the only one.
 */
export const AppBreakdown = memo(function AppBreakdown({ apps }: { apps: AppCount[] }) {
  const total = apps.reduce((sum, a) => sum + a.count, 0);

  if (total === 0) {
    return (
      <Card title="By app" subtitle="Today">
        <Text style={styles.empty}>Nothing counted yet today.</Text>
      </Card>
    );
  }

  const max = Math.max(...apps.map((a) => a.count));

  return (
    <Card title="By app" subtitle="Today">
      {apps.map((app) => (
        <View key={app.appId} style={styles.hBarRow}>
          <View style={styles.hBarHeader}>
            <View style={[styles.swatch, { backgroundColor: Series[app.appId] }]} />
            <Text style={styles.hBarLabel}>{AppLabels[app.appId] ?? app.appId}</Text>
            <Text style={styles.hBarValue}>{app.count}</Text>
          </View>
          <View style={styles.hBarTrack}>
            <View
              style={[
                styles.hBar,
                {
                  backgroundColor: Series[app.appId],
                  width: `${Math.max(2, (app.count / max) * 100)}%`,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </Card>
  );
});

/**
 * Hour-of-day heatmap. Sequential single hue, near-zero darkest so it recedes into
 * the card; the legend spells the ramp out because a heat cell has no label of its
 * own.
 */
export const HourHeatmap = memo(function HourHeatmap({ hours }: { hours: HourBucket[] }) {
  const byHour = new Map(hours.map((h) => [h.hour, h.count]));
  const max = Math.max(1, ...hours.map((h) => h.count));

  return (
    <Card title="When you scroll" subtitle="Last 30 days, by hour">
      <View style={styles.heatRow}>
        {Array.from({ length: 24 }, (_, hour) => {
          const count = byHour.get(hour) ?? 0;
          return (
            <View
              key={hour}
              style={[styles.heatCell, { backgroundColor: heatColor(count, max) }]}
            />
          );
        })}
      </View>
      <View style={styles.heatAxis}>
        <Text style={styles.axisLabel}>12a</Text>
        <Text style={styles.axisLabel}>6a</Text>
        <Text style={styles.axisLabel}>12p</Text>
        <Text style={styles.axisLabel}>6p</Text>
        <Text style={styles.axisLabel}>11p</Text>
      </View>
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>less</Text>
        {HeatRamp.map((color) => (
          <View key={color} style={[styles.legendCell, { backgroundColor: color }]} />
        ))}
        <Text style={styles.legendText}>more</Text>
      </View>
    </Card>
  );
});

function heatColor(count: number, max: number): string {
  if (count === 0) return HeatRamp[0];
  const steps = HeatRamp.length - 1;
  const index = Math.min(steps, Math.max(1, Math.ceil((count / max) * steps)));
  return HeatRamp[index];
}

function weekdayLetter(iso: string): string {
  // Parsed as local midnight rather than through Date(iso), which would treat the
  // date as UTC and shift the label a day for anyone west of Greenwich.
  const [y, m, d] = iso.split('-').map(Number);
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(y, m - 1, d).getDay()];
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Surface.card,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardTitle: { color: Ink.primary, fontSize: 15, fontWeight: '600' },
  cardSubtitle: { color: Ink.muted, fontSize: 12, marginTop: 2 },
  cardBody: { marginTop: Spacing.lg },
  empty: { color: Ink.muted, fontSize: 13 },

  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xs },
  barColumn: { flex: 1, alignItems: 'center' },
  barValue: {
    color: Ink.secondary,
    fontSize: 11,
    marginBottom: Spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  hidden: { opacity: 0 },
  barTrack: {
    height: BAR_AREA_HEIGHT,
    justifyContent: 'flex-end',
    width: '100%',
    // 2px of surface between adjacent bars.
    paddingHorizontal: 1,
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: Radius.mark,
    borderTopRightRadius: Radius.mark,
  },
  axisLabel: { color: Ink.muted, fontSize: 11, marginTop: Spacing.sm },
  axisLabelStrong: { color: Ink.secondary, fontWeight: '600' },

  hBarRow: { marginBottom: Spacing.md },
  hBarHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  swatch: { width: 10, height: 10, borderRadius: 3, marginRight: Spacing.sm },
  hBarLabel: { color: Ink.secondary, fontSize: 13, flex: 1 },
  hBarValue: {
    color: Ink.primary,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  hBarTrack: {
    height: 8,
    backgroundColor: Surface.gridline,
    borderRadius: Radius.mark,
    overflow: 'hidden',
  },
  hBar: { height: 8, borderRadius: Radius.mark },

  heatRow: { flexDirection: 'row', gap: 2 },
  heatCell: { flex: 1, height: 28, borderRadius: 3 },
  heatAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: Spacing.md,
  },
  legendCell: { width: 14, height: 10, borderRadius: 2 },
  legendText: { color: Ink.muted, fontSize: 11, marginHorizontal: Spacing.xs },
});

export { Card };
