import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../controller/FinanceProvider';
import { useJournal } from '../../controller/JournalProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import { overspentBudgets } from '../../model/finance/financeStats';
import { pickTodayPrediction } from '../../model/insights/predictions';
import { pickHomePhotoHighlight } from '../../model/journal/homePhotoHighlight';
import { suggestLifeReflection } from '../../model/life/reflectionCue';
import { computeWeeklyLifeSummary } from '../../model/life/weeklySummary';
import { resolveWeekStart } from '../../model/settings/AppSettings';
import { onThisDayMemories } from '../../model/journal/onThisDay';
import { nextUpCard } from '../../model/today/nextUp';
import { formatLongDate, formatMemoryDate } from '../../utils/dateUtils';
import { appHref } from '../../utils/navigation';
import { hapticSuccess } from '../../utils/haptics';
import { GlassSurface } from '../components/GlassSurface';
import { EmptyState } from '../components/EmptyState';
import { HubCaptureFab } from '../components/HubCaptureFab';
import { JournalMediaImage } from '../components/JournalMediaImage';
import { LargeTitle } from '../components/LargeTitle';
import { QuickMoodBar } from '../components/QuickMoodBar';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { TodayFocusRow } from '../components/TodayFocusRow';
import { TodayPredictionLine } from '../components/TodayPredictionLine';
import { TodayRecurringStrip } from '../components/TodayRecurringStrip';
import { TodaySeasonMark } from '../components/TodaySeasonMark';
import { WeekStatChips } from '../components/WeekStatChips';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, groupedRadius, raisedSurface } from '../theme/tokens';
import { tabScenePaddingBottom, type } from '../theme/typography';
import { reminderTypeTextProps, reminderTypeTextStyle } from '../components/scalableLabel';
import { greetingKeyForHour, useI18n, localizeNextUpBadge, localizeWeeklyChips, localizeWeeklySummary } from '../i18n';

/**
 * Purpose: Today command center — 30s ritual then below-fold memory.
 * Inputs: journal, reminders, finance, settings, goals (one compact Focus row), derived Season mark.
 * Outputs: greeting + streak + Season line + optional prediction, Next Up, due strip, one active Goal; mood / week / photos / on-this-day below.
 * Side effects: navigates to compose, spend, search, reminder, settings, memories, Rhythm Focus, Insights, or a past page;
 *   1-tap completeReminder on Next Up when itemType is reminder;
 *   shared HubCaptureFab opens Write / Spend / Habit.
 * Design decisions: capsule Write/Record/Spend and InlineHomeQuickAdd removed so capture is one FAB;
 *   Settings gear lives on this header (Insights cog may remain); memories stay below the fold;
 *   Focus is a compact row, not a second hero; Season is one muted line under the greeting;
 *   at most one prediction under Season (skipped when it is the Next Up item); no new pushes.
 */
export function HomeScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { insights, entries } = useJournal();
  const { settings } = useSettings();
  const { reminders, creditCards, completeReminder } = useReminders();
  const { expenses, budgets, recurringSpends } = useFinance();
  const { t, intlLocale } = useI18n();
  const [completingNext, setCompletingNext] = useState(false);
  const now = useMemo(() => new Date(), [entries.length, reminders.length, expenses.length]);
  const headerDate = useMemo(() => formatLongDate(now, intlLocale), [now, intlLocale]);
  const writerName = settings.writerName.trim() || t('home.defaultName');
  const hello = t('home.hello', {
    greeting: t(greetingKeyForHour(now.getHours())),
    name: writerName,
  });
  const weekStartsOn = resolveWeekStart(settings);
  const next = useMemo(
    () => nextUpCard(reminders, creditCards, settings.defaultCurrency, now),
    [reminders, creditCards, settings.defaultCurrency, now],
  );
  const nextBadge = useMemo(
    () => (next ? localizeNextUpBadge(t, next, intlLocale) : null),
    [next, t, intlLocale],
  );
  const week = useMemo(
    () =>
      computeWeeklyLifeSummary(
        entries,
        expenses,
        reminders,
        settings.defaultCurrency,
        now,
        creditCards,
        weekStartsOn,
      ),
    [entries, expenses, reminders, settings.defaultCurrency, now, creditCards, weekStartsOn],
  );
  const weekChips = useMemo(() => localizeWeeklyChips(t, week), [t, week]);
  const weekCopy = useMemo(() => localizeWeeklySummary(t, week), [t, week]);
  const photoHighlight = useMemo(
    () => pickHomePhotoHighlight(entries, now, weekStartsOn),
    [entries, now, weekStartsOn],
  );
  const memories = useMemo(() => onThisDayMemories(entries, now), [entries, now]);
  const budgetOver =
    overspentBudgets(budgets, expenses, now.getFullYear(), now.getMonth(), settings.defaultCurrency).length > 0;
  const cue = suggestLifeReflection(week.daysWritten, budgetOver, now);
  const prediction = useMemo(
    () =>
      pickTodayPrediction({
        reminders,
        creditCards,
        recurringSpends,
        expenses,
        budgets,
        journalDaysWrittenThisWeek: week.daysWritten,
        currency: settings.defaultCurrency,
        now,
        nextUp: next,
      }),
    [reminders, creditCards, recurringSpends, expenses, budgets, week.daysWritten, settings.defaultCurrency, now, next],
  );

  const photoSourceLabel =
    photoHighlight?.source === 'onThisDay'
      ? t('home.photoFromThisDay')
      : photoHighlight?.source === 'thisWeek'
        ? t('home.photoFromWeek')
        : t('home.photoHighlight');

  const onCompleteNext = async () => {
    if (!next || next.itemType !== 'reminder' || completingNext) {
      return;
    }
    setCompletingNext(true);
    try {
      await completeReminder(next.id);
      await hapticSuccess();
    } finally {
      setCompletingNext(false);
    }
  };

  return (
    <ScreenScaffold>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: tabScenePaddingBottom(insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            <Text style={[type.footnote, styles.dateLine, { color: colors.muted }]}>{headerDate}</Text>
            <LargeTitle title={hello} />
            {insights.streakDays > 0 ? (
              <Text style={[styles.streak, { color: colors.muted }]}>
                {insights.streakDays === 1 ? t('home.streakOne') : t('home.streak', { count: insights.streakDays })}
              </Text>
            ) : null}
            <TodaySeasonMark />
            {prediction ? <TodayPredictionLine prediction={prediction} /> : null}
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/(tabs)/journal')}
              style={({ pressed }) => [
                raisedSurface(colors, 14),
                styles.iconButton,
                {
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('home.searchA11y')}
            >
              <Ionicons name="search" size={20} color={colors.ink} />
            </Pressable>
            <Pressable
              onPress={() => router.push(appHref('/settings'))}
              style={({ pressed }) => [
                raisedSurface(colors, 14),
                styles.iconButton,
                {
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('tabs.settings')}
            >
              <Ionicons name="settings-outline" size={20} color={colors.ink} accessible={false} importantForAccessibility="no" />
            </Pressable>
          </View>
        </View>

        {next && nextBadge ? (
          <GlassSurface style={styles.weekCard} radius={groupedRadius}>
            <Text style={[styles.stripLabel, { color: colors.accent }]}>{t('home.nextUp')}</Text>
            <View style={styles.nextRow}>
              <Pressable
                onPress={() => router.push(appHref(next.href))}
                style={styles.nextMain}
                accessibilityLabel={`Next up, ${next.title}, ${nextBadge.label}`}
              >
                <View style={styles.nextTitleRow}>
                  <Text style={[styles.weekCopy, styles.nextTitle, { color: colors.ink }]} {...reminderTypeTextProps(2)}>
                    {next.title}
                  </Text>
                  <View
                    style={[
                      raisedSurface(colors, 14),
                      styles.dueBadge,
                      next.dueStatus === 'overdue' ? { backgroundColor: colors.accentSoft } : null,
                    ]}
                  >
                    <Ionicons
                      name={nextBadge.icon}
                      size={14}
                      color={next.dueStatus === 'overdue' ? colors.danger : colors.accent}
                      accessible={false}
                    />
                    <Text
                      style={[
                        styles.dueBadgeLabel,
                        { color: next.dueStatus === 'overdue' ? colors.danger : colors.accent },
                      ]}
                      numberOfLines={1}
                    >
                      {nextBadge.label}
                    </Text>
                  </View>
                </View>
                {next.amountLabel ? (
                  <Text style={[styles.statusLine, { color: colors.muted }, reminderTypeTextStyle]} numberOfLines={1}>
                    {next.amountLabel}
                  </Text>
                ) : null}
              </Pressable>
              {next.itemType === 'reminder' && !next.isCompleted ? (
                <Pressable
                  onPress={() => void onCompleteNext()}
                  disabled={completingNext}
                  accessibilityRole="button"
                  accessibilityLabel={t('home.completeNextA11y', { title: next.title })}
                  style={[
                    styles.completeBtn,
                    {
                      borderColor: colors.accent,
                      opacity: completingNext ? 0.5 : 1,
                      backgroundColor: colors.accentSoft,
                    },
                  ]}
                >
                  <Ionicons name="checkmark" size={22} color={colors.accent} />
                </Pressable>
              ) : null}
            </View>
          </GlassSurface>
        ) : (
          <GlassSurface style={styles.weekCard} radius={groupedRadius}>
            <Text style={[styles.stripLabel, { color: colors.accent }]}>{t('home.nextUp')}</Text>
            <EmptyState
              message={t('home.nextUpEmpty')}
              actionLabel={t('home.addReminder')}
              actionIcon="notifications-outline"
              onAction={() => router.push(appHref('/reminders/new'))}
            />
          </GlassSurface>
        )}

        <TodayRecurringStrip />
        <TodayFocusRow />
        <QuickMoodBar />

        <GlassSurface style={styles.weekCard} radius={groupedRadius}>
          <Text style={[styles.stripLabel, { color: colors.accent }]}>{t('home.thisWeek')}</Text>
          <WeekStatChips chips={weekChips} />
          {weekChips.isQuiet ? (
            <Text style={[styles.quietHint, { color: colors.muted }]}>{weekCopy.compactCopy}</Text>
          ) : null}
        </GlassSurface>

        {photoHighlight ? (
          <Pressable
            onPress={() => router.push(appHref(`/entry/${photoHighlight.entryId}`))}
            accessibilityLabel={t('home.photoHighlightA11y')}
          >
            <GlassSurface style={styles.photoCard} radius={22}>
              <Text style={[styles.stripLabel, { color: colors.accent }]}>{photoSourceLabel}</Text>
              <View style={[raisedSurface(colors, 18), styles.photoFrame]}>
                <JournalMediaImage uri={photoHighlight.uri} style={styles.photoImage} />
              </View>
              <View style={styles.photoMeta}>
                <Text style={[styles.photoDate, { color: colors.muted }]}>
                  {formatMemoryDate(photoHighlight.createdAt, intlLocale)}
                </Text>
                <Text style={[styles.photoMood, { color: colors.ink }]} numberOfLines={2}>
                  {photoHighlight.moodEmoji} {t(`mood.${photoHighlight.mood}`)}
                  {photoHighlight.moodNote ? ` · ${photoHighlight.moodNote}` : ''}
                </Text>
              </View>
            </GlassSurface>
          </Pressable>
        ) : null}

        {memories.length > 0 ? (
          <View style={styles.memoryBlock}>
            <Text style={[styles.stripLabel, { color: colors.accent }]}>{t('home.onThisDay')}</Text>
            {memories.map((item) => (
              <Pressable
                key={item.entry.id}
                onPress={() => router.push(`/entry/${item.entry.id}`)}
                accessibilityLabel={`${item.label}, ${item.title}`}
              >
                <GlassSurface style={styles.memoryCard} radius={20}>
                  <View style={styles.memoryCopy}>
                    <Text style={[styles.memoryWhen, { color: colors.muted }]}>{item.label}</Text>
                    <Text style={[styles.memoryTitle, { color: colors.ink }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={[styles.memoryMood, { color: colors.faint }]} numberOfLines={2}>
                      {item.moodEmoji} {item.moodLabel}
                      {item.entry.moodNote ? ` · ${item.entry.moodNote}` : ''}
                    </Text>
                  </View>
                  {item.hasPhoto && item.entry.photoUris[0] ? (
                    <JournalMediaImage uri={item.entry.photoUris[0]} style={styles.memoryThumb} />
                  ) : null}
                </GlassSurface>
              </Pressable>
            ))}
          </View>
        ) : null}

        {cue ? (
          <Pressable
            onPress={() =>
              router.push(`/compose?mode=text&prompt=${encodeURIComponent(t(`prompts.${cue.promptId}`))}`)
            }
          >
            <Text style={[styles.cue, { color: colors.muted }]}>{cue.line}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <HubCaptureFab />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 22,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  dateLine: {
    marginBottom: 2,
    fontFamily: fonts.bodySemi,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekCard: {
    padding: 18,
    gap: 10,
    marginBottom: 14,
  },
  stripLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  weekCopy: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    minWidth: 0,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nextMain: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  nextTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  nextTitle: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 100,
  },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    maxWidth: '100%',
  },
  dueBadgeLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    lineHeight: 16,
  },
  completeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLine: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    minWidth: 0,
  },
  quietHint: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  photoCard: {
    padding: 16,
    gap: 10,
    marginBottom: 14,
  },
  photoFrame: {
    padding: 4,
  },
  photoImage: {
    width: '100%',
    height: 200,
    borderRadius: 14,
  },
  photoMeta: {
    gap: 4,
  },
  photoDate: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    lineHeight: 18,
  },
  photoMood: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  memoryBlock: {
    gap: 10,
    marginBottom: 8,
  },
  memoryCard: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memoryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  memoryWhen: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    lineHeight: 18,
  },
  memoryTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    lineHeight: 22,
  },
  memoryMood: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  memoryThumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  cue: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  streak: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
});
