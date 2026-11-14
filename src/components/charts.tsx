import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Emoji } from '@/components/emoji';

import {
  AppLabels,
  AppSticker,
  Font,
  HeatRamp,
  Ink,
  Lift,
  Radius,
  SequentialBase,
  Series,
  SeriesSoft,
  Spacing,
  Surface,
  Type,
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

function Card({ title, subtitle, emoji, children }: {
  title: string;
  subtitle?: string;
  emoji?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {emoji ? `${emoji}  ` : ''}
        {title}
      </Text>
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
    <Card title="Last 7 days" subtitle="Short videos counted per day" emoji="📅">
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
                      backgroundColor:
                        day.total === 0 ? Surface.gridline : isToday ? SequentialBase : '#C3B3FF',
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
 * Per-app breakdown, as a ranked stack of tinted tiles: rank number, sticker, name,
 * count, and a bar for magnitude. Each tile carries its app name and count in text,
 * so the colour is a second channel rather than the only one.
 */
export const AppBreakdown = memo(function AppBreakdown({
  apps,
  title = 'By app',
  subtitle = 'Today',
}: {
  apps: AppCount[];
  title?: string;
  subtitle?: string;
}) {
  const total = apps.reduce((sum, a) => sum + a.count, 0);

  if (total === 0) {
    return (
      <Card title={title} subtitle={subtitle} emoji="🏆">
        <View style={styles.emptyBox}>
          <Emoji char="🌱" size={32} />
          <Text style={styles.empty}>Nothing counted yet. A clean slate looks good on you.</Text>
        </View>
      </Card>
    );
  }

  const max = Math.max(...apps.map((a) => a.count));

  return (
    <Card title={title} subtitle={subtitle} emoji="🏆">
      {apps.map((app, i) => (
        <View
          key={app.appId}
          style={[styles.appTile, { backgroundColor: SeriesSoft[app.appId] ?? Surface.raised }]}>
          <Text style={[styles.rank, { color: Series[app.appId] }]}>{i + 1}</Text>
          <View style={styles.appSticker}>
            <Text style={styles.appStickerText}>{AppSticker[app.appId] ?? '📱'}</Text>
          </View>
          <View style={styles.appBody}>
            <View style={styles.hBarHeader}>
              <Text style={styles.hBarLabel}>{AppLabels[app.appId] ?? app.appId}</Text>
              <Text style={[styles.hBarValue, { color: Series[app.appId] }]}>{app.count}</Text>
            </View>
            <View style={styles.hBarTrack}>
              <View
                style={[
                  styles.hBar,
                  {
                    backgroundColor: Series[app.appId],
                    width: `${Math.max(4, (app.count / max) * 100)}%`,
                  },
                ]}
              />
            </View>
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
    <Card title="When you scroll" subtitle="Last 30 days, by hour" emoji="🕒">
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
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Lift,
  },
  cardTitle: { ...Type.heading, color: Ink.primary },
  cardSubtitle: { ...Type.caption, color: Ink.muted, marginTop: 2 },
  cardBody: { marginTop: Spacing.lg },
  empty: { ...Type.caption, color: Ink.muted, flex: 1 },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Surface.raised,
    borderRadius: Radius.control,
    padding: Spacing.lg,
  },

  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xs },
  barColumn: { flex: 1, alignItems: 'center' },
  barValue: {
    ...Type.tick,
    fontFamily: Font.bold,
    color: Ink.secondary,
    marginBottom: Spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  hidden: { opacity: 0 },
  barTrack: {
    height: BAR_AREA_HEIGHT,
    justifyContent: 'flex-end',
    width: '100%',
    paddingHorizontal: 3,
  },
  bar: { width: '100%', borderRadius: 8 },
  axisLabel: { ...Type.tick, color: Ink.muted, marginTop: Spacing.sm },
  axisLabelStrong: { color: Ink.primary, fontFamily: Font.bold },

  appTile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.control + 4,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  rank: { ...Type.title, width: 20, textAlign: 'center', opacity: 0.55 },
  appSticker: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
  },
  appStickerText: { fontSize: 20 },
  appBody: { flex: 1 },
  hBarHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  hBarLabel: { ...Type.label, color: Ink.primary, flex: 1 },
  hBarValue: { ...Type.heading, fontVariant: ['tabular-nums'] },
  hBarTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  hBar: { height: 8, borderRadius: Radius.pill },

  heatRow: { flexDirection: 'row', gap: 2 },
  heatCell: { flex: 1, height: 32, borderRadius: 5 },
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
  legendCell: { width: 14, height: 10, borderRadius: 3 },
  legendText: { ...Type.tick, color: Ink.muted, marginHorizontal: Spacing.xs },
});

export { Card };
