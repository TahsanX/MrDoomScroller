import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppBreakdown, Card, HourHeatmap } from '@/components/charts';
import { Body, Panel, Screen, SectionTitle } from '@/components/ds-ui';
import { Ink, SequentialBase, Spacing } from '@/constants/theme';
import { formatDuration, isoDaysAgo, useInsights } from '@/hooks/use-scrollwise';
import * as Core from '../../modules/scrollwise-core/src';
import type { DayTotal, RangeResult } from '../../modules/scrollwise-core/src';

const WINDOW_DAYS = 30;

export default function History() {
  const [range, setRange] = useState<RangeResult>({ days: [], apps: [] });
  const insights = useInsights(WINDOW_DAYS);

  useEffect(() => {
    Core.getRange(isoDaysAgo(WINDOW_DAYS - 1), isoDaysAgo(0)).then(setRange);
  }, []);

  const totals = range.days.map((d) => d.total);
  const total = totals.reduce((a, b) => a + b, 0);
  const busiest = range.days.reduce<DayTotal | null>(
    (best, day) => (best == null || day.total > best.total ? day : best),
    null
  );
  const quietest = range.days.reduce<DayTotal | null>(
    (best, day) => (best == null || day.total < best.total ? day : best),
    null
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Card title="Last 30 days" subtitle={`${range.days.length} days with activity`}>
          <View style={styles.statRow}>
            <Stat label="Total reels" value={`${total}`} />
            <Stat
              label="Daily average"
              value={range.days.length ? `${Math.round(total / range.days.length)}` : '—'}
            />
            <Stat
              label="Average per reel"
              value={
                insights.averageDwellMs
                  ? `${Math.round(insights.averageDwellMs / 1000)}s`
                  : '—'
              }
            />
          </View>
        </Card>

        {busiest && quietest ? (
          <Panel>
            <SectionTitle>Extremes</SectionTitle>
            <Text style={styles.extreme}>
              Heaviest day: <Text style={styles.extremeValue}>{busiest.date}</Text>, {busiest.total}{' '}
              reels over {formatDuration(busiest.feedMs)}.
            </Text>
            <Text style={styles.extreme}>
              Lightest day with activity:{' '}
              <Text style={styles.extremeValue}>{quietest.date}</Text>, {quietest.total} reels.
            </Text>
          </Panel>
        ) : null}

        {/* One series over 30 days: a dense bar strip reads better than 30 labelled bars. */}
        <Card title="Daily totals" subtitle="Oldest to newest">
          {range.days.length === 0 ? (
            <Body muted>Nothing recorded yet.</Body>
          ) : (
            <View style={styles.sparkRow}>
              {range.days.map((day) => {
                const max = Math.max(1, ...totals);
                return (
                  <View key={day.date} style={styles.sparkColumn}>
                    <View
                      style={[
                        styles.sparkBar,
                        {
                          height: Math.max(3, (day.total / max) * 90),
                          backgroundColor: SequentialBase,
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        <AppBreakdown apps={range.apps} />
        <HourHeatmap hours={insights.hours} />

        <Panel>
          <SectionTitle>About this window</SectionTitle>
          <Body muted>
            Daily totals are kept for as long as you have the app. The per-reel detail
            behind the hour chart and the average is kept for {WINDOW_DAYS} days and
            then deleted, because nothing needs it after that.
          </Body>
        </Panel>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  statRow: { flexDirection: 'row', gap: Spacing.lg },
  stat: { flex: 1 },
  statValue: { color: Ink.primary, fontSize: 20, fontWeight: '600' },
  statLabel: { color: Ink.muted, fontSize: 11, marginTop: 2 },
  extreme: { color: Ink.secondary, fontSize: 13, lineHeight: 20, marginTop: Spacing.xs },
  extremeValue: { color: Ink.primary, fontWeight: '600' },
  sparkRow: { flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 1 },
  sparkColumn: { flex: 1, justifyContent: 'flex-end' },
  sparkBar: { width: '100%', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
});
