import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGoals } from '../../controller/GoalProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { daysUntilTarget, goalProgress, pickFocusGoal } from '../../model/goals/goalProgress';
import { appHref } from '../../utils/navigation';
import { useI18n, localizeGoalDue } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, groupedRadius } from '../theme/tokens';
import { GlassSurface } from './GlassSurface';

/**
 * Purpose: compact Today row for the single active Goal — the one-glance goal.
 * Inputs: GoalProvider list; pickFocusGoal + goalProgress in Model.
 * Outputs: one thin Focus row under Next Up, or nothing when no active Goal.
 * Side effects: navigates to Rhythm Focus.
 * Design decisions: hidden when empty so Today stays score + Next Up; tap opens Focus, not a fat card.
 */
export function TodayFocusRow() {
  const colors = useThemeColors();
  const router = useRouter();
  const { t } = useI18n();
  const { goals } = useGoals();
  const { reminders } = useReminders();
  const focus = useMemo(() => pickFocusGoal(goals), [goals]);
  const checkIns = useMemo(
    () =>
      reminders.map((item) => ({
        id: item.id,
        completedDayKeys: item.completedDayKeys,
        lastCompletedAt: item.lastCompletedAt,
      })),
    [reminders],
  );
  const progress = useMemo(
    () => (focus ? goalProgress(focus, new Date(), checkIns) : null),
    [focus, checkIns],
  );
  const due = useMemo(
    () => (focus ? localizeGoalDue(t, daysUntilTarget(focus.targetDate)) : ''),
    [focus, t],
  );

  if (!focus || !progress) {
    return null;
  }

  return (
    <Pressable
      onPress={() => router.push(appHref('/(tabs)/calendar?tab=focus'))}
      accessibilityRole="button"
      accessibilityLabel={t('goals.focusA11y', { title: focus.title, percent: progress.percent })}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <GlassSurface style={styles.card} radius={groupedRadius}>
        <View style={styles.row}>
          <Text style={[styles.kicker, { color: colors.accent }]}>{t('goals.todayLabel')}</Text>
          <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
            {focus.title}
          </Text>
          <Text style={[styles.percent, { color: colors.accent }]}>
            {t('goals.percent', { percent: progress.percent })}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.faint} accessible={false} />
        </View>
        <View style={[styles.track, { backgroundColor: colors.well }]}>
          <View
            style={[
              styles.fill,
              { width: `${progress.percent}%` as `${number}%`, backgroundColor: colors.accent },
            ]}
          />
        </View>
        <Text style={[styles.due, { color: colors.muted }]} numberOfLines={1}>
          {due}
        </Text>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kicker: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 0.4,
    flexShrink: 0,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    lineHeight: 20,
  },
  percent: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  due: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
});
