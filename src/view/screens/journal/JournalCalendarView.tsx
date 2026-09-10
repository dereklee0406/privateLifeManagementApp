import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFinance } from '../../../controller/FinanceProvider';
import { useJournal } from '../../../controller/JournalProvider';
import { useReminders } from '../../../controller/ReminderProvider';
import { formatFriendlyMoney, type Expense } from '../../../model/finance/Expense';
import { expensesOnDay } from '../../../model/finance/financeStats';
import { formatExpenseSpendLine } from '../../../model/finance/fx';
import type { JournalEntry } from '../../../model/journal/JournalEntry';
import { getMoodDefinition } from '../../../model/journal/Mood';
import { stripMarkdown } from '../../../model/journal/markdown';
import { isReminderCompletedToday, type Reminder } from '../../../model/reminders/Reminder';
import { remindersOnDay } from '../../../model/reminders/grouping';
import { formatLongDate, isoAtLocalNoon, toDayKey } from '../../../utils/dateUtils';
import { appHref } from '../../../utils/navigation';
import { hapticLight, hapticSuccess } from '../../../utils/haptics';
import { Chip } from '../../components/Chip';
import { GlassSurface } from '../../components/GlassSurface';
import { JournalMediaImage } from '../../components/JournalMediaImage';
import { SectionActionButton } from '../../components/SectionActionButton';
import { TypeIcon } from '../../components/TypeIcon';
import {
  iconIdForReminder,
  typeA11yLabel,
  type TypeIconName,
} from '../../icons/typeIcons';
import { useI18n } from '../../i18n';
import { useThemeColors } from '../../theme/ThemeProvider';
import { fonts, groupedRadius, raisedSurface } from '../../theme/tokens';
import { useTypography } from '../../theme/TypographyProvider';

/** Amber / gold — journal page written that day. */
const DOT_JOURNAL = '#E8A838';
/** Emerald — habit or reminder due / active that day. */
const DOT_HABIT = '#34C759';

/**
 * Purpose: Journal companion calendar — month grid + selected-day multi-domain inspection.
 * Inputs: journal / reminders / finance via providers (read-only View orchestration).
 * Outputs: month nav, 7×weeks grid with journal/habit/spend dots, sectioned day cards.
 * Side effects: navigation to compose, reminder, or spend; complete/uncomplete reminder;
 *   light haptic on day select / jump-to-today; success haptic on habit check-in.
 * Design decisions: three distinct mini-dots synthesize life activity at a glance;
 *   day drawer uses sectioned cards (stories / habits / spends) instead of a flat list;
 *   extracted from CalendarScreen month mode so Journal owns date browsing.
 */
export function JournalCalendarView() {
  const colors = useThemeColors();
  const router = useRouter();
  const { t, intlLocale } = useI18n();
  const { scaleFontSize } = useTypography();
  const { calendarMonth, adjacentMonth, entriesForDay } = useJournal();
  const { reminders, completeReminder, uncompleteReminder } = useReminders();
  const { expenses } = useFinance();

  const todayKey = toDayKey(new Date());
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selectedDay, setSelectedDay] = useState(todayKey);

  const month = useMemo(
    () => calendarMonth(cursor.year, cursor.month, intlLocale),
    [calendarMonth, cursor.year, cursor.month, intlLocale],
  );
  const dayEntries = useMemo(() => entriesForDay(selectedDay), [entriesForDay, selectedDay]);
  const dayReminders = useMemo(() => remindersOnDay(reminders, selectedDay), [reminders, selectedDay]);
  const dayExpenses = useMemo(() => expensesOnDay(expenses, selectedDay), [expenses, selectedDay]);
  const dayIsEmpty = dayEntries.length === 0 && dayReminders.length === 0 && dayExpenses.length === 0;

  const selectedDateLabel = useMemo(
    () => formatLongDate(new Date(isoAtLocalNoon(selectedDay)), intlLocale),
    [selectedDay, intlLocale],
  );

  const jumpToToday = () => {
    void hapticLight();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDay(todayKey);
  };

  const toggleComplete = async (reminder: Reminder) => {
    if (isReminderCompletedToday(reminder, now)) {
      await uncompleteReminder(reminder.id);
    } else {
      await completeReminder(reminder.id);
      await hapticSuccess();
    }
  };

  const dayNumSize = scaleFontSize(13);
  const weekdaySize = scaleFontSize(11);
  const headingSize = scaleFontSize(22);
  const sectionSize = scaleFontSize(15);

  return (
    <View style={styles.root}>
      <View style={styles.nav}>
        <Pressable
          onPress={() => setCursor((current) => adjacentMonth(current.year, current.month, -1))}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.prevMonth')}
          style={[raisedSurface(colors, 14), styles.monthNavBtn, { backgroundColor: colors.accentSoft }]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.accent} accessible={false} importantForAccessibility="no" />
        </Pressable>
        <Text
          style={[styles.heading, { color: colors.ink, fontSize: headingSize, lineHeight: headingSize + 6 }]}
          numberOfLines={2}
        >
          {month.heading}
        </Text>
        <Pressable
          onPress={() => setCursor((current) => adjacentMonth(current.year, current.month, 1))}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.nextMonth')}
          style={[raisedSurface(colors, 14), styles.monthNavBtn, { backgroundColor: colors.accentSoft }]}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.accent} accessible={false} importantForAccessibility="no" />
        </Pressable>
      </View>

      <View style={styles.todayRow}>
        <Chip icon="today-outline" label={t('calendar.jumpToday')} selected={selectedDay === todayKey} onPress={jumpToToday} />
      </View>

      <View style={styles.weekRow}>
        {month.weekdayLabels.map((label, index) => (
          <Text
            key={`${label}-${index}`}
            style={[styles.weekday, { color: colors.faint, fontSize: weekdaySize }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {month.cells.map((cell) => {
          const selected = cell.dayKey === selectedDay;
          const hasEntry = entriesForDay(cell.dayKey).length > 0;
          const hasReminder = remindersOnDay(reminders, cell.dayKey).length > 0;
          const hasSpend = expensesOnDay(expenses, cell.dayKey).length > 0;
          return (
            <Pressable
              key={cell.dayKey}
              onPress={() => {
                void hapticLight();
                setSelectedDay(cell.dayKey);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={cell.dayKey}
              style={[
                styles.cell,
                {
                  opacity: cell.inCurrentMonth ? 1 : 0.35,
                  backgroundColor: selected ? colors.accentSoft : 'transparent',
                },
                selected
                  ? {
                      ...raisedSurface(colors, 14),
                      backgroundColor: colors.accentSoft,
                      borderWidth: 1.5,
                      borderColor: colors.accent,
                    }
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.dayNum,
                  {
                    color: cell.dayKey === todayKey ? colors.accent : colors.ink,
                    fontSize: dayNumSize,
                    fontVariant: ['tabular-nums'],
                  },
                ]}
              >
                {cell.dayOfMonth}
              </Text>
              <View style={styles.dots}>
                {hasEntry ? <View style={[styles.dot, { backgroundColor: DOT_JOURNAL }]} /> : null}
                {hasReminder ? <View style={[styles.dot, { backgroundColor: DOT_HABIT }]} /> : null}
                {hasSpend ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.dayHead}>
        <View style={styles.dayHeadCopy}>
          <Text
            style={[styles.section, { color: colors.ink, fontSize: headingSize, lineHeight: headingSize + 6 }]}
            numberOfLines={2}
          >
            {selectedDateLabel}
          </Text>
          {!dayIsEmpty ? (
            <View style={styles.pillRow}>
              {dayEntries.length > 0 ? (
                <CountPill
                  color={DOT_JOURNAL}
                  label={t('journal.pillStories', { count: dayEntries.length })}
                />
              ) : null}
              {dayReminders.length > 0 ? (
                <CountPill
                  color={DOT_HABIT}
                  label={t('journal.pillHabits', { count: dayReminders.length })}
                />
              ) : null}
              {dayExpenses.length > 0 ? (
                <CountPill
                  color={colors.accent}
                  label={t('journal.pillSpends', { count: dayExpenses.length })}
                />
              ) : null}
            </View>
          ) : null}
        </View>
        <DayHeadAction
          icon="create-outline"
          label={t('common.write')}
          onPress={() => router.push(`/compose?date=${selectedDay}`)}
        />
      </View>

      {dayIsEmpty ? (
        <View style={styles.emptyBlock}>
          <Text style={[styles.empty, { color: colors.faint, fontSize: scaleFontSize(15) }]}>
            {t('journal.emptyDay')}
          </Text>
          <View style={styles.emptyActions}>
            <QuickActionChip
              icon="create-outline"
              label={t('common.write')}
              onPress={() => router.push(`/compose?date=${selectedDay}`)}
            />
            <QuickActionChip
              icon="checkbox-outline"
              label={t('journal.addTask')}
              onPress={() => router.push(appHref('/reminders/new'))}
            />
            <QuickActionChip
              icon="wallet-outline"
              label={t('journal.logSpend')}
              onPress={() => router.push(appHref(`/expense/new?date=${selectedDay}`))}
            />
          </View>
        </View>
      ) : null}

      {dayEntries.length > 0 ? (
        <View style={styles.block}>
          <Text style={[styles.blockTitle, { color: colors.muted, fontSize: sectionSize }]}>
            {t('journal.sectionStories')}
          </Text>
          {dayEntries.map((entry) => (
            <DayStoryCard key={entry.id} entry={entry} onPress={() => router.push(`/entry/${entry.id}`)} />
          ))}
        </View>
      ) : null}

      {dayReminders.length > 0 ? (
        <View style={styles.block}>
          <Text style={[styles.blockTitle, { color: colors.muted, fontSize: sectionSize }]}>
            {t('journal.sectionHabits')}
          </Text>
          {dayReminders.map(({ reminder, fireAt }) => {
            const done = isReminderCompletedToday(reminder, now);
            const timeLabel = fireAt
              ? `${String(fireAt.getHours()).padStart(2, '0')}:${String(fireAt.getMinutes()).padStart(2, '0')}`
              : t('calendar.sometime');
            return (
              <GlassSurface key={reminder.id} style={styles.note} radius={groupedRadius}>
                <View style={styles.noteRow}>
                  <Pressable
                    onPress={() => void toggleComplete(reminder)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done }}
                    accessibilityLabel={
                      done
                        ? t('reminder.uncompleteA11y', { title: reminder.title })
                        : t('reminder.completeA11y', { title: reminder.title })
                    }
                    hitSlop={8}
                    style={[
                      styles.checkbox,
                      {
                        borderColor: done ? colors.accent : colors.muted,
                        backgroundColor: done ? colors.accentSoft : 'transparent',
                      },
                    ]}
                  >
                    {done ? <Ionicons name="checkmark" size={16} color={colors.accent} /> : null}
                  </Pressable>
                  <Pressable
                    style={styles.habitHit}
                    onPress={() => router.push(appHref(`/reminders/${reminder.id}`))}
                    accessibilityRole="button"
                    accessibilityLabel={reminder.title}
                  >
                    <TypeIcon typeId={iconIdForReminder(reminder.categoryPath, reminder.templateId)} />
                    <View style={styles.noteCopy}>
                      <Text
                        style={[
                          styles.rowTitle,
                          { color: colors.ink, textDecorationLine: done ? 'line-through' : 'none' },
                        ]}
                        numberOfLines={2}
                      >
                        {reminder.title}
                      </Text>
                      <Text style={[styles.meta, { color: colors.muted, fontVariant: ['tabular-nums'] }]}>
                        {timeLabel}
                        {reminder.note ? ` · ${reminder.note}` : ''}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </GlassSurface>
            );
          })}
          <SectionActionButton
            icon="list-outline"
            label={t('calendar.openAllReminders')}
            onPress={() => router.push('/(tabs)/calendar/reminders')}
            style={styles.blockAction}
          />
        </View>
      ) : null}

      {dayExpenses.length > 0 ? (
        <View style={styles.block}>
          <Text style={[styles.blockTitle, { color: colors.muted, fontSize: sectionSize }]}>
            {t('journal.sectionSpends')}
          </Text>
          {dayExpenses.map((expense) => (
            <DaySpendCard
              key={expense.id}
              expense={expense}
              onPress={() => router.push(appHref(`/expense/${expense.id}`))}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Purpose: non-interactive count summary pill under the selected date heading.
 * Inputs: domain color + localized label (e.g. "2 pages").
 * Outputs: compact colored-dot + label chip.
 * Side effects: none.
 */
function CountPill({ color, label }: { color: string; label: string }) {
  const colors = useThemeColors();
  const { scaleFontSize } = useTypography();
  return (
    <View style={[styles.pill, { backgroundColor: colors.well, borderColor: colors.line }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={[styles.pillLabel, { color: colors.muted, fontSize: scaleFontSize(12), fontVariant: ['tabular-nums'] }]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Purpose: journal story card for the day drawer — mood glyph, title, preview, photo strip.
 * Inputs: entry + navigation press.
 * Outputs: raised GlassSurface card; MoodPicker-style emoji badge (read-only).
 * Side effects: onPress only.
 */
function DayStoryCard({ entry, onPress }: { entry: JournalEntry; onPress: () => void }) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const mood = getMoodDefinition(entry.mood);
  const moodKey = `mood.${mood.id}`;
  const moodLabel = t(moodKey);
  const preview = stripMarkdown(entry.body).slice(0, 140);
  const photos = entry.photoUris.slice(0, 6);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={entry.title}>
      <GlassSurface style={styles.storyCard} radius={groupedRadius}>
        <View style={styles.storyTop}>
          <View style={[styles.moodBadge, { backgroundColor: colors.mood[mood.id] }]}>
            <Text style={styles.moodGlyph}>{mood.emoji}</Text>
          </View>
          <View style={styles.storyHeadCopy}>
            <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={2}>
              {entry.title}
            </Text>
            <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
              {moodLabel !== moodKey ? moodLabel : mood.label}
              {entry.moodNote ? ` · ${entry.moodNote}` : ''}
            </Text>
          </View>
        </View>
        {preview ? (
          <Text style={[styles.storyBody, { color: colors.muted }]} numberOfLines={3}>
            {preview}
          </Text>
        ) : entry.kind === 'voice' ? (
          <Text style={[styles.storyBody, { color: colors.muted }]}>{t('voice.voicePage')}</Text>
        ) : null}
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
            {photos.map((uri) => (
              <JournalMediaImage key={uri} uri={uri} style={styles.photoThumb} thumbnail />
            ))}
          </ScrollView>
        ) : null}
      </GlassSurface>
    </Pressable>
  );
}

/**
 * Purpose: spend row for the day drawer — category icon, note, tabular money.
 * Inputs: expense + navigation press.
 * Outputs: raised card with amount using tabular-nums.
 * Side effects: onPress only.
 */
function DaySpendCard({ expense, onPress }: { expense: Expense; onPress: () => void }) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const amount = formatFriendlyMoney(expense.amount, expense.currency);
  const line = formatExpenseSpendLine(expense);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('money.editSpendA11y', { spend: line })}
    >
      <GlassSurface style={styles.note} radius={groupedRadius}>
        <View style={styles.noteRow}>
          <TypeIcon typeId={expense.category} accessibilityLabel={typeA11yLabel(t, expense.category)} />
          <View style={styles.noteCopy}>
            <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={2}>
              {expense.note?.trim() || typeA11yLabel(t, expense.category)}
            </Text>
            <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
              {typeA11yLabel(t, expense.category)}
            </Text>
          </View>
          <Text style={[styles.amount, { color: colors.ink }]}>{amount}</Text>
        </View>
      </GlassSurface>
    </Pressable>
  );
}

/**
 * Purpose: day-header write control — icon only so the date heading never clips.
 * Inputs: Ionicons name, accessibility label, press handler.
 * Outputs: 44pt raised accent-soft hit target.
 * Side effects: onPress only.
 */
function DayHeadAction({
  icon,
  label,
  onPress,
}: {
  icon: TypeIconName;
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[raisedSurface(colors, 14), styles.dayHeadAction, { backgroundColor: colors.accentSoft }]}
    >
      <Ionicons name={icon} size={22} color={colors.accent} accessible={false} importantForAccessibility="no" />
    </Pressable>
  );
}

/**
 * Purpose: empty-day quick add — Write / task / spend as equal neumorph chips.
 * Inputs: Ionicons name, visible + a11y label, press handler.
 * Outputs: raised chip with icon above short label (≥44pt).
 * Side effects: onPress only.
 */
function QuickActionChip({
  icon,
  label,
  onPress,
}: {
  icon: TypeIconName;
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const { scaleFontSize } = useTypography();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[raisedSurface(colors, 16), styles.quickChip, { backgroundColor: colors.accentSoft }]}
    >
      <Ionicons name={icon} size={22} color={colors.accent} accessible={false} importantForAccessibility="no" />
      <Text style={[styles.quickChipLabel, { color: colors.accent, fontSize: scaleFontSize(12) }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  monthNavBtn: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { fontFamily: fonts.display, flex: 1, minWidth: 0, textAlign: 'center' },
  todayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, minWidth: 0, textAlign: 'center', fontFamily: fonts.bodySemi },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.285%',
    minWidth: 0,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dayNum: { fontFamily: fonts.bodyMedium },
  dots: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 5,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8, gap: 10 },
  dayHeadCopy: { flex: 1, minWidth: 0, gap: 8 },
  dayHeadAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  section: { fontFamily: fonts.display },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillLabel: { fontFamily: fonts.bodyMedium },
  empty: { fontFamily: fonts.body, marginTop: 4 },
  emptyBlock: { gap: 10, marginTop: 4 },
  emptyActions: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  quickChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 72,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickChipLabel: {
    fontFamily: fonts.bodyMedium,
    lineHeight: 15,
    textAlign: 'center',
    width: '100%',
  },
  block: { gap: 8, marginTop: 4 },
  blockTitle: {
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  storyCard: { padding: 14, gap: 10 },
  storyTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  moodBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodGlyph: { fontSize: 18 },
  storyHeadCopy: { flex: 1, minWidth: 0, gap: 2 },
  storyBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  photoStrip: { flexDirection: 'row', gap: 8 },
  photoThumb: { width: 56, height: 56, borderRadius: 10 },
  note: { padding: 14, gap: 4 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  noteCopy: { flex: 1, minWidth: 0, gap: 4 },
  habitHit: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 21 },
  meta: { fontFamily: fonts.body, fontSize: 12 },
  amount: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    lineHeight: 21,
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  blockAction: { alignSelf: 'flex-start', maxWidth: '100%', marginTop: 4 },
});
