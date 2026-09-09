import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import {
  calculateHabitStreak,
  computeOverallHabitRhythm,
  generateHeatmapMatrix,
  type HeatmapCell,
} from '../../model/reminders/habitStreaks';
import { resolveReminderTypes } from '../../model/reminders/reminderTypes';
import type { Reminder } from '../../model/reminders/Reminder';
import { toDayKey } from '../../utils/dateUtils';
import { hapticSuccess } from '../../utils/haptics';
import { appHref } from '../../utils/navigation';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { GlassSurface } from '../components/GlassSurface';
import { KeyboardDismissScrollView } from '../components/KeyboardDismissScrollView';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { TypeIcon } from '../components/TypeIcon';
import {
  iconForReminderType,
  iconIdForReminder,
  TYPE_ICON_SIZE,
} from '../icons/typeIcons';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface, type ThemeColors } from '../theme/tokens';
import { useTypography } from '../theme/TypographyProvider';

const HEATMAP_WEEKS = 13;
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const VISIBLE_DAY_LABEL_ROWS = new Set([0, 2, 4]); // Mon, Wed, Fri

/**
 * Purpose: Habit Streaks & Consistency Heatmap — 90-day tactile rhythm matrix, streak cards,
 *   and 1-tap check-ins for recurring (non-once) reminders.
 * Inputs: ReminderProvider (habits + complete/uncomplete); Settings (reminder types); i18n/theme.
 * Outputs: `/habits` screen UI only — all streak/matrix math stays in habitStreaks domain.
 * Side effects: navigation to new reminder; completeReminder / uncompleteReminder; success haptic.
 * Design decisions: View filters enabled recurring habits and orchestrates presentation; density
 *   fills are computed here from theme tokens so the domain stays framework-free. Consistency
 *   rates from the model are 0–1 fractions and are shown as rounded percentages.
 */
export function HabitStreaksScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { type, scaleFontSize } = useTypography();
  const { width: windowWidth } = useWindowDimensions();
  const { reminders, completeReminder, uncompleteReminder } = useReminders();
  const { settings } = useSettings();
  const reminderTypes = useMemo(() => resolveReminderTypes(settings), [settings]);

  const today = useMemo(() => new Date(), [reminders]);
  const todayKey = toDayKey(today);

  const habits = useMemo(
    () => reminders.filter((r) => r.enabled && r.recurrence.type !== 'once'),
    [reminders],
  );

  const overall = useMemo(
    () => computeOverallHabitRhythm(habits, todayKey),
    [habits, todayKey],
  );

  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedHabitId && !habits.some((habit) => habit.id === selectedHabitId)) {
      setSelectedHabitId(null);
    }
  }, [habits, selectedHabitId]);

  const heatmapKeys = useMemo(() => {
    if (selectedHabitId) {
      const habit = habits.find((row) => row.id === selectedHabitId);
      return habit?.completedDayKeys ?? [];
    }
    return habits.map((habit) => habit.completedDayKeys ?? []);
  }, [habits, selectedHabitId]);

  const matrix = useMemo(
    () => generateHeatmapMatrix(heatmapKeys, HEATMAP_WEEKS, today),
    [heatmapKeys, today],
  );

  const cellSize = useMemo(() => {
    const horizontalPad = 40;
    const cardPad = 36;
    const labelCol = 18;
    const gaps = (HEATMAP_WEEKS - 1) * 3;
    const available = windowWidth - horizontalPad - cardPad - labelCol - gaps;
    return Math.max(14, Math.min(18, Math.floor(available / HEATMAP_WEEKS)));
  }, [windowWidth]);

  /**
   * Purpose: toggle today’s check-in for a habit card.
   * Inputs: habit row.
   * Outputs: none.
   * Side effects: complete/uncomplete via ReminderProvider; haptic on complete only.
   */
  const toggleToday = async (habit: Reminder, isCompletedToday: boolean) => {
    if (isCompletedToday) {
      await uncompleteReminder(habit.id);
      return;
    }
    await completeReminder(habit.id);
    await hapticSuccess();
  };

  return (
    <ScreenScaffold>
      <ScreenHeader
        title={t('habits.streaksTitle')}
        trailingIcon="add"
        onTrailing={() => router.push(appHref('/reminders/new'))}
      />
      <KeyboardDismissScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {habits.length === 0 ? (
          <EmptyState
            backdropIcon="flame-outline"
            message={t('habits.emptyStateHint')}
            actionLabel={t('reminder.addReminder')}
            actionIcon="add"
            onAction={() => router.push(appHref('/reminders/new'))}
          />
        ) : (
          <>
            <GlassSurface style={styles.matrixCard} radius={20}>
              <View style={styles.matrixTitleRow}>
                <Ionicons name="calendar-outline" size={20} color={colors.accent} />
                <Text style={[type.headline, styles.matrixTitle, { color: colors.ink }]}>
                  {t('habits.rhythmMatrix')}
                </Text>
              </View>

              <View style={styles.metricRow}>
                <View style={[insetSurface(colors, 14), styles.metricPill]}>
                  <Text style={[type.caption, { color: colors.muted }]}>
                    {t('habits.overallRhythm')}
                  </Text>
                  <Text style={[styles.metricValue, { color: colors.accent, fontSize: scaleFontSize(22) }]}>
                    {`${Math.round(overall.overallConsistency30Days * 100)}%`}
                  </Text>
                </View>
                <View style={[insetSurface(colors, 14), styles.metricPill]}>
                  <Text style={[type.caption, { color: colors.muted }]}>
                    {t('habits.activeHabitsCount', { count: overall.activeHabitCount })}
                  </Text>
                </View>
              </View>

              <View style={styles.filterRow}>
                <Chip
                  label={t('habits.allHabits')}
                  selected={selectedHabitId === null}
                  onPress={() => setSelectedHabitId(null)}
                />
                {habits.map((habit) => (
                  <Chip
                    key={habit.id}
                    label={habit.title}
                    leadingIcon={iconForReminderType(
                      iconIdForReminder(habit.categoryPath, habit.templateId),
                      reminderTypes,
                    )}
                    selected={selectedHabitId === habit.id}
                    onPress={() => setSelectedHabitId(habit.id)}
                  />
                ))}
              </View>

              <HeatmapGrid matrix={matrix} cellSize={cellSize} colors={colors} />
            </GlassSurface>

            <View style={styles.habitList}>
              {habits.map((habit) => {
                const streak = calculateHabitStreak(habit, todayKey);
                return (
                  <GlassSurface key={habit.id} style={styles.habitCard} radius={18}>
                    <View style={styles.habitTopRow}>
                      <View style={styles.habitIdentity}>
                        <TypeIcon
                          typeId={iconIdForReminder(habit.categoryPath, habit.templateId)}
                          reminderTypes={reminderTypes}
                          size={TYPE_ICON_SIZE}
                        />
                        <Text
                          style={[type.headline, styles.habitTitle, { color: colors.ink }]}
                          numberOfLines={2}
                        >
                          {habit.title}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => void toggleToday(habit, streak.isCompletedToday)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          streak.isCompletedToday
                            ? t('habits.completed')
                            : t('habits.markCompleted')
                        }
                        style={({ pressed }) => [
                          styles.checkInBtn,
                          {
                            backgroundColor: streak.isCompletedToday
                              ? colors.accent
                              : colors.accentSoft,
                            borderColor: colors.accent,
                            opacity: pressed ? 0.85 : 1,
                            transform: [{ scale: pressed ? 0.95 : 1 }],
                          },
                        ]}
                      >
                        <Ionicons
                          name={streak.isCompletedToday ? 'checkmark-circle' : 'ellipse-outline'}
                          size={18}
                          color={streak.isCompletedToday ? colors.accentInk : colors.accent}
                        />
                        <Text
                          style={[
                            styles.checkInLabel,
                            {
                              color: streak.isCompletedToday ? colors.accentInk : colors.accent,
                              fontSize: scaleFontSize(13),
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {streak.isCompletedToday
                            ? t('habits.completed')
                            : t('habits.markCompleted')}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.statsRow}>
                      <View style={[insetSurface(colors, 999), styles.statBadge]}>
                        <Text style={[styles.statBadgeText, { color: colors.ink, fontSize: scaleFontSize(13) }]}>
                          {`🔥 ${t('habits.streakDays', { days: streak.currentStreak })}`}
                        </Text>
                      </View>
                      <View style={[insetSurface(colors, 999), styles.statBadge]}>
                        <Text style={[styles.statBadgeText, { color: colors.ink, fontSize: scaleFontSize(13) }]}>
                          {`🏆 ${t('habits.bestStreak', { days: streak.bestStreak })}`}
                        </Text>
                      </View>
                      <View style={[insetSurface(colors, 999), styles.statBadge]}>
                        <Text style={[styles.statBadgeText, { color: colors.accent, fontSize: scaleFontSize(13) }]}>
                          {`${Math.round(streak.consistencyRate30Days * 100)}%`}
                        </Text>
                      </View>
                    </View>

                    <Text style={[type.footnote, { color: colors.muted }]}>
                      {t('habits.totalCheckIns', { count: streak.totalCompletions })}
                    </Text>
                  </GlassSurface>
                );
              })}
            </View>
          </>
        )}
      </KeyboardDismissScrollView>
    </ScreenScaffold>
  );
}

/**
 * Purpose: render 7×13 Mon–Sun heatmap from week-column matrix data.
 * Inputs: HeatmapCell[][] (outer = weeks oldest→newest, inner = Mon…Sun), cell size, theme.
 * Outputs: day-label column + density cells; today cells get an accent border.
 * Side effects: none.
 */
function HeatmapGrid({
  matrix,
  cellSize,
  colors,
}: {
  matrix: HeatmapCell[][];
  cellSize: number;
  colors: ThemeColors;
}) {
  const weeks = matrix.length;
  const radius = cellSize >= 17 ? 4 : 3;

  return (
    <View style={styles.heatmapWrap} accessibilityRole="image" accessibilityLabel="Habit consistency heatmap">
      {DAY_LABELS.map((label, weekday) => (
        <View key={`row-${weekday}`} style={styles.heatmapRow}>
          <View style={[styles.dayLabelCol, { height: cellSize }]}>
            {VISIBLE_DAY_LABEL_ROWS.has(weekday) ? (
              <Text style={[styles.dayLabel, { color: colors.faint }]}>{label}</Text>
            ) : null}
          </View>
          {Array.from({ length: weeks }, (_, week) => {
            const cell = matrix[week]?.[weekday];
            if (!cell) {
              return <View key={`c-${week}-${weekday}`} style={{ width: cellSize, height: cellSize }} />;
            }
            return (
              <View
                key={cell.dayKey}
                style={{
                  width: cellSize,
                  height: cellSize,
                  borderRadius: radius,
                  backgroundColor: heatmapFill(cell.level, colors),
                  borderWidth: cell.isToday ? 1.5 : 0,
                  borderColor: cell.isToday ? colors.accent : 'transparent',
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

/**
 * Purpose: map heatmap density level to a theme-aware fill color.
 * Inputs: level 0–4, ThemeColors.
 * Outputs: CSS/RN color string.
 * Side effects: none.
 * Design decisions: L0 uses well (light) or soft white wash (dark); L1–L2 tint accentSoft via
 *   accent alpha; L3–L4 use accent at 75% / solid so density reads clearly on clay surfaces.
 */
function heatmapFill(level: HeatmapCell['level'], colors: ThemeColors): string {
  switch (level) {
    case 0:
      return colors.scheme === 'dark' ? 'rgba(255,255,255,0.06)' : colors.well;
    case 1:
      return hexWithAlpha(colors.accent, 0.28);
    case 2:
      return hexWithAlpha(colors.accent, 0.52);
    case 3:
      return hexWithAlpha(colors.accent, 0.75);
    case 4:
      return colors.accent;
    default:
      return colors.well;
  }
}

/**
 * Purpose: attach an alpha channel to a #RRGGBB accent token.
 * Inputs: hex color, alpha 0–1.
 * Outputs: rgba(...) string; falls back to the original when not a 6-digit hex.
 * Side effects: none.
 */
function hexWithAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) {
    return hex;
  }
  const value = match[1]!;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const clamped = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${clamped})`;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  matrixCard: {
    padding: 18,
    gap: 14,
  },
  matrixTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matrixTitle: {
    flex: 1,
    minWidth: 0,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricPill: {
    flexGrow: 1,
    flexBasis: '40%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  metricValue: {
    fontFamily: fonts.display,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  heatmapWrap: {
    gap: 3,
    alignSelf: 'stretch',
  },
  heatmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dayLabelCol: {
    width: 16,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  dayLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    lineHeight: 12,
  },
  habitList: {
    gap: 12,
  },
  habitCard: {
    padding: 16,
    gap: 12,
  },
  habitTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  habitIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  habitTitle: {
    flex: 1,
    minWidth: 0,
  },
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    maxWidth: '46%',
  },
  checkInLabel: {
    fontFamily: fonts.bodyMedium,
    flexShrink: 1,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  statBadgeText: {
    fontFamily: fonts.bodyMedium,
  },
});
