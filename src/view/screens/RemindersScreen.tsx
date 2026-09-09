import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import { listTopCategories, matchesTopCategory, describeCategoryPath } from '../../model/reminders/categories';
import { resolveReminderTypes } from '../../model/reminders/reminderTypes';
import { groupRemindersByUpcoming } from '../../model/reminders/grouping';
import { describeRecurrence } from '../../model/reminders/describeRecurrence';
import { isReminderCompletedToday, type Reminder } from '../../model/reminders/Reminder';
import { formatUpcoming } from '../../utils/dateUtils';
import { appHref } from '../../utils/navigation';
import { hapticSuccess } from '../../utils/haptics';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { GroupedRow, GroupedSection } from '../components/GroupedList';
import { SectionActionButton } from '../components/SectionActionButton';
import { TypeIcon } from '../components/TypeIcon';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { iconForReminderType, iconIdForReminder, reminderTypeLabel } from '../icons/typeIcons';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { tabScenePaddingBottom, type } from '../theme/typography';

/**
 * Purpose: reminder list grouped by next fire, filterable by top category, with 1-tap complete.
 * Inputs: ReminderProvider; You → Reminder types for filter chips.
 * Outputs: iOS grouped list; create from templates; toggle enabled; complete checkbox + collapsed Completed.
 * Side effects: navigation, enable persistence, completeReminder / uncompleteReminder.
 */
export function RemindersScreen() {
  const { t, intlLocale } = useI18n();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { reminders, notificationsLive, setEnabled, completeReminder, uncompleteReminder } = useReminders();
  const { settings } = useSettings();
  const reminderTypes = useMemo(() => resolveReminderTypes(settings), [settings]);
  const [top, setTop] = useState<string | 'all'>('all');
  const [completedOpen, setCompletedOpen] = useState(false);
  const now = useMemo(() => new Date(), [reminders.length]);

  const topCategories = useMemo(() => listTopCategories(reminderTypes), [reminderTypes]);

  useEffect(() => {
    if (top !== 'all' && !topCategories.some((node) => node.id === top)) {
      setTop('all');
    }
  }, [top, topCategories]);

  const filtered = useMemo(
    () => reminders.filter((item) => matchesTopCategory(item.categoryPath, top)),
    [reminders, top],
  );
  const completedToday = useMemo(
    () => filtered.filter((item) => isReminderCompletedToday(item, now)),
    [filtered, now],
  );
  const active = useMemo(
    () => filtered.filter((item) => !isReminderCompletedToday(item, now)),
    [filtered, now],
  );
  const groups = useMemo(() => groupRemindersByUpcoming(active), [active]);

  const toggleComplete = async (reminder: Reminder) => {
    if (isReminderCompletedToday(reminder, now)) {
      await uncompleteReminder(reminder.id);
    } else {
      await completeReminder(reminder.id);
      await hapticSuccess();
    }
  };

  const renderCheckbox = (reminder: Reminder) => {
    const done = isReminderCompletedToday(reminder, now);
    return (
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
    );
  };

  return (
    <ScreenScaffold>
      <ScreenHeader
        title={t('reminder.listTitle')}
        trailingIcon="add"
        trailingLabel={t('common.add')}
        onTrailing={() => router.push(appHref('/reminders/new'))}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabScenePaddingBottom(insets.bottom) }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[type.subhead, { color: colors.muted }]}>{t('reminder.listLede')}</Text>
        {Platform.OS === 'web' || !notificationsLive ? (
          <Text style={[type.footnote, { color: colors.faint }]}>
            {Platform.OS === 'web' ? t('reminder.webNote') : t('reminder.allowNote')}
          </Text>
        ) : null}

        <View style={styles.quickActionRow}>
          <SectionActionButton
            icon="flame-outline"
            label={t('habits.streaksTitle')}
            onPress={() => router.push('/habits')}
          />
        </View>
        <View style={styles.filters}>
          <Chip label={t('common.all')} selected={top === 'all'} onPress={() => setTop('all')} />
          {topCategories.map((node) => (
            <Chip
              key={node.id}
              icon={iconForReminderType(node.id, reminderTypes)}
              label={reminderTypeLabel(t, node.id, reminderTypes)}
              selected={top === node.id}
              onPress={() => setTop(node.id)}
            />
          ))}
        </View>

        {groups.length === 0 && completedToday.length === 0 ? (
          <EmptyState
            message={t('reminder.empty')}
            actionLabel={t('reminder.addReminder')}
            actionIcon="add"
            onAction={() => router.push(appHref('/reminders/new'))}
          />
        ) : (
          <>
            {groups.map((group) => (
              <GroupedSection
                key={group.id}
                header={t(`reminder.group${group.id.charAt(0).toUpperCase()}${group.id.slice(1)}`)}
              >
                {group.items.map(({ reminder, fireAt }) => (
                  <GroupedRow
                    key={reminder.id}
                    leading={
                      <View style={styles.leadingRow}>
                        {renderCheckbox(reminder)}
                        <TypeIcon
                          typeId={iconIdForReminder(reminder.categoryPath, reminder.templateId)}
                          reminderTypes={reminderTypes}
                        />
                      </View>
                    }
                    title={reminder.title}
                    subtitle={`${describeCategoryPath(reminder.categoryPath, reminderTypes)} · ${describeRecurrence(reminder.recurrence)}${fireAt ? ` · ${formatUpcoming(fireAt, new Date(), intlLocale, { today: t('date.today'), tomorrow: t('date.tomorrow') })}` : ''}`}
                    onPress={() => router.push(appHref(`/reminders/${reminder.id}`))}
                    accessory={
                      <Switch
                        value={reminder.enabled}
                        onValueChange={(value) => void setEnabled(reminder.id, value)}
                        trackColor={{ false: colors.line, true: colors.accent }}
                        thumbColor={colors.scheme === 'dark' ? '#E4DDD4' : '#FFF8F2'}
                      />
                    }
                  />
                ))}
              </GroupedSection>
            ))}

            {completedToday.length > 0 ? (
              <GroupedSection
                header={`${t('reminder.completedToday')} · ${completedToday.length}`}
                footer={completedOpen ? undefined : t('reminder.completedHint')}
              >
                <Pressable
                  onPress={() => setCompletedOpen((value) => !value)}
                  style={styles.completedToggle}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: completedOpen }}
                  accessibilityLabel={t('reminder.completedToday')}
                >
                  <Text style={[styles.completedToggleLabel, { color: colors.accent }]}>
                    {completedOpen ? t('reminder.hideCompleted') : t('reminder.showCompleted')}
                  </Text>
                  <Ionicons
                    name={completedOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.accent}
                  />
                </Pressable>
                {completedOpen
                  ? completedToday.map((reminder) => (
                      <GroupedRow
                        key={reminder.id}
                        completed
                        leading={
                          <View style={styles.leadingRow}>
                            {renderCheckbox(reminder)}
                            <TypeIcon
                              typeId={iconIdForReminder(reminder.categoryPath, reminder.templateId)}
                              reminderTypes={reminderTypes}
                            />
                          </View>
                        }
                        title={reminder.title}
                        subtitle={describeCategoryPath(reminder.categoryPath, reminderTypes)}
                        onPress={() => router.push(appHref(`/reminders/${reminder.id}`))}
                      />
                    ))
                  : null}
              </GroupedSection>
            ) : null}
          </>
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 14 },
  quickActionRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  leadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedToggle: {
    minHeight: 44,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completedToggleLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
  },
});
