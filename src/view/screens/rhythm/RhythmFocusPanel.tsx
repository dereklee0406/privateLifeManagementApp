import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useGoals } from '../../../controller/GoalProvider';
import { useReminders } from '../../../controller/ReminderProvider';
import type { Goal } from '../../../model/goals/Goal';
import { daysUntilTarget, goalProgress } from '../../../model/goals/goalProgress';
import { appHref } from '../../../utils/navigation';
import { EmptyState } from '../../components/EmptyState';
import { GlassSurface } from '../../components/GlassSurface';
import { SectionActionButton } from '../../components/SectionActionButton';
import { useI18n, localizeGoalDue } from '../../i18n';
import { useThemeColors } from '../../theme/ThemeProvider';
import { fonts, groupedRadius } from '../../theme/tokens';
import { type } from '../../theme/typography';

/**
 * Purpose: Rhythm Focus segment — list, create, and open Goals.
 * Inputs: GoalProvider; ReminderProvider only for linked-habit progress.
 * Outputs: empty state or Goal cards with Model-derived progress.
 * Side effects: navigates to /goals/new or /goals/:id.
 * Design decisions: Create Habit/One-off stays on the hub +; this panel owns Goal CRUD entry.
 */
export function RhythmFocusPanel() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const router = useRouter();
  const { goals } = useGoals();
  const { reminders } = useReminders();
  const checkIns = useMemo(
    () => reminders.map((item) => ({ id: item.id, completedDayKeys: item.completedDayKeys, lastCompletedAt: item.lastCompletedAt })),
    [reminders],
  );

  const openNew = () => router.push(appHref('/goals/new'));

  if (goals.length === 0) {
    return (
      <View style={styles.panel}>
        <EmptyState
          message={t('goals.empty')}
          backdropIcon="flag-outline"
          actionLabel={t('goals.add')}
          actionIcon="add"
          onAction={openNew}
        />
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.toolbar}>
        <SectionActionButton icon="add" label={t('goals.add')} onPress={openNew} />
      </View>
      {goals.map((item) => (
        <GoalCard key={item.id} goal={item} checkIns={checkIns} onPress={() => router.push(appHref(`/goals/${item.id}`))} />
      ))}
    </View>
  );
}

function GoalCard({
  goal,
  checkIns,
  onPress,
}: {
  goal: Goal;
  checkIns: { id: string; completedDayKeys?: string[]; lastCompletedAt?: string }[];
  onPress: () => void;
}) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const progress = goalProgress(goal, new Date(), checkIns);
  const due = localizeGoalDue(t, daysUntilTarget(goal.targetDate));
  const statusLabel =
    goal.status === 'paused' ? t('goals.statusPaused') : goal.status === 'done' ? t('goals.statusDone') : null;
  const metricLine = goal.metric
    ? t('goals.metricLine', {
        current: formatMetricNumber(goal.metric.current),
        target: formatMetricNumber(goal.metric.target),
        unit: goal.metric.unit,
      }).trim()
    : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('goals.focusA11y', { title: goal.title, percent: progress.percent })}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}
    >
      <GlassSurface style={styles.card} radius={groupedRadius}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.ink }]} numberOfLines={2}>
            {goal.title}
          </Text>
          <Text style={[styles.percent, { color: colors.accent }]}>
            {t('goals.percent', { percent: progress.percent })}
          </Text>
        </View>
        {goal.why ? (
          <Text style={[type.footnote, { color: colors.muted }]} numberOfLines={2}>
            {goal.why}
          </Text>
        ) : null}
        <View style={[styles.track, { backgroundColor: colors.well }]}>
          <View
            style={[
              styles.fill,
              { width: `${progress.percent}%` as `${number}%`, backgroundColor: colors.accent },
            ]}
          />
        </View>
        <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
          {[statusLabel, due, metricLine].filter(Boolean).join(' · ')}
        </Text>
      </GlassSurface>
    </Pressable>
  );
}

function formatMetricNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(Math.round(value * 10) / 10);
}

const styles = StyleSheet.create({
  panel: {
    gap: 12,
    paddingBottom: 8,
  },
  toolbar: {
    alignItems: 'flex-start',
  },
  card: {
    padding: 16,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bodySemi,
    fontSize: 17,
    lineHeight: 22,
  },
  percent: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
});
