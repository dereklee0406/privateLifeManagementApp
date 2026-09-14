import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFinance } from '../../controller/FinanceProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import { formatFriendlyMoney } from '../../model/finance/Expense';
import { listUpcomingMoney, type UpcomingMoneyItem } from '../../model/finance/upcomingMoney';
import { appHref } from '../../utils/navigation';
import { EmptyState } from '../components/EmptyState';
import { GlassSurface } from '../components/GlassSurface';
import { GroupedRow, GroupedSection } from '../components/GroupedList';
import { useI18n, type Translate } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { groupedRadius } from '../theme/tokens';

/**
 * Purpose: localize an Upcoming due chip (overdue / today / soon / later).
 * Inputs: translator + item.
 * Outputs: short status string.
 * Side effects: none.
 */
function localizeUpcomingStatus(t: Translate, item: UpcomingMoneyItem): string {
  if (item.status === 'overdue') {
    return t('home.dueOverdue');
  }
  if (item.status === 'today') {
    return t('date.today');
  }
  if (item.status === 'soon' && item.daysUntil === 1) {
    return t('date.tomorrow');
  }
  if (item.daysUntil > 0) {
    return t('home.dueInDays', { count: item.daysUntil });
  }
  return t('home.dueOverdue');
}

/**
 * Purpose: Wallet Upcoming — bills + subs due, then a Cards tool row (rebate engine stays reachable).
 * Inputs: cards, recurring spends, home currency; listUpcomingMoney in Model.
 * Outputs: grouped due list + Cards & rewards row. Empty stays empty.
 * Side effects: navigation to card form, Subscriptions, or Cards panel via onOpenCards.
 * Design decisions: default Wallet home. Daily coffee rules stay off this list. Cards is a tool,
 *   not a fifth equal segment, so the rebate cockpit is one tap away without hiding it.
 */
export function WalletUpcomingPanel({ onOpenCards }: { onOpenCards: () => void }) {
  const colors = useThemeColors();
  const router = useRouter();
  const { t } = useI18n();
  const { creditCards } = useReminders();
  const { recurringSpends } = useFinance();
  const { settings } = useSettings();
  const now = useMemo(
    () => new Date(),
    [creditCards.length, recurringSpends.length],
  );
  const items = useMemo(
    () => listUpcomingMoney(creditCards, recurringSpends, settings.defaultCurrency, now),
    [creditCards, recurringSpends, settings.defaultCurrency, now],
  );

  return (
    <View style={styles.stack}>
      {items.length === 0 ? (
        <GlassSurface style={styles.empty} radius={groupedRadius}>
          <EmptyState
            message={t('money.upcomingEmpty')}
            actionLabel={t('money.remindMe')}
            actionIcon="notifications-outline"
            onAction={() => router.push(appHref('/reminders/new'))}
          />
        </GlassSurface>
      ) : (
        <GroupedSection header={t('money.upcomingBills')}>
          {items.map((item) => {
            const amount =
              item.amount !== undefined && item.currency
                ? formatFriendlyMoney(item.amount, item.currency)
                : undefined;
            const kindLabel = item.kind === 'card' ? t('money.card') : t('money.tabSubscriptions');
            return (
              <GroupedRow
                key={`${item.kind}-${item.id}`}
                title={item.title}
                subtitle={[kindLabel, localizeUpcomingStatus(t, item), amount].filter(Boolean).join(' · ')}
                chevron
                onPress={() => router.push(appHref(item.href))}
              />
            );
          })}
        </GroupedSection>
      )}
      <GroupedSection header={t('money.section')}>
        <GroupedRow
          title={t('money.tabCards')}
          subtitle={t('money.paymentCardsHint')}
          chevron
          onPress={onOpenCards}
        />
      </GroupedSection>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
    paddingHorizontal: 20,
  },
  empty: {
    padding: 18,
  },
});
