import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppConfig } from '../../config/appConfig';
import { useFinance } from '../../controller/FinanceProvider';
import { useFxRates } from '../../controller/FxRateProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import {
  amountToExpression,
  evaluateAmountExpression,
  isCompleteAmountExpression,
} from '../../model/finance/amountCalculator';
import {
  calculateTransactionRebate,
  findBestCardForSpend,
} from '../../model/finance/creditCardRebates';
import {
  activeExpenseCategories,
  expenseCategoryFromReminder,
  formatFriendlyMoney,
  formatMoney,
  resolveExpenseCategories,
  type ExpenseCategory,
} from '../../model/finance/Expense';
import {
  formatSpendLine,
  formatCardFeePercent,
  formatRatesClock,
  buildExpenseFxSnapshot,
  hasExpenseFxSnapshot,
  formatExpenseSpendLine,
} from '../../model/finance/fx';
import { summarizeSplit } from '../../model/finance/ExpenseSplit';
import { quickAddHint, quickAddTemplates, suggestQuickAdd, type QuickAddTemplate } from '../../model/finance/quickAdd';
import { recentSpendActions } from '../../model/finance/recentSpends';
import { resolveCardFxFeeRate, type MoneyCurrency } from '../../model/settings/AppSettings';
import { dateFromDayKey, dayKeyFromDate } from '../../controller/dateFieldValue';
import { toDayKey } from '../../utils/dateUtils';
import { leaveScreen, appHref } from '../../utils/navigation';
import { hapticLight, hapticSuccess } from '../../utils/haptics';
import { AmountCalculatorField } from '../components/AmountCalculatorField';
import { BackButton } from '../components/BackButton';
import { Chip } from '../components/Chip';
import { DateField } from '../components/DateField';
import { FormCard, FormCardGroup } from '../components/FormCardGroup';
import {
  PhotoAttachments,
  type PhotoAttachmentsHandle,
} from '../components/PhotoAttachments';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SectionActionButton } from '../components/SectionActionButton';
import { iconForExpenseCategory, expenseCategoryLabel, TYPE_ICON_SIZE, type TypeIconName } from '../icons/typeIcons';
import { localizeQuickAddTemplateLabel, useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { useTypography } from '../theme/TypographyProvider';
import { chipSurface, fonts, insetSurface } from '../theme/tokens';
import type { RecurringSpendFrequency } from '../../model/finance/recurringSpend';

const AMOUNT_BUMPS = [10, 50, 100, 500] as const;
const REPEAT_FREQUENCIES: RecurringSpendFrequency[] = ['daily', 'weekday', 'weekly', 'monthly'];

const CATEGORIES_FALLBACK: ExpenseCategory[] = [
  'dining',
  'transport',
  'groceries',
  'bills',
  'shopping',
  'entertainment',
  'health',
  'other',
];

function asCategory(value: string | undefined, allowed: ExpenseCategory[]): ExpenseCategory | undefined {
  return value && (allowed.includes(value) || CATEGORIES_FALLBACK.includes(value)) ? value : undefined;
}

function asDayKey(value?: string): string | undefined {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

/**
 * Purpose: amount-first spend capture, and the same form for editing a saved spend.
 * Inputs: route id (`new` or expense id); optional query category / amount / note / date / reminderId; finance + settings + cards.
 * Outputs: calculator expression → evaluated amount, HKD/USD/CNY (new spend defaults HKD), category, optional cardId, date, note, receipts.
 * Side effects: FinanceController create/update/delete. Does not open journal or reminder screens.
 * Design decisions: leftover journalEntryId / reminderId stay on the row. You → Money currency is home totals only —
 *   the transaction keypad defaults to HKD. Switching HKD|USD|CNY auto-converts the keypad amount (mid-market).
 *   Save stores the evaluated number (and selected currency), then locks FX. Optional “Paid with” chips assign a CreditCardAccount.
 *   When amount > 0, a Best Card banner ranks cards by rebate; selecting a card shows a live rebate preview (rate, cap left).
 *   Layout is three raised neumorph cards (Amount → Category → Details) with a sticky Keep CTA pinned above the
 *   home indicator so save stays thumb-reachable without scrolling. Keypad starts collapsed; parent owns collapse
 *   so category taps can dismiss the pad. Categories use a compact 2-row grid (~100–110pt). Scroll content
 *   pads above the sticky bar. Typography via useTypography; KeyboardAvoidingView keeps the bar above the soft keyboard.
 */
export function ExpenseEditScreen() {
  const {
    id: routeId,
    reminderId,
    category: categoryParam,
    amount: amountParam,
    note: noteParam,
    date: dateParam,
    recurringId: recurringParam,
    mode: modeParam,
  } = useLocalSearchParams<{
    id?: string;
    reminderId?: string;
    category?: string;
    amount?: string;
    note?: string;
    date?: string;
    recurringId?: string;
    mode?: string;
  }>();
  const { t, intlLocale } = useI18n();
  const colors = useThemeColors();
  const { type, scaleFontSize } = useTypography();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings } = useSettings();
  const { ready, createExpense, updateExpense, deleteExpense, expenses, assets, splitsByExpenseId } = useFinance();
  const { table: fx, stale: fxStale, refreshRates } = useFxRates();
  const { reminders, creditCards } = useReminders();
  const expenseCatalog = useMemo(() => resolveExpenseCategories(settings), [settings]);
  const activeCategories = useMemo(() => activeExpenseCategories(expenseCatalog), [expenseCatalog]);
  const catalogIds = useMemo(() => expenseCatalog.map((row) => row.id), [expenseCatalog]);
  const expenseId = typeof routeId === 'string' && routeId !== 'new' ? routeId : undefined;
  const existing = expenseId ? expenses.find((item) => item.id === expenseId) : undefined;
  const isEdit = Boolean(expenseId);
  const linkedReminder = !isEdit && reminderId ? reminders.find((item) => item.id === reminderId) : undefined;
  const now = new Date();
  const suggestion = useMemo(() => suggestQuickAdd(expenses, now, expenseCatalog), [expenses, expenseCatalog]);
  /** Quick Spend mode (?mode=quick): pre-fill Smart Defaults and offer one-tap templates. */
  const quickMode = !isEdit && !linkedReminder && modeParam === 'quick';
  const quickTemplates = useMemo(
    () => (quickMode ? quickAddTemplates(settings.defaultCurrency) : []),
    [quickMode, settings.defaultCurrency],
  );
  const queryCategory = asCategory(
    typeof categoryParam === 'string' ? categoryParam : undefined,
    catalogIds,
  );
  const queryAmount = typeof amountParam === 'string' && Number(amountParam) > 0 ? amountParam : undefined;
  const queryNote = typeof noteParam === 'string' ? noteParam : undefined;
  const queryDate = asDayKey(typeof dateParam === 'string' ? dateParam : undefined);
  const recents = useMemo(() => recentSpendActions(expenses), [expenses]);

  const dueFromNote = linkedReminder?.note ? /Amount due\s+([\d.]+)/i.exec(linkedReminder.note)?.[1] : undefined;
  const seedAmount = queryAmount ?? dueFromNote;
  const [amount, setAmount] = useState(
    seedAmount && Number(seedAmount) > 0 ? amountToExpression(Number(seedAmount)) : '',
  );
  const [currency, setCurrency] = useState<MoneyCurrency>(AppConfig.money.defaultCurrency);
  const [category, setCategory] = useState<ExpenseCategory>(
    linkedReminder
      ? expenseCategoryFromReminder(linkedReminder.categoryPath.top, linkedReminder.categoryPath.subcategory)
      : (queryCategory ?? suggestion.category),
  );
  const [dayKey, setDayKey] = useState(queryDate ?? toDayKey(now));
  const [note, setNote] = useState(linkedReminder?.title ?? queryNote ?? '');
  const [photos, setPhotos] = useState<string[]>([]);
  const [assetId, setAssetId] = useState<string | undefined>();
  const [cardId, setCardId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [more, setMore] = useState(false);
  const [weekdayRepeat, setWeekdayRepeat] = useState(false);
  const [repeatFrequency, setRepeatFrequency] = useState<RecurringSpendFrequency>('weekday');
  /** Keypad starts collapsed so Card 1 stays a glanceable amount hero; category taps re-collapse it. */
  const [keypadCollapsed, setKeypadCollapsed] = useState(true);
  const photoAttachmentsRef = useRef<PhotoAttachmentsHandle>(null);
  const linkedRecurringId = typeof recurringParam === 'string' ? recurringParam : undefined;
  const seeded = useRef(Boolean(linkedReminder || queryCategory || isEdit));
  const parsed = evaluateAmountExpression(amount);
  const parsedAmount = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const amountReady = isCompleteAmountExpression(amount);
  const canSave = amountReady && !saving;
  const selectedCard = useMemo(
    () => (cardId ? creditCards.find((card) => card.id === cardId) : undefined),
    [cardId, creditCards],
  );
  /**
   * Purpose: rank payment cards by rebate for the current amount/category/date.
   * Inputs: creditCards, parsedAmount, category, dayKey, expenses.
   * Outputs: best card + rebate result, or null when amount is zero / no cards.
   * Side effects: none.
   */
  const recommendation = useMemo(
    () =>
      parsedAmount > 0
        ? findBestCardForSpend(creditCards, parsedAmount, category, dayKey, expenses)
        : null,
    [creditCards, parsedAmount, category, dayKey, expenses],
  );
  /**
   * Purpose: live rebate preview for the card currently selected in Paid with.
   * Inputs: selectedCard, parsedAmount, category, dayKey, expenses.
   * Outputs: RebateCalculationResult or null when no card / zero amount.
   * Side effects: none.
   */
  const rebatePreview = useMemo(
    () =>
      selectedCard && parsedAmount > 0
        ? calculateTransactionRebate(selectedCard, parsedAmount, category, dayKey, expenses)
        : null,
    [selectedCard, parsedAmount, category, dayKey, expenses],
  );
  /** Core active categories for the compact 4×2 visual grid (icon + short label). */
  const compactCategories = useMemo(() => activeCategories.slice(0, 8), [activeCategories]);
  const categoryGridRows = useMemo(
    () =>
      [compactCategories.slice(0, 4), compactCategories.slice(4, 8)].filter((row) => row.length > 0),
    [compactCategories],
  );
  const cardFeeRate = resolveCardFxFeeRate(settings);
  const amountUnchanged = Boolean(existing && existing.amount === parsed && existing.currency === currency);
  const lockedLine =
    amountUnchanged && existing && hasExpenseFxSnapshot(existing)
      ? formatExpenseSpendLine(existing)
      : '';
  const liveEstimate =
    amountReady && Number.isFinite(parsed) && parsed > 0
      ? lockedLine ||
        formatSpendLine(parsed, currency, settings.defaultCurrency, fx, cardFeeRate, {
          feeCopy: true,
          inclCard: t('money.inclCard', { percent: formatCardFeePercent(cardFeeRate) }),
        })
      : '';
  const showForeignEstimate = currency !== 'HKD' && liveEstimate.includes('≈');

  useEffect(() => {
    // Prefetch while still on HKD — currency chips convert immediately without waiting for a foreign tap.
    void refreshRates();
  }, [refreshRates]);

  useEffect(() => {
    if (!existing) {
      return;
    }
    setAmount(amountToExpression(existing.amount));
    setCurrency(existing.currency);
    setCategory(existing.category);
    setDayKey(existing.dayKey);
    setNote(existing.note ?? '');
    setPhotos(existing.photoUris);
    setAssetId(existing.accountId);
    setCardId(existing.cardId);
    setWeekdayRepeat(Boolean(existing.recurringSpendId));
  }, [existing?.id]);

  useEffect(() => {
    if (seeded.current || linkedReminder || queryCategory || isEdit) {
      return;
    }
    if (expenses.length === 0) {
      return;
    }
    seeded.current = true;
    setCategory(suggestQuickAdd(expenses, new Date()).category);
  }, [expenses, linkedReminder, queryCategory, isEdit]);

  /** Quick Spend mode seeds Smart Defaults once: suggested amount, currency, and card. */
  const quickSeeded = useRef(false);
  useEffect(() => {
    if (!quickMode || quickSeeded.current) {
      return;
    }
    quickSeeded.current = true;
    if (suggestion.suggestedAmount !== undefined) {
      setAmount(amountToExpression(suggestion.suggestedAmount));
    }
    if (suggestion.suggestedCurrency) {
      setCurrency(suggestion.suggestedCurrency);
    }
    if (suggestion.suggestedCardId) {
      setCardId(suggestion.suggestedCardId);
    }
  }, [quickMode, suggestion]);

  /** One-tap template tap in Quick Spend mode — fills the form, she still confirms with Keep. */
  const applyTemplate = (template: QuickAddTemplate) => {
    setAmount(amountToExpression(template.amount));
    setCurrency(template.currency);
    setCategory(template.category);
    setNote(template.note ?? template.label);
    setCardId(template.cardId);
    setKeypadCollapsed(true);
  };

  /**
   * Purpose: pick a spend category from the compact grid (or more-details list).
   * Inputs: category id; optional last amount/currency from Smart Defaults chips.
   * Outputs: updates category (+ amount/currency when provided) and collapses the keypad.
   * Side effects: none beyond state setters.
   * Design decisions: collapsing the pad on category tap keeps focus on the form after amount entry.
   */
  const selectCategory = (
    next: ExpenseCategory,
    extras?: { lastAmount?: number; currency?: MoneyCurrency },
  ) => {
    setCategory(next);
    if (extras?.lastAmount !== undefined) {
      setAmount(amountToExpression(extras.lastAmount));
    }
    if (extras?.currency) {
      setCurrency(extras.currency);
    }
    setKeypadCollapsed(true);
  };

  const save = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    try {
      const keepLock =
        Boolean(existing) &&
        existing!.amount === parsed &&
        existing!.currency === currency &&
        hasExpenseFxSnapshot(existing!);
      let table = fx;
      if (currency !== 'HKD' && !keepLock) {
        table = (await refreshRates(true)) ?? fx;
      }
      const snapshot =
        currency === 'HKD'
          ? null
          : keepLock && existing
            ? {
                homeAmount: existing.homeAmount as number,
                quoteCurrency: 'HKD' as const,
                fxRate: existing.fxRate ?? 0,
                cardFeeRate: existing.cardFeeRate ?? 0,
                convertedAt: existing.convertedAt as string,
              }
            : buildExpenseFxSnapshot(parsed, currency, table, cardFeeRate, new Date()) ?? null;
      const draft = {
        amount: parsed,
        currency,
        category,
        dayKey,
        note,
        photoUris: photos,
        reminderId: typeof reminderId === 'string' ? reminderId : undefined,
        accountId: assetId,
        cardId,
        recurringSpendId: existing?.recurringSpendId ?? linkedRecurringId,
        weekdayRepeat,
        frequency: weekdayRepeat ? repeatFrequency : undefined,
        dayOfWeek: weekdayRepeat && repeatFrequency === 'weekly' ? new Date().getDay() : undefined,
        dayOfMonth: weekdayRepeat && repeatFrequency === 'monthly' ? new Date().getDate() : undefined,
        fx: snapshot,
      };
      if (existing) {
        await updateExpense(existing.id, draft);
      } else {
        await createExpense(draft);
      }
      await hapticSuccess();
      leaveScreen(router);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!existing) {
      return;
    }
    const run = () => {
      void deleteExpense(existing.id).then(() => leaveScreen(router));
    };
    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        window.confirm(`${t('spend.removeTitle')} ${t('spend.removeBody')}`)
      ) {
        run();
      }
      return;
    }
    Alert.alert(t('spend.removeTitle'), t('spend.removeBody'), [
      { text: t('spend.keepIt'), style: 'cancel' },
      { text: t('spend.remove'), style: 'destructive', onPress: run },
    ]);
  };

  const applyLast = () => {
    const last = suggestion.lastExpense;
    if (!last) {
      return;
    }
    setAmount(amountToExpression(last.amount));
    setCurrency(last.currency);
    setCategory(last.category);
    setNote(last.note ?? '');
    setCardId(last.cardId);
    setKeypadCollapsed(true);
  };

  const sectionLabelStyle = [
    styles.sectionLabel,
    type.footnote,
    { color: colors.muted, fontSize: scaleFontSize(13) },
  ];
  const metaStyle = [styles.meta, type.footnote, { color: colors.muted, fontSize: scaleFontSize(14) }];
  const linkStyle = [styles.link, { color: colors.muted, fontSize: scaleFontSize(16), lineHeight: Math.round(scaleFontSize(16) * 1.35) }];
  const noteFontSize = scaleFontSize(16);

  if (isEdit && !ready) {
    return (
      <ScreenScaffold>
        <View style={[styles.missing, { paddingTop: insets.top + 24 }]}>
          <BackButton />
        </View>
      </ScreenScaffold>
    );
  }

  if (isEdit && !existing) {
    return (
      <ScreenScaffold>
        <View style={[styles.missing, { paddingTop: insets.top + 24 }]}>
          <BackButton />
          <Text style={[styles.missingText, type.title1, { color: colors.muted }]}>{t('spend.missing')}</Text>
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <FormCardGroup
      title={isEdit ? t('spend.thisSpend') : t('spend.log')}
      headerTrailingIcon="checkmark"
      headerTrailingLabel={saving ? t('common.saving') : t('spend.keep')}
      onHeaderTrailing={() => void save()}
      headerTrailingDisabled={!canSave}
      stickyButtonLabel={saving ? t('common.saving') : isEdit ? t('spend.saveThis') : t('spend.keepThis')}
      onStickyButtonPress={() => void save()}
      stickyButtonDisabled={!amountReady}
      stickyButtonBusy={saving}
    >
      {linkedReminder ? (
        <Text style={metaStyle}>{t('spend.fromReminder', { title: linkedReminder.title })}</Text>
      ) : null}

      {/* Card 1: Amount Hero */}
      <FormCard>
        <AmountCalculatorField
          expression={amount}
          onChange={setAmount}
          currency={currency}
          onCurrencyChange={setCurrency}
          fxTable={fx}
          isKeypadCollapsed={keypadCollapsed}
          onKeypadCollapsedChange={setKeypadCollapsed}
        />

        <View style={styles.bumpRow}>
          {AMOUNT_BUMPS.map((bump) => (
            <Chip
              key={bump}
              label={t('spend.amountBump', { amount: bump })}
              selected={false}
              style={styles.bumpPill}
              onPress={() => {
                const current = amountReady && Number.isFinite(parsed) ? parsed : 0;
                setAmount(amountToExpression(current + bump));
              }}
            />
          ))}
        </View>

        {showForeignEstimate ? (
          <View style={[insetSurface(colors, 16), styles.estimateBlock]}>
            <Text style={[sectionLabelStyle, { marginBottom: 2 }]}>{t('spend.hkdEstimate')}</Text>
            <Text
              style={[
                styles.estimateLine,
                {
                  color: colors.ink,
                  fontSize: scaleFontSize(16),
                  lineHeight: Math.round(scaleFontSize(16) * 1.35),
                },
              ]}
            >
              {liveEstimate}
            </Text>
            <Text
              style={[
                styles.estimateHint,
                {
                  color: colors.muted,
                  fontSize: scaleFontSize(13),
                  lineHeight: Math.round(scaleFontSize(13) * 1.4),
                },
              ]}
            >
              {cardFeeRate > 0 ? t('money.estimateHint') : t('money.estimateHintNoFee')}
            </Text>
            {fxStale && fx ? (
              <Text
                style={[
                  styles.estimateHint,
                  {
                    color: colors.faint,
                    fontSize: scaleFontSize(12),
                    lineHeight: Math.round(scaleFontSize(12) * 1.4),
                  },
                ]}
              >
                {t('money.ratesFrom', { time: formatRatesClock(fx.fetchedAt, new Date(), intlLocale) })}
              </Text>
            ) : null}
          </View>
        ) : null}
      </FormCard>

      {/* Card 2: Category & Suggestions */}
      <FormCard>
              {quickMode ? (
                <View style={styles.section}>
                  <Text style={sectionLabelStyle}>{t('spend.oneTapTemplates')}</Text>
                  <View style={styles.wrap}>
                    {quickTemplates.map((template) => (
                      <Chip
                        key={template.id}
                        leadingIcon={template.icon as TypeIconName}
                        label={`${localizeQuickAddTemplateLabel(t, template)} · ${formatFriendlyMoney(template.amount, template.currency)}`}
                        selected={false}
                        onPress={() => applyTemplate(template)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {!isEdit && !linkedReminder ? (
                <Text
                  style={[
                    styles.hint,
                    {
                      color: colors.faint,
                      fontSize: scaleFontSize(13),
                      lineHeight: Math.round(scaleFontSize(13) * 1.35),
                    },
                  ]}
                  numberOfLines={2}
                >
                  {quickAddHint(suggestion, expenseCatalog)}
                </Text>
              ) : null}

              {!isEdit && !linkedReminder && suggestion.lastExpense ? (
                <Pressable onPress={applyLast} style={styles.sameHit} accessibilityRole="button">
                  <Text
                    style={[
                      styles.same,
                      {
                        color: colors.accent,
                        fontSize: scaleFontSize(14),
                        lineHeight: Math.round(scaleFontSize(14) * 1.35),
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {t('spend.sameAsLast')}
                    {suggestion.lastExpense.note
                      ? ` · ${formatMoney(suggestion.lastExpense.amount, suggestion.lastExpense.currency)} ${suggestion.lastExpense.note}`
                      : ` · ${formatMoney(suggestion.lastExpense.amount, suggestion.lastExpense.currency)}`}
                  </Text>
                </Pressable>
              ) : null}

              <View style={styles.section}>
                <Text style={sectionLabelStyle}>{t('spend.category')}</Text>
                <View style={styles.categoryGrid} accessibilityRole="radiogroup">
                  {categoryGridRows.map((row, rowIndex) => (
                    <View key={`cat-row-${rowIndex}`} style={styles.categoryRow}>
                      {row.map((item) => {
                        const selected = category === item.id;
                        const label = expenseCategoryLabel(t, item.id, expenseCatalog);
                        const ink = selected ? colors.accent : colors.ink;
                        const chipMeta = !isEdit
                          ? suggestion.chips.find((chip) => chip.category === item.id)
                          : undefined;
                        return (
                          <Pressable
                            key={item.id}
                            onPress={() => {
                              void hapticLight();
                              selectCategory(item.id, {
                                lastAmount: chipMeta?.lastAmount,
                                currency: chipMeta?.currency,
                              });
                            }}
                            accessibilityRole="radio"
                            accessibilityLabel={label}
                            accessibilityState={{ selected }}
                            style={[chipSurface(colors, selected), styles.categoryCell]}
                          >
                            <Ionicons
                              name={iconForExpenseCategory(item.id, expenseCatalog)}
                              size={TYPE_ICON_SIZE}
                              color={ink}
                              accessible={false}
                              importantForAccessibility="no"
                            />
                            <Text
                              style={[
                                styles.categoryLabel,
                                {
                                  color: ink,
                                  fontSize: scaleFontSize(11),
                                  lineHeight: Math.round(scaleFontSize(11) * 1.2),
                                },
                              ]}
                              numberOfLines={1}
                              selectable={false}
                            >
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>

              {!isEdit && !linkedReminder && recents.length > 0 ? (
                <View style={styles.section}>
                  <Text style={sectionLabelStyle}>{t('spend.recent')}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.recentScroll}
                  >
                    {recents.map((item) => (
                      <Chip
                        key={item.key}
                        label={item.label}
                        selected={false}
                        onPress={() => {
                          setAmount(amountToExpression(item.amount));
                          setCurrency(item.currency);
                          setCategory(item.category);
                          setNote(item.note);
                          setCardId(item.cardId);
                        }}
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </FormCard>

            {/* Card 3: Spend Details */}
            <FormCard>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={t('spend.note')}
                placeholderTextColor={colors.faint}
                style={[
                  insetSurface(colors, 16),
                  styles.note,
                  {
                    color: colors.ink,
                    fontSize: noteFontSize,
                    lineHeight: Math.round(noteFontSize * 1.35),
                    minHeight: Math.max(52, Math.round(48 * Math.min(1.2, noteFontSize / 16))),
                  },
                ]}
                returnKeyType="done"
                blurOnSubmit
              />
              <SectionActionButton
                icon="camera-outline"
                label={t('spend.scanReceipt')}
                tone="muted"
                onPress={() => void photoAttachmentsRef.current?.takePhotoAndScan()}
                style={styles.scanReceiptBtn}
              />

              <View style={styles.section}>
                <Text style={sectionLabelStyle}>{t('spend.paidWith')}</Text>
                {recommendation && recommendation.result.rebateAmount > 0 ? (
                  <Pressable
                    onPress={() => {
                      setCardId(recommendation.bestCard.id);
                      void hapticLight();
                    }}
                    style={[insetSurface(colors, 14), styles.rebateBanner]}
                    accessibilityRole="button"
                    accessibilityLabel={`Best: ${recommendation.bestCard.name}`}
                  >
                    <Text style={[styles.rebateBannerText, { color: colors.accent }]}>
                      {`✨ Best: ${recommendation.bestCard.name} (+${formatMoney(recommendation.result.rebateAmount, currency)} · ${(recommendation.result.effectiveRate * 100).toFixed(1)}%)`}
                    </Text>
                  </Pressable>
                ) : null}
                <View style={styles.wrap}>
                  <Chip
                    leadingIcon="cash-outline"
                    label={t('spend.paidCash')}
                    selected={!cardId}
                    onPress={() => setCardId(undefined)}
                  />
                  {creditCards.map((card) => (
                    <Chip
                      key={card.id}
                      leadingIcon="card-outline"
                      label={card.name}
                      selected={cardId === card.id}
                      onPress={() => setCardId(card.id)}
                    />
                  ))}
                </View>
                {rebatePreview && rebatePreview.rebateAmount >= 0 && selectedCard ? (
                  <View style={[insetSurface(colors, 14), styles.rebatePreview]}>
                    <Text style={[styles.rebatePreviewText, { color: colors.ink }]}>
                      {rebatePreview.isCapExceeded
                        ? `⚠️ Cap reached · Earns ${formatMoney(rebatePreview.rebateAmount, currency)} base`
                        : `💳 Earns ${formatMoney(rebatePreview.rebateAmount, currency)} (${rebatePreview.explanation})`}
                      {rebatePreview.capRemaining !== undefined && !rebatePreview.isCapExceeded
                        ? ` · Cap left: ${formatMoney(rebatePreview.capRemaining, currency)}`
                        : ''}
                    </Text>
                  </View>
                ) : null}
                {creditCards.length === 0 ? (
                  <Pressable
                    onPress={() => router.push(appHref('/payment-cards'))}
                    style={styles.moreTap}
                    accessibilityRole="button"
                    accessibilityLabel={t('money.paymentCards')}
                  >
                    <Text style={[linkStyle, { color: colors.accent }]}>{t('spend.manageCards')}</Text>
                  </Pressable>
                ) : null}
              </View>

              <DateField
                label={t('spend.date')}
                value={dateFromDayKey(dayKey)}
                onChange={(next) => setDayKey(dayKeyFromDate(next))}
              />

              {isEdit && expenseId ? (
                <View style={styles.section}>
                  {(() => {
                    const split = splitsByExpenseId.get(expenseId);
                    if (split) {
                      const summary = summarizeSplit(split);
                      const pendingPeople = summary.totalCount - summary.settledCount;
                      const label = summary.allSettled
                        ? `${t('split.splitWith', { count: summary.totalCount })} · ${t('split.allSettled')}`
                        : `${t('split.splitWith', { count: summary.totalCount })} (${pendingPeople} ${t('split.pending')})`;
                      return (
                        <Chip
                          leadingIcon="people-outline"
                          label={label}
                          selected
                          onPress={() => router.push(appHref(`/expense/split/${expenseId}`))}
                        />
                      );
                    }
                    return (
                      <Chip
                        leadingIcon="people-outline"
                        label={t('split.splitSpend')}
                        selected={false}
                        onPress={() => router.push(appHref(`/expense/split/${expenseId}`))}
                      />
                    );
                  })()}
                </View>
              ) : null}

              <SectionActionButton
                icon={more ? 'chevron-up-outline' : 'chevron-down-outline'}
                label={more ? t('spend.hideDetails') : t('spend.moreDetails')}
                tone="muted"
                onPress={() => setMore((value) => !value)}
                style={styles.moreTap}
              />

              {more ? (
                <>
                  {!isEdit ? (
                    <View style={styles.section}>
                      <Text style={sectionLabelStyle}>{t('spend.allCategories')}</Text>
                      <View style={styles.wrap}>
                        {activeCategories.map((item) => (
                          <Chip
                            key={item.id}
                            icon={iconForExpenseCategory(item.id, expenseCatalog)}
                            label={expenseCategoryLabel(t, item.id, expenseCatalog)}
                            selected={category === item.id}
                            onPress={() => selectCategory(item.id)}
                          />
                        ))}
                      </View>
                    </View>
                  ) : null}
                  {assets.length > 0 ? (
                    <View style={styles.section}>
                      <Text style={sectionLabelStyle}>{t('spend.account')}</Text>
                      <View style={styles.wrap}>
                        {assets.map((asset) => (
                          <Chip
                            key={asset.id}
                            label={asset.name}
                            selected={assetId === asset.id}
                            onPress={() => setAssetId(assetId === asset.id ? undefined : asset.id)}
                          />
                        ))}
                      </View>
                    </View>
                  ) : null}
                  <PhotoAttachments
                    ref={photoAttachmentsRef}
                    uris={photos}
                    onChange={setPhotos}
                    onOcrText={(desc, ocr) => {
                      setNote(desc);
                      if (!amount && ocr.amount) {
                        setAmount(amountToExpression(ocr.amount));
                      }
                      if (ocr.currency) {
                        setCurrency(ocr.currency);
                      }
                    }}
                  />
                  {!isEdit ? (
                    <View style={styles.repeatBlock}>
                      <Pressable
                        onPress={() => setWeekdayRepeat((value) => !value)}
                        style={styles.moreTap}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: weekdayRepeat }}
                      >
                        <Text style={[linkStyle, { color: weekdayRepeat ? colors.accent : colors.muted }]}>
                          {weekdayRepeat ? t('spend.repeatOn') : t('spend.repeatOff')}
                        </Text>
                      </Pressable>
                      {weekdayRepeat ? (
                        <View style={styles.wrap}>
                          {REPEAT_FREQUENCIES.map((freq) => (
                            <Chip
                              key={freq}
                              label={t(`spend.freq.${freq}`)}
                              selected={repeatFrequency === freq}
                              onPress={() => setRepeatFrequency(freq)}
                            />
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </>
              ) : null}

              {isEdit ? (
                <SectionActionButton
                  icon="trash-outline"
                  label={t('spend.removeLink')}
                  tone="accent"
                  style={[styles.moreTap, { borderColor: colors.danger }]}
                  onPress={onDelete}
                />
              ) : null}
            </FormCard>
    </FormCardGroup>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: fonts.bodyMedium },
  meta: { fontFamily: fonts.body },
  section: { gap: 8 },
  sectionLabel: {
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  estimateBlock: {
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  estimateLine: { fontFamily: fonts.bodyMedium },
  estimateHint: { fontFamily: fonts.body },
  hint: { fontFamily: fonts.body },
  sameHit: { minHeight: 36, justifyContent: 'center' },
  same: { fontFamily: fonts.bodyMedium },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', alignItems: 'flex-start' },
  /** Compact 4×2 category grid — ~100–110pt total with icon + short label cells. */
  categoryGrid: { gap: 8, width: '100%', maxHeight: 110 },
  categoryRow: { flexDirection: 'row', gap: 8, width: '100%' },
  categoryCell: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    maxHeight: 52,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  categoryLabel: {
    fontFamily: fonts.bodyMedium,
    textAlign: 'center',
    maxWidth: '100%',
  },
  recentScroll: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  note: {
    fontFamily: fonts.body,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  scanReceiptBtn: {
    alignSelf: 'flex-start',
  },
  rebateBanner: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'stretch',
  },
  rebateBannerText: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    lineHeight: 20,
  },
  rebatePreview: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'stretch',
  },
  rebatePreviewText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  moreTap: { minHeight: 44, justifyContent: 'center' },
  bumpRow: { flexDirection: 'row', gap: 8, width: '100%' },
  bumpPill: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  repeatBlock: { gap: 8 },
  missing: { paddingHorizontal: 24, gap: 12 },
  missingText: { fontFamily: fonts.display },
});
