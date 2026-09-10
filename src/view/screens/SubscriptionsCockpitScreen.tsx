import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../../controller/FinanceProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import { formatMoney, resolveExpenseCategories, type ExpenseCategoryConfig } from '../../model/finance/Expense';
import {
  calculateAnnualBurn,
  calculateMonthlyBurn,
  calculateNextRenewalDate,
  computeSubscriptionsSummary,
  daysUntilRenewal,
  type SubscriptionSummaryItem,
} from '../../model/finance/subscriptionCockpit';
import {
  resolveRecurringSpendFrequency,
  type RecurringSpend,
} from '../../model/finance/recurringSpend';
import { formatShortDate, toDayKey } from '../../utils/dateUtils';
import { hapticSuccess } from '../../utils/haptics';
import { appHref } from '../../utils/navigation';
import { EmptyState } from '../components/EmptyState';
import { GlassSurface } from '../components/GlassSurface';
import { KeyboardDismissScrollView } from '../components/KeyboardDismissScrollView';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SpendCardBadge } from '../components/SpendCardBadge';
import { TypeIcon } from '../components/TypeIcon';
import { expenseCategoryLabel, iconForExpenseCategory } from '../icons/typeIcons';
import { useI18n, type Translate } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface } from '../theme/tokens';
import { tabScenePaddingBottom } from '../theme/typography';
import { useTypography } from '../theme/TypographyProvider';

interface SubscriptionsCockpitScreenProps {
  /** When true, omit ScreenScaffold/header/sticky chrome for embedding in Money hub. */
  embedded?: boolean;
}

/**
 * Purpose: format a renewal countdown badge for the upcoming strip.
 * Inputs: daysUntilRenewal, translator.
 * Outputs: localized renews-today / tomorrow / in-N-days string.
 * Side effects: none.
 */
function renewalBadgeLabel(days: number, t: Translate): string {
  if (days <= 0) {
    return t('subscriptions.renewsToday');
  }
  if (days === 1) {
    return t('subscriptions.renewsTomorrow');
  }
  return t('subscriptions.renewsInDays', { days });
}

/**
 * Purpose: display title for a recurring contract (note or category fallback).
 * Inputs: RecurringSpend, translator, expense catalog.
 * Outputs: girlfriend-simple row title.
 * Side effects: none.
 */
function subscriptionTitle(
  item: RecurringSpend,
  t: Translate,
  catalog: ExpenseCategoryConfig[],
): string {
  const note = item.note?.trim();
  if (note) {
    return note;
  }
  return expenseCategoryLabel(t, item.category, catalog);
}

/**
 * Purpose: open the spend composer prefilled from a recurring rule.
 * Inputs: router + rule fields.
 * Outputs: navigation side effect only.
 * Side effects: router.push to /expense/new with query params.
 */
function openRecurringComposer(
  router: ReturnType<typeof useRouter>,
  rule: RecurringSpend,
): void {
  router.push(
    appHref(
      `/expense/new?category=${rule.category}&amount=${rule.amount}&note=${encodeURIComponent(rule.note ?? '')}&recurringId=${rule.id}`,
    ),
  );
}

/**
 * Purpose: Money → Subscriptions cockpit — burn hero, renewal strip, card allocation, full list.
 * Inputs: Finance recurringSpends + logRecurringSpendInstant; Reminder creditCards; settings currency;
 *   optional `embedded` for Money hub segment (no stack chrome).
 * Outputs: ScreenHeader + scrollable neumorph sections + sticky Add CTA (standalone), or
 *   scroll-only body with inline Add CTA when embedded under the floating tab bar.
 * Side effects: navigation; optional 1-tap log via FinanceProvider; success haptic.
 * Design decisions: pure burn/renewal math stays in subscriptionCockpit; View formats and
 *   orchestrates only. Empty list uses EmptyState; sticky PrimaryButton mirrors card edit chrome
 *   only on the pushed route so the Money tab keeps its floating tab bar.
 */
export function SubscriptionsCockpitScreen({ embedded = false }: SubscriptionsCockpitScreenProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, intlLocale } = useI18n();
  const { type } = useTypography();
  const { settings } = useSettings();
  const { recurringSpends, logRecurringSpendInstant } = useFinance();
  const { creditCards } = useReminders();
  const [loggingId, setLoggingId] = useState<string | null>(null);

  const currency = settings.defaultCurrency;
  const expenseCatalog = useMemo(() => resolveExpenseCategories(settings), [settings]);

  const summary = useMemo(
    () => computeSubscriptionsSummary(recurringSpends, creditCards, currency),
    [recurringSpends, creditCards, currency],
  );

  const allRows = useMemo((): SubscriptionSummaryItem[] => {
    return recurringSpends
      .map((item) => {
        const renewal = calculateNextRenewalDate(item);
        const cardName = item.cardId
          ? creditCards.find((card) => card.id === item.cardId)?.name
          : undefined;
        return {
          item,
          monthlyEquivalent: calculateMonthlyBurn(item),
          annualEquivalent: calculateAnnualBurn(item),
          nextRenewalDate: toDayKey(renewal),
          daysUntilRenewal: daysUntilRenewal(item),
          cardName,
        };
      })
      .sort((left, right) => left.daysUntilRenewal - right.daysUntilRenewal);
  }, [recurringSpends, creditCards]);

  const goAdd = useCallback(() => {
    router.push(appHref('/expense/new'));
  }, [router]);

  const onLogToday = useCallback(
    async (ruleId: string) => {
      if (loggingId) {
        return;
      }
      setLoggingId(ruleId);
      try {
        await logRecurringSpendInstant(ruleId);
        await hapticSuccess();
      } finally {
        setLoggingId(null);
      }
    },
    [loggingId, logRecurringSpendInstant],
  );

  const isEmpty = recurringSpends.length === 0;

  const body = isEmpty ? (
    <EmptyState
      message={t('subscriptions.emptyStateHint')}
      backdropIcon="repeat-outline"
    />
  ) : (
    <>
      <GlassSurface style={styles.hero} radius={24}>
        <Text style={[type.footnote, styles.kicker, { color: colors.faint }]}>
          {t('subscriptions.monthlyBurn')}
        </Text>
        <Text style={[styles.heroValue, { color: colors.ink }]}>
          {formatMoney(summary.totalMonthlyBurn, currency)}
        </Text>
        <Text style={[type.subhead, { color: colors.muted }]}>
          {t('subscriptions.perMonth')}
        </Text>
        <View style={styles.heroAnnualRow}>
          <Text style={[type.footnote, { color: colors.muted }]}>
            {t('subscriptions.annualBurn')}
          </Text>
          <Text style={[type.headline, styles.annualValue, { color: colors.ink }]}>
            {formatMoney(summary.totalAnnualBurn, currency)}
            <Text style={[type.footnote, { color: colors.muted }]}>
              {' '}
              {t('subscriptions.perYear')}
            </Text>
          </Text>
        </View>
        <View style={[insetSurface(colors, 14), styles.activeBadge]}>
          <Text style={[type.caption, styles.countBadge, { color: colors.accent }]}>
            {t('subscriptions.activeSubscriptions', { count: summary.activeCount })}
          </Text>
        </View>
      </GlassSurface>

      {summary.upcomingRenewals.length > 0 ? (
        <View style={styles.block}>
          <View style={styles.sectionHead}>
            <Ionicons name="time-outline" size={18} color={colors.ink} accessible={false} />
            <Text style={[type.title2, styles.sectionTitle, { color: colors.ink }]}>
              {t('subscriptions.upcomingRenewals')}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.renewalRow}
          >
            {summary.upcomingRenewals.map((row) => {
              const title = subscriptionTitle(row.item, t, expenseCatalog);
              const busy = loggingId === row.item.id;
              return (
                <GlassSurface key={row.item.id} style={styles.renewalCard} radius={18}>
                  <TypeIcon
                    typeId={row.item.category}
                    icon={iconForExpenseCategory(row.item.category, expenseCatalog)}
                  />
                  <Text style={[type.headline, { color: colors.ink }]} numberOfLines={2}>
                    {title}
                  </Text>
                  <View style={[insetSurface(colors, 12), styles.renewalPill]}>
                    <Text style={[type.caption, styles.countdown, { color: colors.accent }]} numberOfLines={1}>
                      {renewalBadgeLabel(row.daysUntilRenewal, t)}
                    </Text>
                  </View>
                  {row.cardName ? <SpendCardBadge name={row.cardName} /> : null}
                  <Pressable
                    onPress={() => void onLogToday(row.item.id)}
                    disabled={Boolean(loggingId)}
                    accessibilityRole="button"
                    accessibilityLabel={t('subscriptions.logTodayCharge')}
                    style={({ pressed }) => [
                      styles.logBtn,
                      {
                        backgroundColor: colors.accentSoft,
                        opacity: busy ? 0.55 : pressed ? 0.8 : 1,
                        transform: [{ scale: pressed && !busy ? 0.96 : 1 }],
                      },
                    ]}
                  >
                    <Ionicons name="add" size={16} color={colors.accent} accessible={false} />
                    <Text style={[type.footnote, styles.logBtnLabel, { color: colors.accent }]}>
                      {t('subscriptions.logTodayCharge')}
                    </Text>
                  </Pressable>
                </GlassSurface>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {summary.byCard.length > 0 ? (
        <View style={styles.block}>
          <View style={styles.sectionHead}>
            <Ionicons name="card-outline" size={18} color={colors.ink} accessible={false} />
            <Text style={[type.title2, styles.sectionTitle, { color: colors.ink }]}>
              {t('subscriptions.cardAllocation')}
            </Text>
          </View>
          <View style={styles.chipWrap}>
            {summary.byCard.map((row) => (
              <View key={row.cardId} style={[insetSurface(colors, 16), styles.cardChip]}>
                <Text style={[type.headline, { color: colors.ink }]} numberOfLines={1}>
                  {row.cardName}
                </Text>
                <Text style={[type.subhead, styles.cardChipAmount, { color: colors.muted }]} numberOfLines={1}>
                  {formatMoney(row.monthlyTotal, currency)}
                  {t('subscriptions.perMonth')}
                </Text>
                <Text style={[type.caption, styles.countBadge, { color: colors.faint }]}>
                  {t('subscriptions.activeSubscriptions', { count: row.count })}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.block}>
        <View style={styles.sectionHead}>
          <Ionicons name="repeat-outline" size={18} color={colors.ink} accessible={false} />
          <Text style={[type.title2, styles.sectionTitle, { color: colors.ink }]}>
            {t('subscriptions.allSubscriptions')}
          </Text>
        </View>
        <View style={styles.list}>
          {allRows.map((row) => {
            const freq = resolveRecurringSpendFrequency(row.item);
            const title = subscriptionTitle(row.item, t, expenseCatalog);
            const amountBadge = `${formatMoney(row.item.amount, row.item.currency)} · ${t(`spend.freq.${freq}`)}`;
            const renewalLabel = formatShortDate(`${row.nextRenewalDate}T12:00:00`, intlLocale);
            return (
              <Pressable
                key={row.item.id}
                onPress={() => openRecurringComposer(router, row.item)}
                accessibilityRole="button"
                accessibilityLabel={title}
              >
                <GlassSurface style={styles.rowCard} radius={18}>
                  <View style={styles.rowInner}>
                    <TypeIcon
                      typeId={row.item.category}
                      icon={iconForExpenseCategory(row.item.category, expenseCatalog)}
                    />
                    <View style={styles.rowCopy}>
                      <Text style={[type.headline, { color: colors.ink }]} numberOfLines={2}>
                        {title}
                      </Text>
                      <View style={[insetSurface(colors, 10), styles.amountPill]}>
                        <Text style={[type.caption, styles.amountBadge, { color: colors.muted }]} numberOfLines={1}>
                          {amountBadge}
                        </Text>
                      </View>
                      <Text style={[type.footnote, styles.renewalMeta, { color: colors.faint }]} numberOfLines={1}>
                        {renewalBadgeLabel(row.daysUntilRenewal, t)} · {renewalLabel}
                      </Text>
                      {row.cardName ? <SpendCardBadge name={row.cardName} /> : null}
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.faint}
                      accessible={false}
                    />
                  </View>
                </GlassSurface>
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );

  const addCta = (
    <PrimaryButton
      icon="add"
      label={t('subscriptions.addSubscription')}
      onPress={goAdd}
    />
  );

  if (embedded) {
    return (
      <KeyboardDismissScrollView
        style={styles.embeddedScroll}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: tabScenePaddingBottom(insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {body}
        {addCta}
      </KeyboardDismissScrollView>
    );
  }

  return (
    <ScreenScaffold>
      <ScreenHeader
        title={t('subscriptions.cockpitTitle')}
        trailingIcon="add"
        trailingLabel={t('subscriptions.addSubscription')}
        onTrailing={goAdd}
      />

      <KeyboardDismissScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, 16) + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {body}
      </KeyboardDismissScrollView>

      <View
        style={[
          styles.stickyFooter,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            backgroundColor: colors.paper,
            borderTopColor: colors.line,
          },
        ]}
      >
        {addCta}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  embeddedScroll: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  hero: {
    padding: 20,
    gap: 6,
  },
  kicker: {
    letterSpacing: 0.3,
  },
  heroValue: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  heroAnnualRow: {
    marginTop: 8,
    gap: 4,
  },
  annualValue: {
    fontVariant: ['tabular-nums'],
  },
  activeBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  countBadge: {
    fontVariant: ['tabular-nums'],
  },
  block: {
    gap: 10,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
  },
  renewalRow: {
    gap: 10,
    paddingVertical: 2,
    paddingRight: 8,
  },
  renewalCard: {
    width: 176,
    padding: 14,
    gap: 8,
  },
  renewalPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countdown: {
    fontVariant: ['tabular-nums'],
  },
  logBtn: {
    marginTop: 4,
    minHeight: 40,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  logBtnLabel: {
    fontFamily: fonts.bodySemi,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cardChip: {
    minWidth: 140,
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  cardChipAmount: {
    fontVariant: ['tabular-nums'],
  },
  list: {
    gap: 10,
  },
  rowCard: {
    padding: 16,
    minHeight: 56,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  amountPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  amountBadge: {
    fontVariant: ['tabular-nums'],
  },
  renewalMeta: {
    fontVariant: ['tabular-nums'],
  },
  stickyFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
