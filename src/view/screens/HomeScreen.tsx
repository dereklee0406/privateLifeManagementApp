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
import { pickHomePhotoHighlight } from '../../model/journal/homePhotoHighlight';
import { suggestLifeReflection } from '../../model/life/reflectionCue';
import { computeWeeklyLifeSummary } from '../../model/life/weeklySummary';
import { resolveWeekStart } from '../../model/settings/AppSettings';
import { onThisDayMemories } from '../../model/journal/onThisDay';
import { nextUpCard } from '../../model/today/nextUp';
import { formatLongDate, formatMemoryDate, getDayPart } from '../../utils/dateUtils';
import { appHref } from '../../utils/navigation';
import { hapticSuccess } from '../../utils/haptics';
import { GlassSurface } from '../components/GlassSurface';
import { EmptyState } from '../components/EmptyState';
import { InlineHomeQuickAdd } from '../components/InlineHomeQuickAdd';
import { JournalMediaImage } from '../components/JournalMediaImage';
import { LargeTitle } from '../components/LargeTitle';
import { QuickMoodBar } from '../components/QuickMoodBar';
import { QuickSpendSheet } from '../components/QuickSpendSheet';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { TodayRecurringStrip } from '../components/TodayRecurringStrip';
import { WeekStatChips } from '../components/WeekStatChips';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, groupedRadius, raisedAccent, raisedSurface } from '../theme/tokens';
import { tabScenePaddingBottom, type } from '../theme/typography';
import { reminderTypeTextProps, reminderTypeTextStyle } from '../components/scalableLabel';
import { useI18n, localizeNextUpBadge, localizeWeeklyChips, localizeWeeklySummary } from '../i18n';

/**
 * Purpose: Today home — greeting, compact Write/Record/Spend capsule, fast loops, Next Up, week chips, photos.
 * Inputs: journal, reminders, finance, settings.
 * Outputs: a short first screen. No charts. No net worth.
 * Side effects: navigates to compose, voice, spend, search, reminder, card, memories, or a past page;
 *   1-tap completeReminder on Next Up when itemType is reminder.
 */
export function HomeScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { insights, entries } = useJournal();
  const { settings } = useSettings();
  const { reminders, creditCards, completeReminder } = useReminders();
  const { expenses, budgets } = useFinance();
  const { t, intlLocale } = useI18n();
  const [completingNext, setCompletingNext] = useState(false);
  const [quickSpendOpen, setQuickSpendOpen] = useState(false);
  const name = settings.writerName || t('home.defaultName');
  const greetingKey =
    getDayPart() === 'morning'
      ? 'home.greetingMorning'
      : getDayPart() === 'afternoon'
        ? 'home.greetingAfternoon'
        : getDayPart() === 'evening'
          ? 'home.greetingEvening'
          : 'home.greetingNight';
  const now = useMemo(() => new Date(), [entries.length, reminders.length, expenses.length]);
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
            <Text style={[type.footnote, styles.kicker, { color: colors.muted }]}>{formatLongDate(new Date(), intlLocale)}</Text>
            <LargeTitle title={t('home.title')} />
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/journal')}
            style={styles.searchHit}
            accessibilityLabel={t('home.searchA11y')}
          >
            <Ionicons name="search" size={22} color={colors.accent} />
          </Pressable>
        </View>
        <Text style={[type.title2, styles.hello, { color: colors.ink }]}>
          {t('home.hello', { greeting: t(greetingKey), name })}
        </Text>
        <Text style={[styles.tag, { color: colors.faint }]}>{t('home.tag')}</Text>

        <View style={[raisedSurface(colors, 22), styles.capsuleBar, { backgroundColor: colors.accentSoft }]}>
          <Pressable
            onPress={() => router.push('/compose?mode=text')}
            style={styles.capsuleHit}
            accessibilityLabel={t('common.write')}
          >
            <Ionicons name="create-outline" size={20} color={colors.accent} />
            <Text style={[styles.capsuleLabel, { color: colors.accent }]} numberOfLines={1}>
              {t('common.write')}
            </Text>
          </Pressable>
          <View style={[styles.capsuleDivider, { backgroundColor: colors.line }]} />
          <Pressable
            onPress={() => router.push('/compose?mode=voice')}
            style={styles.capsuleHit}
            accessibilityLabel={t('common.record')}
          >
            <Ionicons name="mic-outline" size={20} color={colors.accent} />
            <Text style={[styles.capsuleLabel, { color: colors.accent }]} numberOfLines={1}>
              {t('common.record')}
            </Text>
          </Pressable>
          <View style={[styles.capsuleDivider, { backgroundColor: colors.line }]} />
          <Pressable
            onPress={() => router.push('/expense/new')}
            style={styles.capsuleHit}
            accessibilityLabel={t('home.spend')}
          >
            <Ionicons name="wallet-outline" size={20} color={colors.accent} />
            <Text style={[styles.capsuleLabel, { color: colors.accent }]} numberOfLines={1}>
              {t('home.spend')}
            </Text>
          </Pressable>
        </View>

        <InlineHomeQuickAdd />
        <TodayRecurringStrip />
        <QuickMoodBar />

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
            onPress={() => router.push(`/compose?mode=text&prompt=${encodeURIComponent(cue.prompt)}`)}
          >
            <Text style={[styles.cue, { color: colors.muted }]}>{cue.line}</Text>
          </Pressable>
        ) : null}

        {insights.streakDays > 0 ? (
          <Text style={[styles.streak, { color: colors.faint }]}>
            {insights.streakDays === 1 ? t('home.streakOne') : t('home.streak', { count: insights.streakDays })}
          </Text>
        ) : null}
      </ScrollView>

      <Pressable
        onPress={() => setQuickSpendOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('spend.quickSpend')}
        style={[
          raisedAccent(colors, 28),
          styles.fab,
          { bottom: tabScenePaddingBottom(insets.bottom) + 12, right: 22 },
        ]}
      >
        <Ionicons name="flash" size={24} color={colors.accentInk} accessible={false} importantForAccessibility="no" />
      </Pressable>
      <QuickSpendSheet visible={quickSpendOpen} onClose={() => setQuickSpendOpen(false)} />
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
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  searchHit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  hello: {
    marginTop: 2,
    marginBottom: 4,
  },
  tag: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 24,
    marginTop: 8,
    marginBottom: 18,
  },
  capsuleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  capsuleHit: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  capsuleLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    flexShrink: 1,
  },
  capsuleDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
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
    marginTop: 16,
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
