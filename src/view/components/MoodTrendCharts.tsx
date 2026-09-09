import { StyleSheet, Text, View } from 'react-native';
import type { ClimatePeriodPoint, DailyMoodPoint, Last30DaysSummary } from '../../model/journal/moodTrends';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { GlassSurface } from './GlassSurface';

interface MoodTrendChartsProps {
  last30Days: Last30DaysSummary;
  daily: DailyMoodPoint[];
  weekly: ClimatePeriodPoint[];
  monthly: ClimatePeriodPoint[];
}

/**
 * Purpose: render Aura mood analysis with View-based bars (no native chart packages).
 * Inputs: model snapshot from the controller.
 * Outputs: 30-day percents, daily mood bars, weekly and monthly stacked trends.
 * Side effects: none.
 * Design decisions: RN Views only so web cannot crash on a native chart module.
 */
export function MoodTrendCharts({ last30Days, daily, weekly, monthly }: MoodTrendChartsProps) {
  const colors = useThemeColors();
  const { t } = useI18n();

  if (last30Days.total === 0) {
    return (
      <GlassSurface style={styles.panel} radius={28}>
        <Text style={[styles.panelTitle, { color: colors.ink }]}>{t('mood.last30Days')}</Text>
        <Text style={[styles.empty, { color: colors.muted }]}>{t('mood.noHistory')}</Text>
      </GlassSurface>
    );
  }

  const maxDaily = Math.max(1, ...daily.map((point) => point.count));
  const maxWeek = Math.max(1, ...weekly.map((point) => point.total));
  const maxMonth = Math.max(1, ...monthly.map((point) => point.total));

  return (
    <View style={styles.stack}>
      <GlassSurface style={styles.panel} radius={28}>
        <Text style={[styles.panelTitle, { color: colors.ink }]}>{t('mood.last30Days')}</Text>
        {last30Days.shares.map((share) => {
          const moodKey = `mood.${share.climate}`;
          const moodLabel = t(moodKey);
          return (
            <View key={share.climate} style={styles.shareRow}>
              <Text style={[styles.shareLabel, { color: colors.muted }]}>
                {moodLabel !== moodKey ? moodLabel : share.label}
              </Text>
              <View style={[styles.track, { backgroundColor: colors.well }]}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.max(share.percent, share.count > 0 ? 4 : 0)}%`,
                      backgroundColor: colors.climate[share.climate],
                    },
                  ]}
                />
              </View>
              <Text style={[styles.sharePct, { color: colors.ink }]}>{share.percent}%</Text>
            </View>
          );
        })}
      </GlassSurface>

      <GlassSurface style={styles.panel} radius={28}>
        <Text style={[styles.panelTitle, { color: colors.ink }]}>{t('mood.dailyMood')}</Text>
        <Text style={[styles.lede, { color: colors.faint }]}>{t('mood.lastNDays', { n: daily.length })}</Text>
        <View style={styles.dailyRow}>
          {daily.map((point) => (
            <View key={point.dayKey} style={styles.dailyCol}>
              <View style={[styles.dailyTrack, { backgroundColor: colors.well }]}>
                <View
                  style={[
                    styles.dailyBar,
                    {
                      height: point.count ? Math.max(6, (point.count / maxDaily) * 72) : 2,
                      backgroundColor: point.mood ? colors.mood[point.mood] : colors.well,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.tick, { color: colors.faint }]}>{point.label}</Text>
            </View>
          ))}
        </View>
      </GlassSurface>

      <StackedPanel title={t('mood.weeklyTrend')} points={weekly} maxTotal={maxWeek} />
      <StackedPanel title={t('mood.monthlyTrend')} points={monthly} maxTotal={maxMonth} />
    </View>
  );
}

function StackedPanel({
  title,
  points,
  maxTotal,
}: {
  title: string;
  points: ClimatePeriodPoint[];
  maxTotal: number;
}) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const climateLabel = (climate: 'happy' | 'neutral' | 'stress') => {
    const key = `mood.${climate}`;
    const translated = t(key);
    return translated !== key ? translated : climate.charAt(0).toUpperCase() + climate.slice(1);
  };
  return (
    <GlassSurface style={styles.panel} radius={28}>
      <Text style={[styles.panelTitle, { color: colors.ink }]}>{title}</Text>
      <View style={styles.legend}>
        <Text style={[styles.legendItem, { color: colors.climate.happy }]}>{climateLabel('happy')}</Text>
        <Text style={[styles.legendItem, { color: colors.climate.neutral }]}>{climateLabel('neutral')}</Text>
        <Text style={[styles.legendItem, { color: colors.climate.stress }]}>{climateLabel('stress')}</Text>
      </View>
      <View style={styles.stackRow}>
        {points.map((point) => {
          const height = point.total ? Math.max(10, (point.total / maxTotal) * 88) : 4;
          const happyH = point.total ? (point.happy / point.total) * height : 0;
          const neutralH = point.total ? (point.neutral / point.total) * height : 0;
          const stressH = point.total ? (point.stress / point.total) * height : 0;
          return (
            <View key={point.key} style={styles.stackCol}>
              <View style={[styles.stackTrack, { height: 88, backgroundColor: colors.well }]}>
                <View style={{ height: happyH, backgroundColor: colors.climate.happy, width: '100%' }} />
                <View style={{ height: neutralH, backgroundColor: colors.climate.neutral, width: '100%' }} />
                <View style={{ height: stressH, backgroundColor: colors.climate.stress, width: '100%' }} />
              </View>
              <Text style={[styles.tick, { color: colors.faint }]} numberOfLines={1}>
                {point.label}
              </Text>
            </View>
          );
        })}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  panel: { padding: 20, gap: 12 },
  panelTitle: { fontFamily: fonts.display, fontSize: 22 },
  lede: { fontFamily: fonts.body, fontSize: 13, marginTop: -6 },
  empty: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shareLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, width: 72 },
  sharePct: { fontFamily: fonts.bodySemi, fontSize: 14, width: 42, textAlign: 'right' },
  track: { flex: 1, height: 10, borderRadius: 999, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 999 },
  dailyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  dailyCol: { flex: 1, alignItems: 'center', gap: 4 },
  dailyTrack: { width: '100%', height: 76, justifyContent: 'flex-end', borderRadius: 6, overflow: 'hidden' },
  dailyBar: { width: '100%', borderRadius: 6 },
  tick: { fontFamily: fonts.body, fontSize: 8 },
  legend: { flexDirection: 'row', gap: 12 },
  legendItem: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  stackRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  stackCol: { flex: 1, alignItems: 'center', gap: 4 },
  stackTrack: {
    width: '100%',
    justifyContent: 'flex-end',
    borderRadius: 8,
    overflow: 'hidden',
  },
});
