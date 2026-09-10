import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../controller/FinanceProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import type { Asset } from '../../model/finance/Asset';
import { formatMoney } from '../../model/finance/Expense';
import type { Loan } from '../../model/finance/Loan';
import { computeNetWorth } from '../../model/finance/netWorth';
import { monthKeyFromDate, snapshotDeltaVsPrevious } from '../../model/finance/netWorthHistory';
import { netWorthSparkSeries } from '../../model/finance/netWorthSparkline';
import { computeSavingsProgress, isSavingsTargetDraftValid } from '../../model/finance/savingsTarget';
import { hapticSuccess } from '../../utils/haptics';
import { appHref } from '../../utils/navigation';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { GlassSurface } from '../components/GlassSurface';
import { KeyboardDismissScrollView } from '../components/KeyboardDismissScrollView';
import { NetWorthSparkline } from '../components/NetWorthSparkline';
import { SectionActionButton } from '../components/SectionActionButton';
import { TypeIcon } from '../components/TypeIcon';
import { iconForType, typeA11yLabel, type TypeIconName } from '../icons/typeIcons';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface, type ThemeColors } from '../theme/tokens';
import { tabScenePaddingBottom } from '../theme/typography';

/**
 * Purpose: format YYYY-MM as a localized month heading for history rows.
 * Inputs: monthKey, Intl locale.
 * Outputs: e.g. Sep 2026.
 * Side effects: none.
 */
function formatHistoryMonth(monthKey: string, locale: string): string {
  const [yearRaw, monthRaw] = monthKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return monthKey;
  }
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

/**
 * Purpose: Wallet → Worth — live net worth, sparkline, savings vs cash/bank, asset/loan lists, monthly history.
 * Inputs: finance + reminders + settings; presentation only.
 * Outputs: embedded hub panel (tab bar stays visible).
 * Side effects: upserts this month’s snapshot when the balance sheet has facts; savings save/clear.
 * Design decisions: Worth is always a visible segment (not an advanced-finance lab). Empty state
 *   invites the first asset. Math stays in Model.
 */
export function WalletWorthPanel() {
  const { t, intlLocale } = useI18n();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings } = useSettings();
  const { creditCards } = useReminders();
  const {
    ready,
    assets,
    loans,
    savingsTarget,
    netWorthHistory,
    upsertSavingsTarget,
    clearSavingsTarget,
    recordMonthlyNetWorthSnapshot,
  } = useFinance();
  const currency = settings.defaultCurrency;
  const now = useMemo(() => new Date(), []);
  const thisMonthKey = monthKeyFromDate(now);
  const [goalDraft, setGoalDraft] = useState(() =>
    savingsTarget && savingsTarget.currency === currency ? String(savingsTarget.amount) : '',
  );
  const [savingGoal, setSavingGoal] = useState(false);
  const lastRecorded = useRef('');

  useEffect(() => {
    if (savingsTarget && savingsTarget.currency === currency) {
      setGoalDraft(String(savingsTarget.amount));
    }
  }, [savingsTarget, currency]);

  const net = useMemo(
    () => computeNetWorth(assets, loans, creditCards, currency),
    [assets, loans, creditCards, currency],
  );
  const savings = useMemo(
    () => computeSavingsProgress(savingsTarget, assets, currency),
    [savingsTarget, assets, currency],
  );
  const history = useMemo(
    () => netWorthHistory.filter((row) => row.currency === currency),
    [netWorthHistory, currency],
  );
  const spark = useMemo(() => netWorthSparkSeries(history, currency), [history, currency]);
  const hasBalanceSheet = assets.length > 0 || loans.length > 0 || net.cardDebt > 0;

  useEffect(() => {
    if (!ready || !hasBalanceSheet) {
      return;
    }
    const key = `${thisMonthKey}:${currency}:${net.net}:${net.assets}:${net.loans}:${net.cardDebt}`;
    if (lastRecorded.current === key) {
      return;
    }
    lastRecorded.current = key;
    void recordMonthlyNetWorthSnapshot(creditCards, currency, now);
  }, [ready, hasBalanceSheet, thisMonthKey, currency, net, creditCards, now, recordMonthlyNetWorthSnapshot]);

  const parsedGoal = Number(goalDraft);
  const canSaveGoal = isSavingsTargetDraftValid({ amount: parsedGoal, currency }) && !savingGoal;

  const saveGoal = async () => {
    if (!canSaveGoal) {
      return;
    }
    setSavingGoal(true);
    try {
      await upsertSavingsTarget({ amount: parsedGoal, currency });
      await hapticSuccess();
    } finally {
      setSavingGoal(false);
    }
  };

  return (
    <KeyboardDismissScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: tabScenePaddingBottom(insets.bottom) }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <GlassSurface style={styles.hero} radius={24}>
        <Text style={[styles.kicker, { color: colors.faint }]}>{t('worth.netWorth')}</Text>
        <Text style={[styles.heroValue, { color: colors.ink }]}>{formatMoney(net.net, currency)}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>
          {t('worth.have', { amount: formatMoney(net.assets, currency) })} ·{' '}
          {t('worth.owe', { amount: formatMoney(net.loans, currency) })}
          {net.cardDebt ? ` · ${t('worth.cardsDebt', { amount: formatMoney(net.cardDebt, currency) })}` : ''}
        </Text>
        {net.omittedOtherCurrency ? (
          <Text style={[styles.meta, { color: colors.faint }]}>{t('worth.otherCurrencies')}</Text>
        ) : null}
        {spark.length > 0 ? (
          <NetWorthSparkline
            points={spark}
            accessibilityLabel={t('worth.sparkA11y', { count: spark.length })}
          />
        ) : null}
      </GlassSurface>

      <GlassSurface style={styles.card} radius={22}>
        <Text style={[styles.section, { color: colors.ink }]}>{t('worth.savings')}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>{t('worth.savingsLede')}</Text>
        {savings.hasTarget ? (
          <>
            <View style={[insetSurface(colors, 8), styles.barTrack]}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.min(100, Math.round(savings.ratio * 100))}%`,
                    backgroundColor: savings.met ? colors.accent : colors.ink,
                  },
                ]}
              />
            </View>
            <Text style={[styles.meta, { color: colors.ink }]}>
              {t('worth.savingsProgress', {
                current: formatMoney(savings.current, currency),
                goal: formatMoney(savings.goal, currency),
              })}
            </Text>
            <Text style={[styles.meta, { color: colors.muted }]}>
              {savings.met
                ? t('worth.savingsMet')
                : t('worth.savingsLeft', { amount: formatMoney(savings.remaining, currency) })}
            </Text>
          </>
        ) : (
          <Text style={[styles.meta, { color: colors.faint }]}>{t('worth.savingsNone')}</Text>
        )}
        <View style={styles.inline}>
          <TextInput
            value={goalDraft}
            onChangeText={setGoalDraft}
            placeholder={t('worth.savingsPlaceholder')}
            placeholderTextColor={colors.faint}
            keyboardType="decimal-pad"
            style={[insetSurface(colors, 16), styles.field, { color: colors.ink }]}
          />
          <SectionActionButton
            icon="checkmark-outline"
            label={t('worth.saveTarget')}
            onPress={() => void saveGoal()}
            disabled={!canSaveGoal}
          />
        </View>
        {savings.hasTarget ? (
          <Chip label={t('worth.clearTarget')} selected={false} onPress={() => void clearSavingsTarget()} />
        ) : null}
      </GlassSurface>

      {!hasBalanceSheet && assets.length === 0 && loans.length === 0 ? (
        <EmptyState
          message={t('worth.empty')}
          backdropIcon="stats-chart-outline"
          actionLabel={t('worth.addFirstAsset')}
          actionIcon="add"
          onAction={() => router.push('/asset/new')}
        />
      ) : null}

      <Section
        title={t('worth.assets')}
        icon="wallet-outline"
        action={t('worth.addAsset')}
        onAction={() => router.push('/asset/new')}
        colors={colors}
      >
        {assets.length === 0 ? (
          <Text style={[styles.meta, { color: colors.faint }]}>{t('worth.empty')}</Text>
        ) : (
          assets.map((item) => (
            <WorthRow
              key={item.id}
              title={item.name}
              meta={`${typeA11yLabel(t, item.kind)} · ${formatMoney(item.value, item.currency)}`}
              typeId={item.kind}
              colors={colors}
              accessibilityLabel={item.name}
              onPress={() => router.push(appHref(`/asset/${item.id}`))}
            />
          ))
        )}
      </Section>

      <Section
        title={t('worth.loans')}
        icon="cash-outline"
        action={t('worth.addLoan')}
        onAction={() => router.push('/loan/new')}
        colors={colors}
      >
        {loans.length === 0 ? (
          <Text style={[styles.meta, { color: colors.faint }]}>{t('worth.loansEmpty')}</Text>
        ) : (
          loans.map((item) => (
            <WorthRow
              key={item.id}
              title={item.name}
              meta={`${typeA11yLabel(t, item.kind)} · ${formatMoney(item.balance, item.currency)}`}
              typeId={item.kind}
              colors={colors}
              accessibilityLabel={item.name}
              onPress={() => router.push(appHref(`/loan/${item.id}`))}
            />
          ))
        )}
      </Section>

      <Section title={t('worth.history')} icon="stats-chart-outline" colors={colors}>
        {history.length === 0 ? (
          <Text style={[styles.meta, { color: colors.faint }]}>{t('worth.historyEmpty')}</Text>
        ) : (
          history.map((row, index) => {
            const delta = snapshotDeltaVsPrevious(history, index);
            const isThisMonth = row.monthKey === thisMonthKey;
            return (
              <GlassSurface key={`${row.monthKey}-${row.currency}`} style={styles.rowCard} radius={18}>
                <Text style={[styles.rowTitle, { color: colors.ink }]}>{formatMoney(row.net, row.currency)}</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>
                  {isThisMonth ? t('worth.historyThisMonth') : formatHistoryMonth(row.monthKey, intlLocale)}
                  {delta === undefined
                    ? ''
                    : delta > 0
                      ? ` · ${t('worth.deltaUp', { amount: formatMoney(delta, row.currency) })}`
                      : delta < 0
                        ? ` · ${t('worth.deltaDown', { amount: formatMoney(Math.abs(delta), row.currency) })}`
                        : ''}
                </Text>
              </GlassSurface>
            );
          })
        )}
      </Section>
    </KeyboardDismissScrollView>
  );
}

/**
 * Purpose: section chrome with optional add action for Worth lists.
 * Inputs: title, optional icon/action, theme, children.
 * Outputs: titled block; presentation only.
 * Side effects: onAction when provided.
 */
function Section({
  title,
  icon,
  action,
  onAction,
  colors,
  children,
}: {
  title: string;
  icon?: TypeIconName;
  action?: string;
  onAction?: () => void;
  colors: { ink: string; accent: string };
  children: React.ReactNode;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <View style={styles.headTitleRow}>
          {icon ? (
            <Ionicons name={icon} size={20} color={colors.accent} accessible={false} importantForAccessibility="no" />
          ) : null}
          <Text style={[styles.section, { color: colors.ink }]}>{title}</Text>
        </View>
        {action && onAction ? (
          <SectionActionButton icon="add" label={action} onPress={onAction} style={styles.headAction} />
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * Purpose: pressable asset / loan row for Worth lists.
 * Inputs: title, meta, type id, theme, press handler.
 * Outputs: GlassSurface row; presentation only.
 * Side effects: onPress → edit route.
 */
function WorthRow({
  title,
  meta,
  typeId,
  colors,
  accessibilityLabel,
  onPress,
}: {
  title: string;
  meta: string;
  typeId: Asset['kind'] | Loan['kind'];
  colors: ThemeColors;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      <GlassSurface style={styles.rowCard} radius={18}>
        <View style={styles.rowInner}>
          <TypeIcon typeId={typeId} icon={iconForType(typeId)} />
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
              {meta}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} accessible={false} importantForAccessibility="no" />
        </View>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 12 },
  hero: { padding: 20, gap: 6 },
  card: { padding: 20, gap: 10 },
  kicker: { fontFamily: fonts.bodySemi, fontSize: 13 },
  heroValue: { fontFamily: fonts.display, fontSize: 36, lineHeight: 42, fontVariant: ['tabular-nums'] },
  meta: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  section: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, flex: 1, minWidth: 0 },
  block: { gap: 10, marginTop: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  headTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  headAction: { flexShrink: 1, minWidth: 0, maxWidth: '48%' },
  rowCard: { padding: 16, gap: 4, minHeight: 56 },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22, fontVariant: ['tabular-nums'] },
  barTrack: { height: 10, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  field: {
    flexGrow: 1,
    minWidth: 90,
    minHeight: 44,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontVariant: ['tabular-nums'],
  },
});
