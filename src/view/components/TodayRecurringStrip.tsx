import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../controller/FinanceProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import { resolveExpenseCategories } from '../../model/finance/Expense';
import { resolveReminderTypes } from '../../model/reminders/reminderTypes';
import { isReminderCompletedToday } from '../../model/reminders/Reminder';
import { remindersOnDay } from '../../model/reminders/grouping';
import { recurringSpendChipLabel } from '../../model/finance/recurringSpend';
import { toDayKey } from '../../utils/dateUtils';
import { appHref } from '../../utils/navigation';
import { hapticSuccess } from '../../utils/haptics';
import { iconIdForReminder, iconForExpenseCategory } from '../icons/typeIcons';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, raisedSurface } from '../theme/tokens';
import { TypeIcon } from './TypeIcon';

type StripKind = 'spend' | 'reminder';

interface StripItem {
  key: string;
  kind: StripKind;
  id: string;
  title: string;
  typeId: string;
}

/**
 * Purpose: horizontal 1-tap strip for today’s due recurring spends and habits on Home.
 * Inputs: Finance dueRepeats + Reminder list (due today, not completed).
 * Outputs: neumorphic chips with check/add; temporary confirmation toast.
 * Side effects: logRecurringSpendInstant / completeReminder; hapticSuccess; optional navigate on long-press.
 * Design decisions: View only orchestrates providers — due logic stays in Model helpers.
 */
export function TodayRecurringStrip() {
  const colors = useThemeColors();
  const router = useRouter();
  const { t } = useI18n();
  const { dueRepeats, logRecurringSpendInstant } = useFinance();
  const { reminders, completeReminder, uncompleteReminder } = useReminders();
  const { settings } = useSettings();
  const reminderTypes = useMemo(() => resolveReminderTypes(settings), [settings]);
  const expenseCatalog = useMemo(() => resolveExpenseCategories(settings), [settings]);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<{ kind: StripKind; id: string } | null>(null);

  const now = useMemo(() => new Date(), [dueRepeats.length, reminders.length]);
  const todayKey = toDayKey(now);

  const dueReminders = useMemo(() => {
    return remindersOnDay(reminders, todayKey, now)
      .map((row) => row.reminder)
      .filter((item) => item.enabled && !isReminderCompletedToday(item, now));
  }, [reminders, todayKey, now]);

  const items = useMemo<StripItem[]>(() => {
    const spendItems: StripItem[] = dueRepeats.map((rule) => ({
      key: `spend-${rule.id}`,
      kind: 'spend',
      id: rule.id,
      title: recurringSpendChipLabel(rule),
      typeId: rule.category,
    }));
    const reminderItems: StripItem[] = dueReminders.map((reminder) => ({
      key: `reminder-${reminder.id}`,
      kind: 'reminder',
      id: reminder.id,
      title: reminder.title,
      typeId: iconIdForReminder(reminder.categoryPath, reminder.templateId),
    }));
    return [...spendItems, ...reminderItems];
  }, [dueRepeats, dueReminders]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const onTap = async (item: StripItem) => {
    if (busyId) {
      return;
    }
    setBusyId(item.id);
    try {
      if (item.kind === 'spend') {
        await logRecurringSpendInstant(item.id);
        setLastAction({ kind: 'spend', id: item.id });
        showToast(t('home.stripLogged'));
      } else {
        await completeReminder(item.id);
        setLastAction({ kind: 'reminder', id: item.id });
        showToast(t('home.stripDone'));
      }
      await hapticSuccess();
    } finally {
      setBusyId(null);
    }
  };

  const onUndo = async () => {
    if (!lastAction || lastAction.kind !== 'reminder') {
      setToast(null);
      setLastAction(null);
      return;
    }
    await uncompleteReminder(lastAction.id);
    setToast(null);
    setLastAction(null);
  };

  const onLongPress = (item: StripItem) => {
    if (item.kind === 'spend') {
      const rule = dueRepeats.find((row) => row.id === item.id);
      if (!rule) {
        return;
      }
      router.push(
        appHref(
          `/expense/new?category=${rule.category}&amount=${rule.amount}&note=${encodeURIComponent(rule.note ?? '')}&recurringId=${rule.id}`,
        ),
      );
      return;
    }
    router.push(appHref(`/reminders/${item.id}`));
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.accent }]}>{t('home.todayLoop')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((item) => {
          const busy = busyId === item.id;
          return (
            <Pressable
              key={item.key}
              onPress={() => void onTap(item)}
              onLongPress={() => onLongPress(item)}
              disabled={Boolean(busyId)}
              accessibilityRole="button"
              accessibilityLabel={
                item.kind === 'spend'
                  ? t('home.stripLogA11y', { title: item.title })
                  : t('home.stripCompleteA11y', { title: item.title })
              }
              style={[
                raisedSurface(colors, 18),
                styles.chip,
                { backgroundColor: colors.accentSoft, opacity: busy ? 0.55 : 1 },
              ]}
            >
              {item.kind === 'spend' ? (
                <TypeIcon
                  typeId={item.typeId}
                  icon={iconForExpenseCategory(item.typeId, expenseCatalog)}
                />
              ) : (
                <TypeIcon typeId={item.typeId} reminderTypes={reminderTypes} />
              )}
              <Text style={[styles.chipTitle, { color: colors.ink }]} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={[styles.check, { borderColor: colors.accent }]}>
                <Ionicons
                  name={item.kind === 'spend' ? 'add' : 'checkmark'}
                  size={16}
                  color={colors.accent}
                />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {toast ? (
        <View style={[raisedSurface(colors, 14), styles.toast, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.toastText, { color: colors.ink }]} numberOfLines={1}>
            {toast}
          </Text>
          {lastAction?.kind === 'reminder' ? (
            <Pressable onPress={() => void onUndo()} accessibilityRole="button" accessibilityLabel={t('home.undo')}>
              <Text style={[styles.undo, { color: colors.accent }]}>{t('home.undo')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    marginBottom: 16,
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  row: {
    gap: 10,
    paddingVertical: 2,
    paddingRight: 8,
  },
  chip: {
    minWidth: 148,
    maxWidth: 200,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toastText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 18,
  },
  undo: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
  },
});
