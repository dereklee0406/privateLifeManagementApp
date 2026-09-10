import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../controller/FinanceProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import {
  activeExpenseCategories,
  formatFriendlyMoney,
  formatMoney,
  resolveExpenseCategories,
  type Expense,
  type ExpenseCategory,
  type ExpenseCategoryConfig,
} from '../../model/finance/Expense';
import {
  budgetProgressFor,
  expenseRangeFromPreset,
  filterExpenses,
  monthSnapshotFor,
  spendTrend,
  type ExpenseDatePreset,
} from '../../model/finance/financeStats';
import { computeNetWorth } from '../../model/finance/netWorth';
import { quickAddCategoryIds } from '../../model/finance/expenseCategories';
import { recurringSpendChipLabel } from '../../model/finance/recurringSpend';
import { computeMonthSpendInsight } from '../../model/finance/monthInsights';
import { ESTIMATE_CURRENCY, formatExpenseSpendLine, hasExpenseFxSnapshot } from '../../model/finance/fx';
import { summarizeSplit, type ExpenseSplit } from '../../model/finance/ExpenseSplit';
import { resolveShowAdvancedFinance, resolveCardFxFeeRate } from '../../model/settings/AppSettings';
import { budgetMonthFromDate, dateFromBudgetMonth } from '../../controller/dateFieldValue';
import { formatShortDate, isoAtLocalNoon, toDayKey } from '../../utils/dateUtils';
import { appHref } from '../../utils/navigation';
import { hapticLight, hapticSuccess } from '../../utils/haptics';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { DateField } from '../components/DateField';
import { GlassSurface } from '../components/GlassSurface';
import { HubCaptureFab } from '../components/HubCaptureFab';
import { HubSegmentControl, type HubSegmentOption } from '../components/HubSegmentControl';
import { QuickSpendSheet } from '../components/QuickSpendSheet';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SectionActionButton } from '../components/SectionActionButton';
import { SpendCardBadge } from '../components/SpendCardBadge';
import { SpendTrendBars } from '../components/SpendTrendBars';
import { LargeTitle } from '../components/LargeTitle';
import { TypeIcon } from '../components/TypeIcon';
import { iconForExpenseCategory, expenseCategoryLabel, type TypeIconName } from '../icons/typeIcons';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface, raisedAccent, raisedSurface, type ThemeColors } from '../theme/tokens';
import { tabScenePaddingBottom, type } from '../theme/typography';
import { useI18n, type Translate } from '../i18n';
import { PaymentCardsScreen } from './PaymentCardsScreen';
import { SubscriptionsCockpitScreen } from './SubscriptionsCockpitScreen';
import { WalletWorthPanel } from './WalletWorthPanel';

type MoneyHubSegment = 'cashflow' | 'subscriptions' | 'cards' | 'worth';
type MoneyFocus = 'all' | 'income' | 'expenses' | 'transfers' | 'budgets';

/**
 * Purpose: parse deep-link / tab search param into a Money hub segment.
 * Inputs: raw `segment` query (string | string[] | undefined).
 * Outputs: MoneyHubSegment or null when absent / unknown.
 * Side effects: none.
 */
function parseMoneySegment(raw: string | string[] | undefined): MoneyHubSegment | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'cashflow' || value === 'subscriptions' || value === 'cards' || value === 'worth') {
    return value;
  }
  return null;
}

/**
 * Purpose: pending-split footnote for a spend row when collections remain.
 * Inputs: optional split, translator.
 * Outputs: `split.splitBadge` copy, or empty when settled / absent.
 * Side effects: none.
 */
function spendSplitLabel(split: ExpenseSplit | undefined, t: Translate): string {
  if (!split) {
    return '';
  }
  const summary = summarizeSplit(split);
  if (summary.allSettled || summary.pendingAmount <= 0) {
    return '';
  }
  return t('split.splitBadge', {
    pending: formatFriendlyMoney(summary.pendingAmount, split.currency),
  });
}

/**
 * Purpose: cluster already-sorted spends into consecutive day buckets for list headers.
 * Inputs: expenses newest-day-first (same order as `filterExpenses`).
 * Outputs: [{ dayKey, items }] preserving input order.
 * Side effects: none.
 */
function groupSpendsByDay(items: Expense[]): { dayKey: string; items: Expense[] }[] {
  const groups: { dayKey: string; items: Expense[] }[] = [];
  for (const item of items) {
    const tail = groups[groups.length - 1];
    if (tail && tail.dayKey === item.dayKey) {
      tail.items.push(item);
    } else {
      groups.push({ dayKey: item.dayKey, items: [item] });
    }
  }
  return groups;
}

/**
 * Purpose: day-group heading — Today / Yesterday / localized short date.
 * Inputs: YYYY-MM-DD key, now, Intl locale, translator.
 * Outputs: `date.today`, `date.yesterday`, or `formatShortDate` (e.g. 9 Sep).
 * Side effects: none.
 * Design decisions: reuses catalog keys + dateUtils; no English-only fallbacks in the view.
 */
function spendDayHeading(dayKey: string, now: Date, intlLocale: string, t: Translate): string {
  if (dayKey === toDayKey(now)) {
    return t('date.today');
  }
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey === toDayKey(yesterday)) {
    return t('date.yesterday');
  }
  return formatShortDate(isoAtLocalNoon(dayKey), intlLocale);
}

/**
 * Purpose: glanceable “what” for a spend — merchant/note wins, else localized category.
 * Inputs: expense, already-localized category label.
 * Outputs: single primary title string.
 * Side effects: none.
 */
function spendPrimaryTitle(item: Expense, categoryLabel: string): string {
  const note = item.note?.trim();
  return note || categoryLabel;
}

/**
 * Purpose: muted FX estimate line under a foreign amount (`≈ HK$7.92`).
 * Inputs: saved expense with optional locked snapshot.
 * Outputs: estimate string, or undefined for HKD / missing lock.
 * Side effects: none.
 * Design decisions: `≈` is a symbol, not copy; amount uses `formatFriendlyMoney`.
 */
function spendFxEstimateLine(item: Expense): string | undefined {
  if (!hasExpenseFxSnapshot(item) || item.homeAmount === undefined) {
    return undefined;
  }
  return `≈ ${formatFriendlyMoney(item.homeAmount, ESTIMATE_CURRENCY)}`;
}

/**
 * Purpose: Wallet tab — 4-segment financial hub (Cashflow / Recurring / Cards / Worth).
 * Inputs: finance, reminders, settings; optional `segment` search param for deep links.
 * Outputs: editorial header + neumorphic segment control; Cashflow canvas or embedded
 *   Subscriptions / Payment Cards / Worth panels while the floating tab bar stays visible.
 * Side effects: inline budget saves; navigation to composers; QuickSpend sheet.
 * Design decisions: Worth is always a visible segment (empty state invites the first asset).
 *   showAdvancedFinance still gates Cashflow extras only. Subscriptions & cards stay in-tab.
 */
export function MoneyScreen() {
  const { t, intlLocale } = useI18n();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ segment?: string | string[] }>();
  const { settings } = useSettings();
  const { expenses, incomes, budgets, assets, loans, transfers, dueRepeats, upsertBudget, logRecurringSpendInstant, splitsByExpenseId } =
    useFinance();
  const { creditCards } = useReminders();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const currency = settings.defaultCurrency;
  const cardFeeRate = resolveCardFxFeeRate(settings);
  const expenseCatalog = useMemo(() => resolveExpenseCategories(settings), [settings]);
  const activeCategories = useMemo(() => activeExpenseCategories(expenseCatalog), [expenseCatalog]);
  const quickAddIds = useMemo(() => quickAddCategoryIds(expenseCatalog), [expenseCatalog]);
  const hasAssetsOrLoans = assets.length > 0 || loans.length > 0;
  const extrasOn = resolveShowAdvancedFinance(settings, hasAssetsOrLoans);
  const [openExtras, setOpenExtras] = useState(extrasOn);
  const showExtras = extrasOn || openExtras;
  const [hub, setHub] = useState<MoneyHubSegment>(() => parseMoneySegment(params.segment) ?? 'cashflow');
  const [focus, setFocus] = useState<MoneyFocus>('all');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory | 'all'>('all');
  const [expensePreset, setExpensePreset] = useState<ExpenseDatePreset>('month');
  const [budgetCategory, setBudgetCategory] = useState<ExpenseCategory>('dining');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [budgetMonthDate, setBudgetMonthDate] = useState(() => dateFromBudgetMonth(year, month));
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [quickSpendOpen, setQuickSpendOpen] = useState(false);
  const cardNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const card of creditCards) {
      map.set(card.id, card.name);
    }
    return map;
  }, [creditCards]);

  useEffect(() => {
    const next = parseMoneySegment(params.segment);
    if (next) {
      setHub(next);
    }
  }, [params.segment]);

  const hubOptions = useMemo(
    (): HubSegmentOption<MoneyHubSegment>[] => [
      { id: 'cashflow', label: t('money.tabCashflow'), icon: 'wallet-outline' },
      { id: 'subscriptions', label: t('money.tabSubscriptions'), icon: 'repeat-outline' },
      { id: 'cards', label: t('money.tabCards'), icon: 'card-outline' },
      { id: 'worth', label: t('worth.tab'), icon: 'stats-chart-outline' },
    ],
    [t],
  );

  const snapshot = useMemo(
    () => monthSnapshotFor(incomes, expenses, year, month, currency),
    [incomes, expenses, year, month, currency],
  );
  const insight = useMemo(
    () => computeMonthSpendInsight(expenses, currency, now),
    [expenses, currency],
  );
  const net = useMemo(() => computeNetWorth(assets, loans, creditCards, currency), [assets, loans, creditCards, currency]);
  const trend = useMemo(() => spendTrend(expenses, currency, 6, now), [expenses, currency]);
  const budgetRows = useMemo(
    () => budgetProgressFor(budgets, expenses, year, month, currency),
    [budgets, expenses, year, month, currency],
  );
  const range = expenseRangeFromPreset(expensePreset, year, month, now);
  const visibleExpenses = useMemo(
    () => filterExpenses(expenses, { category: expenseCategory, fromDay: range.fromDay, toDay: range.toDay }).slice(0, 20),
    [expenses, expenseCategory, range.fromDay, range.toDay],
  );
  const monthSpends = useMemo(
    () => filterExpenses(expenses, { category: 'all', fromDay: range.fromDay, toDay: range.toDay }).slice(0, 8),
    [expenses, range.fromDay, range.toDay],
  );
  const show = (section: MoneyFocus) => focus === 'all' || focus === section;

  const logDueRepeat = async (ruleId: string) => {
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
  };

  return (
    <ScreenScaffold>
      <View style={[styles.chrome, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            {t('money.headerKicker') ? (
              <Text style={[type.footnote, styles.headerKicker, { color: colors.accent }]}>
                {t('money.headerKicker')}
              </Text>
            ) : null}
            <LargeTitle title={t('money.headerTitle')} />
          </View>
          <Pressable
            onPress={() => {
              void hapticLight();
              setQuickSpendOpen(true);
            }}
            style={({ pressed }) => [
              raisedSurface(colors, 14),
              styles.headerAction,
              {
                transform: [{ scale: pressed ? 0.94 : 1 }],
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('spend.quickSpend')}
          >
            <Ionicons name="flash-outline" size={20} color={colors.ink} accessible={false} importantForAccessibility="no" />
          </Pressable>
        </View>
        <Text style={[styles.lede, { color: colors.muted }]}>{t('money.lede')}</Text>
        <HubSegmentControl options={hubOptions} value={hub} onChange={setHub} />
      </View>

      {hub === 'cashflow' ? (
        <ScrollView
          style={styles.hubScroll}
          contentContainerStyle={[styles.content, { paddingBottom: tabScenePaddingBottom(insets.bottom) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <GlassSurface style={styles.hero} radius={24}>
            <Text style={[styles.kicker, { color: colors.faint }]}>{t('money.spentThisMonth')}</Text>
            <Text style={[styles.heroValue, { color: colors.ink }]}>{formatMoney(snapshot.spent, currency)}</Text>
            {insight.changeLine ? (
              <Text style={[styles.insight, { color: colors.muted }]} numberOfLines={2}>
                {insight.changeLine}
              </Text>
            ) : null}
            {insight.topCategory && insight.topCategoryAmount > 0 ? (
              <View style={styles.insightRow}>
                <TypeIcon
                  typeId={insight.topCategory}
                  icon={iconForExpenseCategory(insight.topCategory, expenseCatalog)}
                  accessibilityLabel={expenseCategoryLabel(t, insight.topCategory, expenseCatalog)}
                />
                <Text style={[styles.insight, { color: colors.muted, marginTop: 0 }]} numberOfLines={2}>
                  {formatMoney(insight.topCategoryAmount, currency)}
                </Text>
              </View>
            ) : null}
            {currency === 'HKD' && cardFeeRate > 0 ? (
              <Text style={[styles.insight, { color: colors.faint }]} numberOfLines={2}>
                {t('money.estimateHintShort')}
              </Text>
            ) : null}
          </GlassSurface>

          <Pressable
            onPress={() => router.push('/expense/new')}
            style={[raisedAccent(colors, 22), styles.addSpend]}
            accessibilityRole="button"
            accessibilityLabel={t('money.addSpend')}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.accentInk} style={{ marginRight: 6 }} accessible={false} importantForAccessibility="no" />
            <Text style={[styles.addSpendLabel, { color: colors.accentInk }]} numberOfLines={2}>
              {t('money.addSpend')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setQuickSpendOpen(true)}
            style={[raisedSurface(colors, 22), styles.quickSpend]}
            accessibilityRole="button"
            accessibilityLabel={t('spend.quickSpend')}
          >
            <View style={[styles.quickSpendIcon, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="flash" size={20} color={colors.accent} accessible={false} importantForAccessibility="no" />
            </View>
            <View style={styles.quickSpendCopy}>
              <Text style={[styles.quickSpendLabel, { color: colors.ink }]} numberOfLines={1}>
                {t('spend.quickSpend')}
              </Text>
              <Text style={[styles.quickSpendHint, { color: colors.muted }]} numberOfLines={2}>
                {t('spend.quickSpendHint')}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.faint}
              accessible={false}
              importantForAccessibility="no"
            />
          </Pressable>
          <View style={styles.quickActionRow}>
            <SectionActionButton
              icon="swap-horizontal-outline"
              label={t('money.transferAction')}
              onPress={() => router.push('/transfer/new')}
            />
            <SectionActionButton
              icon="trending-up-outline"
              label={t('money.addIncome')}
              onPress={() => router.push('/income/new')}
            />
          </View>
          <View style={styles.wrap}>
            {dueRepeats.map((rule) => (
              <Chip
                key={rule.id}
                label={recurringSpendChipLabel(rule)}
                selected={loggingId === rule.id}
                onPress={() => void logDueRepeat(rule.id)}
                onLongPress={() =>
                  router.push(
                    appHref(
                      `/expense/new?category=${rule.category}&amount=${rule.amount}&note=${encodeURIComponent(rule.note ?? '')}&recurringId=${rule.id}`,
                    ),
                  )
                }
              />
            ))}
            {quickAddIds.map((id) => (
              <Chip
                key={id}
                icon={iconForExpenseCategory(id, expenseCatalog)}
                label={`${expenseCategoryLabel(t, id, expenseCatalog)} · ${currency}`}
                selected={false}
                onPress={() => router.push(appHref(`/expense/new?category=${id}`))}
              />
            ))}
          </View>

          <View style={styles.wrap}>
            {(
              [
                ['all', t('money.all'), 'apps-outline'],
                ['income', t('money.focusIncome'), 'trending-up-outline'],
                ['expenses', t('money.focusSpends'), 'wallet-outline'],
                ['budgets', t('money.focusBudgets'), 'pie-chart-outline'],
                ['transfers', t('money.focusTransfers'), 'swap-horizontal-outline'],
              ] as const
            ).map(([id, label, icon]) => (
              <Chip key={id} icon={icon} label={label} selected={focus === id} onPress={() => setFocus(id)} />
            ))}
          </View>

          {show('expenses') || focus === 'all' ? (
            <Section
              title={t('money.spends')}
              icon="wallet-outline"
              action={t('money.addSpend')}
              actionIcon="wallet-outline"
              onAction={() => router.push('/expense/new')}
              colors={colors}
            >
              {focus === 'expenses' ? (
                <>
                  <View style={styles.wrap}>
                    <Chip label={t('money.timeFilterMonth')} selected={expensePreset === 'month'} onPress={() => setExpensePreset('month')} />
                    <Chip label={t('money.timeFilter7d')} selected={expensePreset === '7d'} onPress={() => setExpensePreset('7d')} />
                    <Chip label={t('money.timeFilter30d')} selected={expensePreset === '30d'} onPress={() => setExpensePreset('30d')} />
                    <Chip label={t('money.timeFilterAll')} selected={expensePreset === 'all'} onPress={() => setExpensePreset('all')} />
                  </View>
                  <View style={styles.wrap}>
                    <Chip label={t('money.categoryFilterAny')} selected={expenseCategory === 'all'} onPress={() => setExpenseCategory('all')} />
                    {activeCategories.map((item) => (
                      <Chip
                        key={item.id}
                        icon={iconForExpenseCategory(item.id, expenseCatalog)}
                        label={expenseCategoryLabel(t, item.id, expenseCatalog)}
                        selected={expenseCategory === item.id}
                        onPress={() => setExpenseCategory(item.id)}
                      />
                    ))}
                  </View>
                  {visibleExpenses.length === 0 ? (
                    <EmptyState
                      message={t('money.emptyList')}
                      actionLabel={t('money.addSpend')}
                      actionIcon="wallet-outline"
                      onAction={() => router.push('/expense/new')}
                    />
                  ) : (
                    <SpendsList
                      items={visibleExpenses}
                      expenseCatalog={expenseCatalog}
                      cardNameById={cardNameById}
                      splitsByExpenseId={splitsByExpenseId}
                      colors={colors}
                      intlLocale={intlLocale}
                      t={t}
                      now={now}
                      onOpen={(item) => router.push(appHref(`/expense/${item.id}`))}
                    />
                  )}
                </>
              ) : monthSpends.length === 0 ? (
                <EmptyState
                  message={t('money.emptyMonth')}
                  actionLabel={t('money.addSpend')}
                  actionIcon="wallet-outline"
                  onAction={() => router.push('/expense/new')}
                />
              ) : (
                <SpendsList
                  items={monthSpends}
                  expenseCatalog={expenseCatalog}
                  cardNameById={cardNameById}
                  splitsByExpenseId={splitsByExpenseId}
                  colors={colors}
                  intlLocale={intlLocale}
                  t={t}
                  now={now}
                  onOpen={(item) => router.push(appHref(`/expense/${item.id}`))}
                />
              )}
            </Section>
          ) : null}

          {show('income') ? (
            <Section title={t('money.income')} icon="trending-up-outline" action={t('money.addIncome')} actionIcon="add" onAction={() => router.push('/income/new')} colors={colors}>
              {incomes.length === 0 ? (
                <Text style={[styles.meta, { color: colors.faint }]}>{t('money.incomeLede')}</Text>
              ) : (
                incomes.slice(0, 8).map((item) => (
                  <Row
                    key={item.id}
                    title={formatMoney(item.amount, item.currency)}
                    meta={`${item.dayKey}${item.note ? ` · ${item.note}` : ''}`}
                    typeId={item.kind}
                    colors={colors}
                  />
                ))
              )}
            </Section>
          ) : null}

          {show('budgets') ? (
            <Section title={t('money.budgets')} icon="pie-chart-outline" colors={colors}>
              <Text style={[styles.meta, { color: colors.muted }]}>{t('money.budgetsLede')}</Text>
              {budgetRows.map((row) => (
                <GlassSurface key={row.budget.id} style={styles.rowCard} radius={18}>
                  <View style={styles.rowInner}>
                    <TypeIcon
                      typeId={row.budget.category}
                      icon={iconForExpenseCategory(row.budget.category, expenseCatalog)}
                      accessibilityLabel={expenseCategoryLabel(t, row.budget.category, expenseCatalog)}
                    />
                    <View style={styles.rowCopy}>
                      <Text style={[styles.rowTitle, { color: row.over ? colors.danger : colors.ink }]}>
                        {formatMoney(row.spent, currency)} / {formatMoney(row.budget.limit, currency)}
                      </Text>
                      <Text style={[styles.meta, { color: colors.muted }]}>
                        {row.over ? t('money.budgetOverMonth') : t('money.budgetRemaining', { amount: formatMoney(row.remaining, currency) })}
                      </Text>
                    </View>
                  </View>
                </GlassSurface>
              ))}
              <View style={styles.wrap}>
                {activeCategories.map((item) => (
                  <Chip
                    key={item.id}
                    icon={iconForExpenseCategory(item.id, expenseCatalog)}
                    label={expenseCategoryLabel(t, item.id, expenseCatalog)}
                    selected={budgetCategory === item.id}
                    onPress={() => setBudgetCategory(item.id)}
                  />
                ))}
              </View>
              <DateField label={t('money.budgetMonthLabel')} display="month" value={budgetMonthDate} onChange={setBudgetMonthDate} />
              <View style={styles.inline}>
                <TextInput
                  value={budgetLimit}
                  onChangeText={setBudgetLimit}
                  placeholder={t('money.budgetLimitPlaceholder')}
                  placeholderTextColor={colors.faint}
                  keyboardType="decimal-pad"
                  style={[insetSurface(colors, 16), styles.field, { color: colors.ink }]}
                />
                <SectionActionButton
                  icon="checkmark-outline"
                  label={t('money.saveBudget')}
                  onPress={() => {
                    const limit = Number(budgetLimit);
                    if (!Number.isFinite(limit) || limit <= 0) {
                      return;
                    }
                    const envelope = budgetMonthFromDate(budgetMonthDate);
                    void upsertBudget({
                      year: envelope.year,
                      month: envelope.month,
                      category: budgetCategory,
                      limit,
                      currency,
                    }).then(() => {
                      setBudgetLimit('');
                      return hapticSuccess();
                    });
                  }}
                />
              </View>
            </Section>
          ) : null}

          {show('transfers') ? (
            <Section
              title={t('money.transfers')}
              icon="swap-horizontal-outline"
              action={t('money.newTransfer')}
              actionIcon="swap-horizontal-outline"
              onAction={() => router.push('/transfer/new')}
              colors={colors}
            >
              {transfers.length === 0 ? (
                <Text style={[styles.meta, { color: colors.faint }]}>{t('money.transfersEmpty')}</Text>
              ) : (
                transfers.slice(0, 8).map((item) => (
                  <Row
                    key={item.id}
                    title={formatMoney(item.amount, item.currency)}
                    meta={`${item.dayKey}${item.note ? ` · ${item.note}` : ''}${item.fee ? ` ${t('money.feeLabel', { amount: formatMoney(item.fee, item.currency) })}` : ''}`}
                    typeId="transfers"
                    icon="swap-horizontal-outline"
                    colors={colors}
                  />
                ))
              )}
            </Section>
          ) : null}

          {showExtras ? (
            <>
              <GlassSurface style={styles.hero} radius={24}>
                <Text style={[styles.kicker, { color: colors.faint }]}>{t('money.netPicture')}</Text>
                <Text style={[styles.heroValue, { color: colors.ink }]}>{formatMoney(net.net, currency)}</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>
                  {t('money.have', { amount: formatMoney(net.assets, currency) })} · {t('money.owe', { amount: formatMoney(net.loans, currency) })}
                  {net.cardDebt ? ` · ${t('money.cardsDebt', { amount: formatMoney(net.cardDebt, currency) })}` : ''}
                </Text>
                <Text style={[styles.meta, { color: colors.faint }]}>
                  {t('money.thisMonthSummary', {
                    income: formatMoney(snapshot.income, currency),
                    spent: formatMoney(snapshot.spent, currency),
                  })}
                </Text>
                {net.omittedOtherCurrency ? (
                  <Text style={[styles.meta, { color: colors.faint }]}>{t('money.otherCurrenciesNote')}</Text>
                ) : null}
              </GlassSurface>
              <SpendTrendBars rows={trend} />
            </>
          ) : (
            <SectionActionButton
              icon="options-outline"
              label={t('money.moreTools')}
              tone="muted"
              onPress={() => setOpenExtras(true)}
              style={styles.moreTap}
            />
          )}
        </ScrollView>
      ) : null}

      {hub === 'subscriptions' ? <SubscriptionsCockpitScreen embedded /> : null}
      {hub === 'cards' ? <PaymentCardsScreen embedded /> : null}
      {hub === 'worth' ? <WalletWorthPanel /> : null}

      <QuickSpendSheet visible={quickSpendOpen} onClose={() => setQuickSpendOpen(false)} />
      <HubCaptureFab />
    </ScreenScaffold>
  );
}

/**
 * Purpose: section chrome with optional trailing action for Cashflow lists.
 * Inputs: title, optional icon/action, theme ink/accent, children.
 * Outputs: titled block; presentation only.
 * Side effects: onAction when provided.
 */
function Section({
  title,
  icon,
  action,
  actionIcon,
  onAction,
  colors,
  children,
}: {
  title: string;
  icon?: TypeIconName;
  action?: string;
  actionIcon?: TypeIconName;
  onAction?: () => void;
  colors: { ink: string; accent: string };
  children: ReactNode;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <View style={styles.headTitleRow}>
          {icon ? <Ionicons name={icon} size={20} color={colors.accent} accessible={false} importantForAccessibility="no" /> : null}
          <Text style={[styles.section, { color: colors.ink }]}>{title}</Text>
        </View>
        {action && onAction ? (
          <SectionActionButton
            icon={actionIcon ?? 'add'}
            label={action}
            onPress={onAction}
            style={styles.headAction}
          />
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * Purpose: day-grouped spend list for the Cashflow Spends section.
 * Inputs: filtered expenses, catalog, card names, splits, theme, locale, open handler.
 * Outputs: Today / Yesterday / short-date headers plus glanceable SpendRows.
 * Side effects: onOpen when a row is pressed.
 */
function SpendsList({
  items,
  expenseCatalog,
  cardNameById,
  splitsByExpenseId,
  colors,
  intlLocale,
  t,
  now,
  onOpen,
}: {
  items: Expense[];
  expenseCatalog: ExpenseCategoryConfig[];
  cardNameById: Map<string, string>;
  splitsByExpenseId: Map<string, ExpenseSplit>;
  colors: ThemeColors;
  intlLocale: string;
  t: Translate;
  now: Date;
  onOpen: (item: Expense) => void;
}) {
  return (
    <>
      {groupSpendsByDay(items).map((group) => (
        <View key={group.dayKey} style={styles.dayGroup}>
          <Text style={[styles.dayHeader, { color: colors.muted }]} accessibilityRole="header">
            {spendDayHeading(group.dayKey, now, intlLocale, t)}
          </Text>
          {group.items.map((item) => {
            const categoryLabel = expenseCategoryLabel(t, item.category, expenseCatalog);
            return (
              <SpendRow
                key={item.id}
                item={item}
                categoryLabel={categoryLabel}
                icon={iconForExpenseCategory(item.category, expenseCatalog)}
                cardName={item.cardId ? cardNameById.get(item.cardId) : undefined}
                splitLabel={spendSplitLabel(splitsByExpenseId.get(item.id), t)}
                paidCashLabel={t('spend.paidCash')}
                colors={colors}
                accessibilityLabel={t('money.editSpendA11y', {
                  spend: `${spendPrimaryTitle(item, categoryLabel)}, ${formatExpenseSpendLine(item)}`,
                })}
                onPress={() => onOpen(item)}
              />
            );
          })}
        </View>
      ))}
    </>
  );
}

/**
 * Purpose: banking-style spend row — what left, amount right, how-paid secondary.
 * Inputs: expense, localized category, optional card, split footnote, theme, press handler.
 * Outputs: tactile neumorph row; presentation only.
 * Side effects: onPress → `/expense/[id]` via parent.
 * Design decisions: note/merchant is primary when present (category stays on the icon);
 *   date lives on the day header so rows do not repeat ISO keys; FX estimate is a second
 *   right-aligned line so foreign amounts are never cramped into the title.
 */
function SpendRow({
  item,
  categoryLabel,
  icon,
  cardName,
  splitLabel,
  paidCashLabel,
  colors,
  accessibilityLabel,
  onPress,
}: {
  item: Expense;
  categoryLabel: string;
  icon: TypeIconName;
  cardName?: string;
  splitLabel: string;
  paidCashLabel: string;
  colors: ThemeColors;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const title = spendPrimaryTitle(item, categoryLabel);
  const amountLabel = formatFriendlyMoney(item.amount, item.currency);
  const fxLine = spendFxEstimateLine(item);
  const paidName = cardName ?? paidCashLabel;
  const paidIcon: TypeIconName = cardName ? 'card-outline' : 'cash-outline';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.spendPress,
        {
          transform: [{ scale: pressed ? 0.98 : 1 }],
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <GlassSurface style={styles.spendRowCard} radius={18}>
        <View style={styles.spendRowInner}>
          <View style={[insetSurface(colors, 20), styles.iconWell]} accessible={false} importantForAccessibility="no">
            <TypeIcon typeId={item.category} icon={icon} />
          </View>
          <View style={styles.spendCopy}>
            <Text style={[styles.spendTitle, { color: colors.ink }]} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.spendSecondary}>
              <SpendCardBadge name={paidName} icon={paidIcon} />
              {splitLabel ? (
                <Text style={[styles.splitChip, { color: colors.muted }]} numberOfLines={1}>
                  · {splitLabel}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.amountCol}>
            <Text style={[styles.spendAmount, { color: colors.ink }]} numberOfLines={1}>
              {amountLabel}
            </Text>
            {fxLine ? (
              <Text style={[styles.spendFx, { color: colors.muted }]} numberOfLines={2}>
                {fxLine}
              </Text>
            ) : null}
          </View>
        </View>
      </GlassSurface>
    </Pressable>
  );
}

/**
 * Purpose: one income / transfer glass row for Cashflow lists.
 * Inputs: title, meta, optional type icon, theme colors.
 * Outputs: GlassSurface row; presentation only.
 * Side effects: none.
 */
function Row({
  title,
  meta,
  colors,
  typeId,
  icon,
}: {
  title: string;
  meta: string;
  typeId?: string;
  icon?: TypeIconName;
  colors: { ink: string; muted: string };
}) {
  return (
    <GlassSurface style={styles.rowCard} radius={18}>
      <View style={styles.rowInner}>
        {typeId ? <TypeIcon typeId={typeId} icon={icon} /> : null}
        <View style={styles.rowCopy}>
          <Text style={[styles.rowTitle, { color: colors.ink }]}>{title}</Text>
          {meta ? <Text style={[styles.meta, { color: colors.muted }]}>{meta}</Text> : null}
        </View>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  chrome: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 8,
  },
  hubScroll: {
    flex: 1,
  },
  content: { paddingHorizontal: 20, gap: 12 },
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
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lede: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  hero: { padding: 20, gap: 6 },
  kicker: { fontFamily: fonts.bodySemi, fontSize: 13 },
  heroValue: { fontFamily: fonts.display, fontSize: 36, lineHeight: 42, fontVariant: ['tabular-nums'] },
  insight: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, marginTop: 4, fontVariant: ['tabular-nums'] },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  meta: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', alignItems: 'flex-start' },
  quickActionRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 6 },
  block: { gap: 10, marginTop: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  headTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  headAction: { flexShrink: 1, minWidth: 0, maxWidth: '48%' },
  section: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, flex: 1, minWidth: 0 },
  rowCard: { padding: 16, gap: 4, minHeight: 56 },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22, fontVariant: ['tabular-nums'] },
  dayGroup: { gap: 8 },
  dayHeader: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.3,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  spendPress: { width: '100%' },
  spendRowCard: { paddingVertical: 12, paddingHorizontal: 14, minHeight: 56 },
  spendRowInner: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  spendCopy: { flex: 1, minWidth: 0, gap: 3 },
  spendTitle: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22 },
  spendSecondary: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  splitChip: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, flexShrink: 1 },
  amountCol: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '46%', gap: 2 },
  spendAmount: {
    fontFamily: fonts.display,
    fontSize: 17,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  spendFx: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 17,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  field: { flexGrow: 1, minWidth: 90, minHeight: 44, fontFamily: fonts.body, fontSize: 16, paddingHorizontal: 12, paddingVertical: 10, fontVariant: ['tabular-nums'] },
  addSpend: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  addSpendLabel: { fontFamily: fonts.bodySemi, fontSize: 17, textAlign: 'center', flexShrink: 1 },
  quickSpend: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickSpendIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickSpendCopy: { flex: 1, minWidth: 0, gap: 2 },
  quickSpendLabel: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22 },
  quickSpendHint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  moreTap: { alignSelf: 'center', marginTop: 8 },
});
