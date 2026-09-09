import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../../controller/FinanceProvider';
import { useJournal } from '../../controller/JournalProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { emptySearchInput } from '../../model/journal/journalSearch';
import { browseGlobalKind, searchGlobal, type GlobalSearchFilter, type GlobalSearchHit } from '../../model/search/globalSearch';
import { appHref } from '../../utils/navigation';
import { hapticLight } from '../../utils/haptics';
import { Chip } from '../components/Chip';
import { useI18n } from '../i18n';
import { EmptyState } from '../components/EmptyState';
import { EntryCard } from '../components/EntryCard';
import { GroupedRow, GroupedSection } from '../components/GroupedList';
import { LargeTitle } from '../components/LargeTitle';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SearchFilters } from '../components/SearchFilters';
import { TypeIcon } from '../components/TypeIcon';
import { iconIdForReminder, type TypeIconName } from '../icons/typeIcons';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, raisedSurface } from '../theme/tokens';
import { tabScenePaddingBottom, type } from '../theme/typography';

const KIND_CHIPS: Array<{ id: GlobalSearchFilter; label: string; icon: TypeIconName }> = [
  { id: 'all', label: 'All', icon: 'apps-outline' },
  { id: 'pages', label: 'Pages', icon: 'book-outline' },
  { id: 'reminders', label: 'Reminders', icon: 'notifications-outline' },
  { id: 'money', label: 'Money', icon: 'card-outline' },
];

/**
 * Purpose: Pages timeline plus one global search over pages, reminders, and spends.
 * Inputs: journal, reminders, finance; local filter form state.
 * Outputs: editorial header, timeline when All/Pages is idle; mixed hits when she types or picks Reminders/Money.
 * Side effects: navigation only (compose for write). Filtering lives in Model. Spend hits open that spend to edit.
 */
export function JournalScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { timelineFor, entries } = useJournal();
  const { reminders } = useReminders();
  const { expenses } = useFinance();
  const [query, setQuery] = useState(emptySearchInput());
  const [filter, setFilter] = useState<GlobalSearchFilter>('all');

  const sections = useMemo(() => timelineFor(query), [timelineFor, query]);
  const showGlobal =
    filter === 'reminders' || filter === 'money' || (filter === 'all' && Boolean(query.keywords.trim()));
  const hits = useMemo<GlobalSearchHit[]>(() => {
    if (!showGlobal) {
      return [];
    }
    if (query.keywords.trim()) {
      return searchGlobal({
        query: query.keywords,
        filter,
        entries,
        reminders,
        expenses,
      });
    }
    return browseGlobalKind(filter, reminders, expenses);
  }, [showGlobal, query.keywords, filter, entries, reminders, expenses]);

  const openHit = (hit: GlobalSearchHit) => {
    if (hit.kind === 'page') {
      router.push(`/entry/${hit.id}`);
      return;
    }
    if (hit.kind === 'reminder') {
      router.push(appHref(`/reminders/${hit.id}`));
      return;
    }
    router.push(appHref(`/expense/${hit.id}`));
  };

  const kindLabel = (kind: GlobalSearchHit['kind']): string => {
    if (kind === 'page') {
      return t('pages.kindPage');
    }
    if (kind === 'reminder') {
      return t('pages.kindReminder');
    }
    return t('pages.kindSpend');
  };

  const searching =
    Boolean(query.keywords) || query.mood || query.tags.length > 0 || query.datePreset !== 'any' || filter !== 'all';

  return (
    <ScreenScaffold>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: tabScenePaddingBottom(insets.bottom) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            <Text style={[type.footnote, styles.headerKicker, { color: colors.accent }]}>
              {t('pages.headerKicker')}
            </Text>
            <LargeTitle title={t('pages.headerTitle')} />
          </View>
          <Pressable
            onPress={() => {
              void hapticLight();
              router.push('/compose?mode=text');
            }}
            style={({ pressed }) => [
              raisedSurface(colors, 14),
              styles.newButton,
              {
                transform: [{ scale: pressed ? 0.94 : 1 }],
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('pages.writePage')}
          >
            <Ionicons name="create-outline" size={20} color={colors.ink} accessible={false} importantForAccessibility="no" />
          </Pressable>
        </View>
        <View style={styles.kinds}>
          {KIND_CHIPS.map((item) => (
            <Chip
              key={item.id}
              icon={item.icon}
              label={
                item.id === 'all'
                  ? t('common.all')
                  : item.id === 'pages'
                    ? t('pages.title')
                    : item.id === 'reminders'
                      ? t('pages.reminders')
                      : t('pages.money')
              }
              selected={filter === item.id}
              onPress={() => setFilter(item.id)}
            />
          ))}
        </View>
        <SearchFilters value={query} onChange={setQuery} />
        {showGlobal ? (
          hits.length === 0 ? (
            <EmptyState
              message={
                query.keywords.trim()
                  ? t('pages.emptySearch')
                  : t('pages.emptyBrowse')
              }
              actionLabel={query.keywords.trim() ? undefined : t('pages.writePage')}
              actionIcon={query.keywords.trim() ? undefined : 'create-outline'}
              onAction={query.keywords.trim() ? undefined : () => router.push('/compose?mode=text')}
            />
          ) : (
            <GroupedSection>
              {hits.map((hit) => {
                const reminder = hit.kind === 'reminder' ? reminders.find((row) => row.id === hit.id) : undefined;
                const expense = hit.kind === 'spend' ? expenses.find((row) => row.id === hit.id) : undefined;
                const typeId = reminder
                  ? iconIdForReminder(reminder.categoryPath, reminder.templateId)
                  : expense?.category;
                const snippet =
                  expense
                    ? [expense.note, expense.dayKey].filter(Boolean).join(' · ')
                    : hit.snippet;
                return (
                  <GroupedRow
                    key={`${hit.kind}-${hit.id}`}
                    leading={typeId ? <TypeIcon typeId={typeId} /> : undefined}
                    title={hit.title}
                    subtitle={snippet ? `${kindLabel(hit.kind)} · ${snippet}` : kindLabel(hit.kind)}
                    onPress={() => openHit(hit)}
                    chevron
                  />
                );
              })}
            </GroupedSection>
          )
        ) : sections.length === 0 ? (
          <View style={styles.emptyBlock}>
            <EmptyState
              message={searching ? t('pages.emptyFilter') : t('pages.emptyTimeline')}
              actionLabel={searching ? undefined : t('pages.writePage')}
              actionIcon={searching ? undefined : 'create-outline'}
              onAction={searching ? undefined : () => router.push('/compose?mode=text')}
            />
          </View>
        ) : (
          sections.map((section) => (
            <GroupedSection key={section.bucket} header={section.label}>
              {section.entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} grouped onPress={() => router.push(`/entry/${entry.id}`)} />
              ))}
            </GroupedSection>
          ))
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  headerKicker: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
    fontFamily: fonts.bodySemi,
  },
  newButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kinds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emptyBlock: {
    gap: 16,
    marginTop: 12,
  },
});
