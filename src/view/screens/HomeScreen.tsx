import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import { nextUpCard } from '../../model/today/nextUp';
import { formatLongDate } from '../../utils/dateUtils';
import { appHref } from '../../utils/navigation';
import { hapticSuccess } from '../../utils/haptics';
import { GlassSurface } from '../components/GlassSurface';
import { EmptyState } from '../components/EmptyState';
import { HubCaptureFab } from '../components/HubCaptureFab';
import { LargeTitle } from '../components/LargeTitle';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { TodayFocusRow } from '../components/TodayFocusRow';
import { TodaySeasonHero } from '../components/TodaySeasonHero';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, groupedRadius, raisedSurface } from '../theme/tokens';
import { tabScenePaddingBottom, type } from '../theme/typography';
import { reminderTypeTextProps, reminderTypeTextStyle } from '../components/scalableLabel';
import { greetingKeyForHour, useI18n, localizeNextUpBadge } from '../i18n';

/**
 * Purpose: Today one-glance command — one Season score, one Next Up, one Focus goal.
 * Inputs: reminders, settings (name + currency); Season/Focus fetch their own providers.
 * Outputs: compact date + greeting, Season hero, Next Up (or add-reminder CTA), Focus if active.
 * Side effects: navigates to Journal search, settings, Next Up href, or new reminder;
 *   1-tap completeReminder on Next Up when itemType is reminder;
 *   shared HubCaptureFab opens Write / Spend / Habit.
 * Design decisions: subtract-first. Streak, prediction, mood, week chips, photos, on-this-day,
 *   reflection cue, and the recurring strip leave this screen so the three primitives fit one
 *   phone fold. Season math stays in computeSeasonRank. No 5-button action row. No Focus Session.
 */
export function HomeScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings } = useSettings();
  const { reminders, creditCards, completeReminder } = useReminders();
  const { t, intlLocale } = useI18n();
  const [completingNext, setCompletingNext] = useState(false);
  const now = useMemo(() => new Date(), [reminders.length, creditCards.length]);
  const headerDate = useMemo(() => formatLongDate(now, intlLocale), [now, intlLocale]);
  const writerName = settings.writerName.trim() || t('home.defaultName');
  const hello = t('home.hello', {
    greeting: t(greetingKeyForHour(now.getHours())),
    name: writerName,
  });
  const next = useMemo(
    () => nextUpCard(reminders, creditCards, settings.defaultCurrency, now),
    [reminders, creditCards, settings.defaultCurrency, now],
  );
  const nextBadge = useMemo(
    () => (next ? localizeNextUpBadge(t, next, intlLocale) : null),
    [next, t, intlLocale],
  );

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
            <LargeTitle title={hello} style={styles.hello} />
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

        <TodaySeasonHero />

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

        <TodayFocusRow />
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
    marginBottom: 12,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  dateLine: {
    marginBottom: 2,
    fontFamily: fonts.bodySemi,
  },
  hello: {
    marginBottom: 0,
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
});
