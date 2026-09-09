import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../../controller/FinanceProvider';
import { useJournal } from '../../controller/JournalProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import { expensesOnDay, monthSpendTotal } from '../../model/finance/financeStats';
import { formatMoney } from '../../model/finance/Expense';
import { formatExpenseSpendLine } from '../../model/finance/fx';
import { remindersOnDay } from '../../model/reminders/grouping';
import { toDayKey } from '../../utils/dateUtils';
import { appHref } from '../../utils/navigation';
import { useI18n } from '../i18n';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { EntryCard } from '../components/EntryCard';
import { GlassSurface } from '../components/GlassSurface';
import { LargeTitle } from '../components/LargeTitle';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SectionActionButton } from '../components/SectionActionButton';
import { TypeIcon } from '../components/TypeIcon';
import {
  CALENDAR_TYPE_ICON_SIZE,
  iconIdForReminder,
  typeA11yLabel,
  type TypeIconName,
} from '../icons/typeIcons';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, groupedRadius, raisedSurface } from '../theme/tokens';
import { tabScenePaddingBottom } from '../theme/typography';

type CalView = 'month' | 'timeline';

const PRIORITY_RANK: Record<string, number> = { urgent: 3, high: 2, normal: 1, low: 0 };

/**
 * Purpose: one Calendar tab for life events and money due dates.
 * Inputs: journal, reminders, expenses.
 * Outputs: view switcher — monthly grid, reminder agenda, journal day, timeline, money.
 * Side effects: navigation to compose, reminder, or spend — each as its own add, not a mixed form.
 */
export function CalendarScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, intlLocale } = useI18n();
  const { calendarMonth, adjacentMonth, entriesForDay, timelineFor, insights } = useJournal();
  const { reminders } = useReminders();
  const { expenses } = useFinance();
  const { settings } = useSettings();
  const todayKey = toDayKey(new Date());
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [view, setView] = useState<CalView>('month');

  const month = useMemo(
    () => calendarMonth(cursor.year, cursor.month, intlLocale),
    [calendarMonth, cursor.year, cursor.month, intlLocale],
  );
  const dayEntries = useMemo(() => entriesForDay(selectedDay), [entriesForDay, selectedDay]);
  const dayReminders = useMemo(() => remindersOnDay(reminders, selectedDay), [reminders, selectedDay]);
  const dayExpenses = useMemo(() => expensesOnDay(expenses, selectedDay), [expenses, selectedDay]);
  const monthSpent = monthSpendTotal(expenses, cursor.year, cursor.month, settings.defaultCurrency);
  const monthTimeline = useMemo(() => {
    const prefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`;
    return timelineFor()
      .map((section) => ({
        ...section,
        entries: section.entries.filter((entry) => {
          const key = toDayKey(new Date(entry.createdAt));
          return key.startsWith(prefix);
        }),
      }))
      .filter((section) => section.entries.length > 0);
  }, [timelineFor, cursor]);

  const reminderMark = (dayKey: string): { color: string; typeId: string } | null => {
    const rows = remindersOnDay(reminders, dayKey);
    if (rows.length === 0) {
      return null;
    }
    const top = rows.reduce((best, row) =>
      (PRIORITY_RANK[row.reminder.priority] ?? 0) > (PRIORITY_RANK[best.reminder.priority] ?? 0) ? row : best,
    );
    let color = colors.accent;
    if (top.reminder.priority === 'urgent') {
      color = colors.danger;
    } else if (top.reminder.priority === 'high') {
      color = '#E8B086';
    }
    return { color, typeId: iconIdForReminder(top.reminder.categoryPath, top.reminder.templateId) };
  };

  return (
    <ScreenScaffold>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: tabScenePaddingBottom(insets.bottom) }]}
        showsVerticalScrollIndicator={false}
      >
        <LargeTitle title={t('calendar.title')} />
        <ViewsSwitcher view={view} onChange={setView} />

        {insights.streakDays > 0 ? (
          <Text style={[styles.streakLine, { color: colors.faint }]}>
            {insights.streakDays === 1 ? t('calendar.writingDayOne') : t('calendar.writingDays', { count: insights.streakDays })}
            {monthSpent > 0 ? t('calendar.thisMonthSpend', { amount: formatMoney(monthSpent, settings.defaultCurrency) }) : ''}
          </Text>
        ) : null}

        <View style={styles.nav}>
          <Pressable
            onPress={() => setCursor((current) => adjacentMonth(current.year, current.month, -1))}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={[raisedSurface(colors, 14), styles.monthNavBtn, { backgroundColor: colors.accentSoft }]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.accent} accessible={false} importantForAccessibility="no" />
          </Pressable>
          <Text style={[styles.heading, { color: colors.ink }]} numberOfLines={2}>
            {month.heading}
          </Text>
          <Pressable
            onPress={() => setCursor((current) => adjacentMonth(current.year, current.month, 1))}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={[raisedSurface(colors, 14), styles.monthNavBtn, { backgroundColor: colors.accentSoft }]}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.accent} accessible={false} importantForAccessibility="no" />
          </Pressable>
        </View>

        {view === 'month' ? (
          <>
            <View style={styles.weekRow}>
              {month.weekdayLabels.map((label, index) => (
                <Text
                  key={`${label}-${index}`}
                  style={[styles.weekday, { color: colors.faint }]}
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
                const mark = reminderMark(cell.dayKey);
                const spent = expensesOnDay(expenses, cell.dayKey).length > 0;
                return (
                  <Pressable
                    key={cell.dayKey}
                    onPress={() => setSelectedDay(cell.dayKey)}
                    style={[
                      styles.cell,
                      selected ? raisedSurface(colors, 14) : null,
                      {
                        opacity: cell.inCurrentMonth ? 1 : 0.35,
                        backgroundColor: selected ? colors.accentSoft : 'transparent',
                      },
                    ]}
                  >
                    <Text style={[styles.dayNum, { color: cell.dayKey === todayKey ? colors.accent : colors.ink }]}>
                      {cell.dayOfMonth}
                    </Text>
                    <View style={styles.dots}>
                      <View style={[styles.dot, { backgroundColor: cell.mood ? colors.mood[cell.mood] : 'transparent' }]} />
                      {mark ? (
                        <TypeIcon typeId={mark.typeId} size={CALENDAR_TYPE_ICON_SIZE} color={mark.color} />
                      ) : (
                        <View style={[styles.dot, { backgroundColor: 'transparent' }]} />
                      )}
                      <View style={[styles.dot, { backgroundColor: spent ? colors.climate.stress : 'transparent' }]} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {view === 'timeline' ? (
          monthTimeline.map((section) => (
            <View key={section.bucket} style={styles.block}>
              <Text style={[styles.section, { color: colors.ink }]}>{section.label}</Text>
              {section.entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} onPress={() => router.push(`/entry/${entry.id}`)} />
              ))}
            </View>
          ))
        ) : null}

        {view === 'month' ? (
          <>
            <View style={styles.dayHead}>
              <Text style={[styles.section, { color: colors.ink }]} numberOfLines={2}>
                {selectedDay}
              </Text>
              <DayHeadAction
                icon="create-outline"
                label={t('common.write')}
                onPress={() => router.push(`/compose?date=${selectedDay}`)}
              />
            </View>
            {dayEntries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} onPress={() => router.push(`/entry/${entry.id}`)} />
            ))}
            {dayEntries.length === 0 && dayReminders.length === 0 && dayExpenses.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Text style={[styles.empty, { color: colors.faint }]}>{t('calendar.emptyMonth')}</Text>
                <View style={styles.emptyActions}>
                  <QuickActionChip
                    icon="create-outline"
                    label={t('common.write')}
                    onPress={() => router.push(`/compose?date=${selectedDay}`)}
                  />
                  <QuickActionChip
                    icon="notifications-outline"
                    label={t('calendar.addReminder')}
                    onPress={() => router.push(appHref('/reminders/new'))}
                  />
                  <QuickActionChip
                    icon="wallet-outline"
                    label={t('calendar.addSpend')}
                    onPress={() => router.push(appHref(`/expense/new?date=${selectedDay}`))}
                  />
                </View>
              </View>
            ) : null}
            {dayReminders.map(({ reminder, fireAt }) => (
              <Pressable key={reminder.id} onPress={() => router.push(appHref(`/reminders/${reminder.id}`))}>
                <GlassSurface style={styles.note} radius={groupedRadius}>
                  <View style={styles.noteRow}>
                    <TypeIcon typeId={iconIdForReminder(reminder.categoryPath, reminder.templateId)} />
                    <View style={styles.noteCopy}>
                      <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={2}>
                        {reminder.title}
                      </Text>
                      <Text style={[styles.meta, { color: colors.muted }]}>
                        {fireAt ? `${fireAt.getHours()}:${String(fireAt.getMinutes()).padStart(2, '0')}` : t('calendar.sometime')}
                        {reminder.note ? ` · ${reminder.note}` : ''}
                      </Text>
                    </View>
                  </View>
                </GlassSurface>
              </Pressable>
            ))}
            {dayExpenses.map((expense) => (
              <Pressable
                key={expense.id}
                onPress={() => router.push(appHref(`/expense/${expense.id}`))}
                accessibilityLabel={`Edit spend ${formatExpenseSpendLine(expense)}`}
              >
                <GlassSurface style={styles.note} radius={groupedRadius}>
                  <View style={styles.noteRow}>
                    <TypeIcon typeId={expense.category} accessibilityLabel={typeA11yLabel(t, expense.category)} />
                    <Text style={[styles.rowTitle, { color: colors.ink, flex: 1, minWidth: 0 }]}>
                      {formatExpenseSpendLine(expense)}
                    </Text>
                  </View>
                </GlassSurface>
              </Pressable>
            ))}
            {dayReminders.length > 0 ? (
              <SectionActionButton
                icon="list-outline"
                label={t('calendar.openAllReminders')}
                onPress={() => router.push('/(tabs)/calendar/reminders')}
                style={styles.blockAction}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </ScreenScaffold>
  );
}

function ViewsSwitcher({ view, onChange }: { view: CalView; onChange: (next: CalView) => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.viewsBar}>
      <Chip
        icon="calendar-outline"
        label={t('calendar.monthly')}
        selected={view === 'month'}
        onPress={() => onChange('month')}
      />
      <Chip
        icon="time-outline"
        label={t('calendar.timeline')}
        selected={view === 'timeline'}
        onPress={() => onChange('timeline')}
      />
    </View>
  );
}

/**
 * Purpose: day-header add control — icon only so the date never clips beside long copy.
 * Inputs: Ionicons name, accessibility label, press handler.
 * Outputs: 44pt raised accent-soft hit target.
 * Side effects: onPress only.
 * Design decisions: matches Home / Money SF outline icons; label stays VoiceOver-only.
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
 * Purpose: empty-day quick add — Write / reminder / spend as equal neumorph chips.
 * Inputs: Ionicons name, visible + a11y label, press handler.
 * Outputs: raised chip with icon above short label (≥44pt).
 * Side effects: onPress only.
 * Design decisions: three flex columns so long locales wrap under the glyph instead of clipping the date row.
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[raisedSurface(colors, 16), styles.quickChip, { backgroundColor: colors.accentSoft }]}
    >
      <Ionicons name={icon} size={22} color={colors.accent} accessible={false} importantForAccessibility="no" />
      <Text style={[styles.quickChipLabel, { color: colors.accent }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 10 },
  viewsBar: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  streakLine: { fontFamily: fonts.body, fontSize: 14, marginBottom: 4 },
  empty: { fontFamily: fonts.body, fontSize: 15, marginTop: 4 },
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
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
    width: '100%',
  },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  monthNavBtn: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, flex: 1, minWidth: 0, textAlign: 'center' },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, minWidth: 0, textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.285%',
    minWidth: 0,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dayNum: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  dots: { flexDirection: 'row', gap: 2, marginTop: 4, alignItems: 'center', minHeight: 12 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8, gap: 10 },
  dayHeadAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  section: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, flex: 1, minWidth: 0 },
  blockAction: { alignSelf: 'flex-start', maxWidth: '100%', marginTop: 4 },
  block: { gap: 10, marginTop: 8 },
  note: { padding: 14, gap: 4 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  noteCopy: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 21 },
  meta: { fontFamily: fonts.body, fontSize: 12 },
});
