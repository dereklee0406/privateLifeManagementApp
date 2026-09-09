import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import { dayKeyFromDate } from '../../controller/dateFieldValue';
import { formatFriendlyMoney } from '../../model/finance/Expense';
import {
  BUILTIN_BANKS,
  type BuiltinBankId,
  type PopularCardPreset,
} from '../../model/finance/creditCardRebates';
import { EXPENSE_CATEGORIES } from '../../model/finance/expenseCategories';
import {
  defaultCreditCardPings,
  type CardBankPromotion,
  type CardRebateRule,
  type CardRewardType,
  type CreditCardPingDraft,
  type CreditCardPingRole,
} from '../../model/reminders/creditCards';
import type { MoneyCurrency } from '../../model/settings/AppSettings';
import { createId } from '../../utils/idUtils';
import { hapticLight, hapticSuccess } from '../../utils/haptics';
import { bankDisplayName, CardPresetModal, categoryLabel } from '../components/CardPresetModal';
import { CardBillingCycleCard } from '../components/CardBillingCycleCard';
import { CardSpendSimulator } from '../components/CardSpendSimulator';
import { Chip } from '../components/Chip';
import { GlassSurface } from '../components/GlassSurface';
import { KeyboardDismissScrollView } from '../components/KeyboardDismissScrollView';
import { NumberStepper } from '../components/NumberStepper';
import { PrimaryButton } from '../components/PrimaryButton';
import { PromoEditorModal } from '../components/PromoEditorModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SectionActionButton } from '../components/SectionActionButton';
import { SheetChrome } from '../components/SheetChrome';
import { TextButton } from '../components/TextButton';
import { TimeWheels } from '../components/TimeWheels';
import type { TypeIconName } from '../icons/typeIcons';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface, raisedSurface } from '../theme/tokens';
import { type } from '../theme/typography';

const BASE_RATE_PRESETS = [0.004, 0.01, 0.015, 0.02] as const;

const REBATE_CATEGORIES: string[] = [
  ...EXPENSE_CATEGORIES.map((row) => row.id),
  'online',
  'overseas',
  'all',
];

type EditTabId = 'billing' | 'rewards' | 'promos';

const EDIT_TABS: ReadonlyArray<{
  id: EditTabId;
  labelKey: 'cardRewards.tabCardBilling' | 'cardRewards.tabCashbackCaps' | 'cardRewards.tabPromosReminders';
  icon: TypeIconName;
}> = [
  { id: 'billing', labelKey: 'cardRewards.tabCardBilling', icon: 'card-outline' },
  { id: 'rewards', labelKey: 'cardRewards.tabCashbackCaps', icon: 'sparkles-outline' },
  { id: 'promos', labelKey: 'cardRewards.tabPromosReminders', icon: 'notifications-outline' },
];

/**
 * Purpose: create/edit a credit-card parent plus statement/due pings, bank, rebate rules, and promos.
 * Inputs: route id `new` or account id.
 * Outputs: 3-tab form (billing / rewards / promos) with sticky save and live simulators.
 * Side effects: ReminderController.createCreditCard / update / add ping / delete.
 * Design decisions: domain-split tabs reduce cognitive load; CardBillingCycleCard owns statement/due
 *   steppers (civil 1–31); sticky PrimaryButton stays reachable without scrolling back.
 */
export function CreditCardEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new' || !id;
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { settings } = useSettings();
  const { creditCards, reminders, createCreditCard, updateCreditCard, addCreditCardPing, deleteCreditCard } =
    useReminders();
  const account = !isNew ? creditCards.find((item) => item.id === id) : undefined;
  const now = new Date();

  const [activeTab, setActiveTab] = useState<EditTabId>('billing');
  const [name, setName] = useState(account?.name ?? '');
  const [dueDay, setDueDay] = useState(account?.dueDayOfMonth ?? now.getDate());
  const [statementDay, setStatementDay] = useState(account?.statementDayOfMonth ?? Math.max(1, now.getDate() - 7));
  const [amount, setAmount] = useState(account?.amountDue !== undefined ? String(account.amountDue) : '');
  const [balance, setBalance] = useState(account?.currentBalance !== undefined ? String(account.currentBalance) : '');
  const [bankId, setBankId] = useState<string>(account?.bankId ?? 'other');
  const [bankName, setBankName] = useState(account?.bankName ?? '');
  const [cardTier, setCardTier] = useState(account?.cardTier ?? '');
  const [rewardType, setRewardType] = useState<CardRewardType>(account?.rewardType ?? 'cashback');
  const [baseRebateRate, setBaseRebateRate] = useState(account?.baseRebateRate ?? 0.004);
  const [baseRateDraft, setBaseRateDraft] = useState(formatPercentInput(account?.baseRebateRate ?? 0.004));
  const [rebateRules, setRebateRules] = useState<CardRebateRule[]>(() => [...(account?.rebateRules ?? [])]);
  const [monthlySpendCap, setMonthlySpendCap] = useState(
    account?.monthlySpendCap !== undefined ? String(account.monthlySpendCap) : '',
  );
  const [monthlyRebateCap, setMonthlyRebateCap] = useState(
    account?.monthlyRebateCap !== undefined ? String(account.monthlyRebateCap) : '',
  );
  const [minMonthlySpend, setMinMonthlySpend] = useState(
    account?.minMonthlySpendRequirement !== undefined ? String(account.minMonthlySpendRequirement) : '',
  );
  const [promotions, setPromotions] = useState<CardBankPromotion[]>(() => [...(account?.promotions ?? [])]);
  const [pings, setPings] = useState<CreditCardPingDraft[]>(() => {
    if (account) {
      return reminders
        .filter((item) => item.accountId === account.id)
        .map((item) => ({
          role: item.pingRole ?? 'custom',
          title: item.title,
          dayOfMonth: item.recurrence.type === 'monthly' ? item.recurrence.dayOfMonth : dueDay,
          hour: item.hour,
          minute: item.minute,
          enabled: item.enabled,
        }));
    }
    return defaultCreditCardPings({
      name: 'Card',
      dueDayOfMonth: now.getDate(),
      statementDayOfMonth: Math.max(1, now.getDate() - 7),
    });
  });
  const [saving, setSaving] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [promoDraft, setPromoDraft] = useState<CardBankPromotion | null>(null);
  const [ruleDraft, setRuleDraft] = useState<CardRebateRule | null>(null);

  useEffect(() => {
    if (!account) {
      return;
    }
    setName(account.name);
    setDueDay(account.dueDayOfMonth);
    setStatementDay(account.statementDayOfMonth);
    setAmount(account.amountDue !== undefined ? String(account.amountDue) : '');
    setBalance(account.currentBalance !== undefined ? String(account.currentBalance) : '');
    setBankId(account.bankId ?? 'other');
    setBankName(account.bankName ?? '');
    setCardTier(account.cardTier ?? '');
    setRewardType(account.rewardType ?? 'cashback');
    setBaseRebateRate(account.baseRebateRate ?? 0.004);
    setBaseRateDraft(formatPercentInput(account.baseRebateRate ?? 0.004));
    setRebateRules([...(account.rebateRules ?? [])]);
    setMonthlySpendCap(account.monthlySpendCap !== undefined ? String(account.monthlySpendCap) : '');
    setMonthlyRebateCap(account.monthlyRebateCap !== undefined ? String(account.monthlyRebateCap) : '');
    setMinMonthlySpend(
      account.minMonthlySpendRequirement !== undefined ? String(account.minMonthlySpendRequirement) : '',
    );
    setPromotions([...(account.promotions ?? [])]);
  }, [account?.id]);

  const amountDue = useMemo(() => parseOptionalNumber(amount), [amount]);
  const currentBalance = useMemo(() => parseOptionalNumber(balance), [balance]);

  const draftCard = useMemo(
    () => ({
      name: name.trim() || t('money.card'),
      dueDayOfMonth: dueDay,
      statementDayOfMonth: statementDay,
      bankId,
      bankName: bankName.trim() || bankDisplayName(t, bankId),
      cardTier: cardTier.trim() || undefined,
      rewardType,
      baseRebateRate,
      rebateRules,
      monthlySpendCap: parseOptionalNumber(monthlySpendCap),
      monthlyRebateCap: parseOptionalNumber(monthlyRebateCap),
      minMonthlySpendRequirement: parseOptionalNumber(minMonthlySpend),
      promotions,
    }),
    [
      name,
      dueDay,
      statementDay,
      bankId,
      bankName,
      cardTier,
      rewardType,
      baseRebateRate,
      rebateRules,
      monthlySpendCap,
      monthlyRebateCap,
      minMonthlySpend,
      promotions,
      t,
    ],
  );

  const applyPreset = (preset: PopularCardPreset) => {
    setName(preset.name);
    setBankId(preset.bankId);
    setBankName(preset.bankName);
    setCardTier(preset.cardTier ?? '');
    setRewardType(preset.rewardType);
    setBaseRebateRate(preset.baseRebateRate);
    setBaseRateDraft(formatPercentInput(preset.baseRebateRate));
    setRebateRules(preset.rebateRules.map((rule) => ({ ...rule })));
    setMonthlySpendCap(preset.monthlySpendCap !== undefined ? String(preset.monthlySpendCap) : '');
    setMonthlyRebateCap(preset.monthlyRebateCap !== undefined ? String(preset.monthlyRebateCap) : '');
    setMinMonthlySpend(
      preset.minMonthlySpendRequirement !== undefined ? String(preset.minMonthlySpendRequirement) : '',
    );
    if (preset.promotions?.length) {
      setPromotions(preset.promotions.map((promo) => ({ ...promo })));
    }
  };

  const onSelectBank = (nextId: BuiltinBankId) => {
    void hapticLight();
    setBankId(nextId);
    setBankName(bankDisplayName(t, nextId));
  };

  const onSelectTab = (tab: EditTabId) => {
    if (tab === activeTab) {
      return;
    }
    void hapticLight();
    setActiveTab(tab);
  };

  const save = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim() || t('money.card'),
        dueDayOfMonth: dueDay,
        statementDayOfMonth: statementDay,
        amountDue,
        currentBalance,
        bankId,
        bankName: bankName.trim() || bankDisplayName(t, bankId),
        cardTier: cardTier.trim() || undefined,
        rewardType,
        baseRebateRate,
        rebateRules,
        monthlySpendCap: parseOptionalNumber(monthlySpendCap),
        monthlyRebateCap: parseOptionalNumber(monthlyRebateCap),
        minMonthlySpendRequirement: parseOptionalNumber(minMonthlySpend),
        promotions,
        pings,
      };
      if (isNew) {
        await createCreditCard(payload);
      } else if (id) {
        await updateCreditCard(id, payload);
      }
      await hapticSuccess();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    const run = () => void deleteCreditCard(id!).then(() => router.back());
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(t('money.deleteCardConfirmBody'))) {
        run();
      }
      return;
    }
    Alert.alert(t('money.deleteCardConfirmTitle'), t('money.deleteCardConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: run },
    ]);
  };

  const addExtra = async () => {
    const extra: CreditCardPingDraft = {
      role: 'custom',
      title: `${name.trim() || t('money.card')} ${t('money.addPing')}`,
      dayOfMonth: dueDay,
      hour: 10,
      minute: 0,
      enabled: true,
    };
    if (isNew) {
      setPings((current) => [...current, extra]);
      return;
    }
    if (id) {
      await addCreditCardPing(id, extra);
      setPings((current) => [...current, extra]);
    }
  };

  const headerTitle = isNew ? t('money.addCard') : name.trim() || t('money.card');

  const pingRoleLabel = (role: CreditCardPingRole): string => {
    if (role === 'statement') {
      return t('reminder.pingStatement');
    }
    if (role === 'due') {
      return t('reminder.pingDue');
    }
    return t('reminder.pingExtra');
  };

  const openNewRule = () => {
    setRuleDraft({
      id: createId(),
      category: 'dining',
      rebateRate: 0.05,
    });
  };

  /**
   * Purpose: open RuleEditorModal prefilled with an existing category rebate rule.
   * Inputs: `rule` already in `rebateRules`.
   * Outputs: none (sets `ruleDraft` state).
   * Side effects: none besides state update.
   * Design decisions: shallow copy so modal edits do not mutate list until Save.
   */
  const openEditRule = (rule: CardRebateRule) => {
    void hapticLight();
    setRuleDraft({ ...rule });
  };

  /**
   * Purpose: reorder category rebate rules so array index defines evaluation priority.
   * Inputs: `index` of the rule to move; `direction` `'up'` | `'down'`.
   * Outputs: none (updates `rebateRules` state).
   * Side effects: `hapticLight` on a successful swap; no-op at list bounds.
   * Design decisions: array order matches `findMatchingRule` first-match precedence
   *   (top-to-bottom); preserves ids so RuleEditorModal edits keep position.
   */
  const moveRule = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= rebateRules.length) {
      return;
    }
    void hapticLight();
    setRebateRules((current) => {
      if (target < 0 || target >= current.length || index < 0 || index >= current.length) {
        return current;
      }
      const next = [...current];
      const swap = next[index]!;
      next[index] = next[target]!;
      next[target] = swap;
      return next;
    });
  };

  const openNewPromo = () => {
    const today = dayKeyFromDate(new Date());
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    setPromoDraft({
      id: createId(),
      title: '',
      extraRebateRate: 0.03,
      startDate: today,
      endDate: dayKeyFromDate(end),
      requiresRegistration: true,
      isRegistered: false,
    });
  };

  return (
    <ScreenScaffold>
      <ScreenHeader
        title={headerTitle}
        trailingIcon={!isNew ? 'trash-outline' : undefined}
        trailingLabel={!isNew ? t('common.delete') : undefined}
        trailingTone="danger"
        onTrailing={!isNew ? onDelete : undefined}
      />

      <View style={[styles.tabBar, { borderBottomColor: colors.line }]}>
        {EDIT_TABS.map((tab) => {
          const selected = activeTab === tab.id;
          const tint = selected ? colors.accent : colors.faint;
          return (
            <Pressable
              key={tab.id}
              onPress={() => onSelectTab(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={t(tab.labelKey)}
              style={[
                styles.tab,
                selected
                  ? { borderBottomColor: colors.accent, borderBottomWidth: 2 }
                  : { borderBottomColor: 'transparent', borderBottomWidth: 2 },
              ]}
            >
              <Ionicons name={tab.icon} size={18} color={tint} accessible={false} importantForAccessibility="no" />
              <Text style={[styles.tabLabel, { color: tint }]} numberOfLines={1}>
                {t(tab.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <KeyboardDismissScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'billing' ? (
          <>
            <Text style={[type.subhead, { color: colors.muted }]}>{t('money.cardLede')}</Text>

            <SectionActionButton
              icon="sparkles-outline"
              label={t('cardRewards.choosePreset')}
              onPress={() => setPresetOpen(true)}
              style={styles.blockAction}
            />

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.faint }]}>{t('money.cardName')}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('money.cardNamePlaceholder')}
                placeholderTextColor={colors.faint}
                style={[insetSurface(colors, 16), styles.nameInput, { color: colors.ink }]}
                autoCapitalize="words"
                autoCorrect={false}
                autoFocus={isNew}
                accessibilityLabel={t('money.cardName')}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.faint }]}>{t('cardRewards.bank')}</Text>
              <View style={styles.chipWrap}>
                {BUILTIN_BANKS.map((bank) => {
                  const selected = bankId === bank.id;
                  const iconName = (bank.icon in Ionicons.glyphMap ? bank.icon : 'business-outline') as TypeIconName;
                  return (
                    <Pressable
                      key={bank.id}
                      onPress={() => onSelectBank(bank.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={bankDisplayName(t, bank.id, bank.name)}
                      style={[
                        raisedSurface(colors, 14),
                        styles.bankChip,
                        {
                          borderColor: selected ? bank.brandColor : 'transparent',
                          borderWidth: selected ? 1.5 : 0,
                        },
                      ]}
                    >
                      <View style={[styles.bankDot, { backgroundColor: bank.brandColor }]}>
                        <Ionicons name={iconName} size={12} color="#FFF" />
                      </View>
                      <Text
                        style={[styles.bankChipLabel, { color: selected ? colors.accent : colors.ink }]}
                        numberOfLines={1}
                      >
                        {bankDisplayName(t, bank.id, bank.name)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.faint }]}>{t('cardRewards.cardTier')}</Text>
              <TextInput
                value={cardTier}
                onChangeText={setCardTier}
                placeholder={t('cardRewards.cardTierPlaceholder')}
                placeholderTextColor={colors.faint}
                style={[insetSurface(colors, 16), styles.amount, { color: colors.ink }]}
                autoCapitalize="words"
                accessibilityLabel={t('cardRewards.cardTier')}
              />
            </View>

            <CardBillingCycleCard
              statementDay={statementDay}
              dueDay={dueDay}
              onStatementDayChange={(day) => {
                setStatementDay(day);
                setPings((c) => c.map((p) => (p.role === 'statement' ? { ...p, dayOfMonth: day } : p)));
              }}
              onDueDayChange={(day) => {
                setDueDay(day);
                setPings((c) => c.map((p) => (p.role === 'due' ? { ...p, dayOfMonth: day } : p)));
              }}
            />

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.faint }]}>{t('money.amountDueOptional')}</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder={t('money.amountDueOptional')}
                placeholderTextColor={colors.faint}
                keyboardType="decimal-pad"
                style={[insetSurface(colors, 16), styles.amount, { color: colors.ink }]}
                accessibilityLabel={t('money.amountDueOptional')}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.faint }]}>{t('cardRewards.balanceOptional')}</Text>
              <TextInput
                value={balance}
                onChangeText={setBalance}
                placeholder={t('cardRewards.balanceOptional')}
                placeholderTextColor={colors.faint}
                keyboardType="decimal-pad"
                style={[insetSurface(colors, 16), styles.amount, { color: colors.ink }]}
                accessibilityLabel={t('cardRewards.balanceOptional')}
              />
            </View>
          </>
        ) : null}

        {activeTab === 'rewards' ? (
          <>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.faint }]}>{t('cardRewards.rewardType')}</Text>
              <View style={styles.chipWrap}>
                {(
                  [
                    ['cashback', t('cardRewards.rewardCashback')],
                    ['miles', t('cardRewards.rewardMiles')],
                    ['points', t('cardRewards.rewardPoints')],
                  ] as const
                ).map(([value, label]) => (
                  <Chip
                    key={value}
                    label={label}
                    selected={rewardType === value}
                    onPress={() => setRewardType(value)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.faint }]}>{t('cardRewards.baseRebateRate')}</Text>
              <View style={styles.chipWrap}>
                {BASE_RATE_PRESETS.map((rate) => (
                  <Chip
                    key={rate}
                    label={`${formatPercentInput(rate)}%`}
                    selected={nearlyEqual(baseRebateRate, rate)}
                    onPress={() => {
                      setBaseRebateRate(rate);
                      setBaseRateDraft(formatPercentInput(rate));
                    }}
                  />
                ))}
              </View>
              <Text style={[styles.customRateLabel, { color: colors.muted }]}>{t('cardRewards.customRate')}</Text>
              <View style={[insetSurface(colors, 16), styles.affixWell]}>
                <TextInput
                  value={baseRateDraft}
                  onChangeText={(text) => {
                    setBaseRateDraft(text);
                    const parsed = Number(text);
                    if (Number.isFinite(parsed) && parsed >= 0) {
                      setBaseRebateRate(parsed / 100);
                    }
                  }}
                  placeholder="0.4"
                  placeholderTextColor={colors.faint}
                  keyboardType="decimal-pad"
                  style={[styles.affixInput, { color: colors.ink }]}
                  accessibilityLabel={t('cardRewards.customRate')}
                />
                <View style={[styles.affixBadge, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.affixBadgeText, { color: colors.accent }]}>%</Text>
                </View>
              </View>
            </View>

            <View style={styles.rowCaps}>
              <OptionalNumberField
                label={t('cardRewards.monthlySpendCap')}
                value={monthlySpendCap}
                onChangeText={setMonthlySpendCap}
                colors={colors}
                currency={settings.defaultCurrency}
                placeholder={t('cardRewards.capPlaceholder')}
              />
              <OptionalNumberField
                label={t('cardRewards.monthlyRebateCap')}
                value={monthlyRebateCap}
                onChangeText={setMonthlyRebateCap}
                colors={colors}
                currency={settings.defaultCurrency}
                placeholder={t('cardRewards.capPlaceholder')}
              />
            </View>
            <OptionalNumberField
              label={t('cardRewards.minMonthlySpend')}
              value={minMonthlySpend}
              onChangeText={setMinMonthlySpend}
              colors={colors}
              currency={settings.defaultCurrency}
              placeholder={t('cardRewards.minSpendPlaceholder')}
            />

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('cardRewards.rebateRules')}</Text>
              <SectionActionButton icon="add-outline" label={t('cardRewards.addRebateRule')} onPress={openNewRule} />
            </View>
            <Text style={[styles.meta, { color: colors.muted }]}>{t('cardRewards.rulePriorityNote')}</Text>
            {rebateRules.length === 0 ? (
              <Text style={[styles.meta, { color: colors.muted }]}>{t('cardRewards.noRebateRules')}</Text>
            ) : (
              rebateRules.map((rule, index) => (
                <GlassSurface key={rule.id} style={styles.ruleCard} radius={20}>
                  <View style={styles.ruleTop}>
                    <Pressable
                      onPress={() => openEditRule(rule)}
                      style={styles.ruleTitleBlock}
                      accessibilityRole="button"
                      accessibilityLabel={t('cardRewards.editRebateRule')}
                    >
                      <View style={styles.ruleTitleRow}>
                        <Text
                          style={[styles.priorityBadge, { color: colors.accent, backgroundColor: colors.accentSoft }]}
                          accessibilityLabel={t('cardRewards.rulePriority', { rank: index + 1 })}
                        >
                          #{index + 1}
                        </Text>
                        <Ionicons name="create-outline" size={16} color={colors.muted} accessible={false} />
                      </View>
                      <Text style={[styles.ruleTitle, { color: colors.ink }]}>
                        {categoryLabel(t, rule.category)} · {formatPercentInput(rule.rebateRate)}%
                      </Text>
                      <Text style={[styles.ruleSubtitle, { color: colors.muted }]}>
                        {[
                          rule.monthlySpendCap !== undefined
                            ? `${t('cardRewards.spendCap')} ${formatFriendlyMoney(rule.monthlySpendCap, settings.defaultCurrency)}`
                            : null,
                          rule.monthlyRebateCap !== undefined
                            ? `${t('cardRewards.rebateCap')} ${formatFriendlyMoney(rule.monthlyRebateCap, settings.defaultCurrency)}`
                            : null,
                          rule.minSpendPerTx !== undefined
                            ? `${t('cardRewards.minSpendPerTx')} ${formatFriendlyMoney(rule.minSpendPerTx, settings.defaultCurrency)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || t('cardRewards.optionalCap')}
                      </Text>
                    </Pressable>
                    <View style={styles.ruleActions}>
                      <Pressable
                        onPress={() => moveRule(index, 'up')}
                        disabled={index === 0}
                        style={styles.iconHit}
                        accessibilityRole="button"
                        accessibilityLabel={t('cardRewards.moveRuleUp')}
                        accessibilityState={{ disabled: index === 0 }}
                      >
                        <Ionicons
                          name="chevron-up"
                          size={20}
                          color={index === 0 ? colors.faint : colors.ink}
                          accessible={false}
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => moveRule(index, 'down')}
                        disabled={index === rebateRules.length - 1}
                        style={styles.iconHit}
                        accessibilityRole="button"
                        accessibilityLabel={t('cardRewards.moveRuleDown')}
                        accessibilityState={{ disabled: index === rebateRules.length - 1 }}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={20}
                          color={index === rebateRules.length - 1 ? colors.faint : colors.ink}
                          accessible={false}
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => setRebateRules((current) => current.filter((item) => item.id !== rule.id))}
                        style={styles.iconHit}
                        accessibilityRole="button"
                        accessibilityLabel={t('cardRewards.removeRule')}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.danger} accessible={false} />
                      </Pressable>
                    </View>
                  </View>
                </GlassSurface>
              ))
            )}

            <CardSpendSimulator card={draftCard} currency={settings.defaultCurrency} />
          </>
        ) : null}

        {activeTab === 'promos' ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>{t('cardRewards.promotions')}</Text>
              <SectionActionButton icon="add-outline" label={t('cardRewards.addPromotion')} onPress={openNewPromo} />
            </View>
            {promotions.length === 0 ? (
              <Text style={[styles.meta, { color: colors.muted }]}>{t('cardRewards.noPromotions')}</Text>
            ) : (
              promotions.map((promo) => (
                <GlassSurface key={promo.id} style={styles.ruleCard} radius={20}>
                  <View style={styles.ruleTop}>
                    <Pressable onPress={() => setPromoDraft({ ...promo })} style={styles.promoTap}>
                      <Text style={[styles.ruleTitle, { color: colors.ink }]} numberOfLines={2}>
                        {promo.title.trim() || t('cardRewards.editPromotion')}
                      </Text>
                      <Text style={[styles.meta, { color: colors.muted }]}>
                        +{formatPercentInput(promo.extraRebateRate)}% · {promo.startDate} → {promo.endDate}
                      </Text>
                    </Pressable>
                    <TextButton
                      label={t('cardRewards.deletePromotion')}
                      tone="danger"
                      onPress={() => setPromotions((current) => current.filter((item) => item.id !== promo.id))}
                    />
                  </View>
                  {promo.requiresRegistration ? (
                    <View style={styles.enabled}>
                      <Text style={[styles.meta, { color: colors.muted }]}>{t('cardRewards.isRegistered')}</Text>
                      <Switch
                        value={promo.isRegistered}
                        onValueChange={(isRegistered) =>
                          setPromotions((current) =>
                            current.map((item) => (item.id === promo.id ? { ...item, isRegistered } : item)),
                          )
                        }
                        trackColor={{ false: colors.line, true: colors.accent }}
                        thumbColor={colors.scheme === 'dark' ? '#E4DDD4' : '#FFF8F2'}
                      />
                    </View>
                  ) : null}
                </GlassSurface>
              ))
            )}

            <Text style={[styles.label, { color: colors.faint }]}>{t('money.pings')}</Text>
            {pings.map((ping, index) => (
              <GlassSurface key={`${ping.role}-${index}`} style={styles.ping} radius={20}>
                <Text style={[styles.pingRole, { color: colors.accent }]}>{pingRoleLabel(ping.role)}</Text>
                <TextInput
                  value={ping.title}
                  onChangeText={(title) =>
                    setPings((current) => current.map((item, i) => (i === index ? { ...item, title } : item)))
                  }
                  style={[styles.pingTitle, { color: colors.ink }]}
                />
                <View style={styles.row}>
                  <NumberStepper
                    label={t('money.cardDay')}
                    value={ping.dayOfMonth}
                    min={1}
                    max={31}
                    onChange={(dayOfMonth) =>
                      setPings((current) => current.map((item, i) => (i === index ? { ...item, dayOfMonth } : item)))
                    }
                  />
                </View>
                <TimeWheels
                  hour={ping.hour}
                  minute={ping.minute}
                  onHourChange={(hour) =>
                    setPings((current) => current.map((item, i) => (i === index ? { ...item, hour } : item)))
                  }
                  onMinuteChange={(minute) =>
                    setPings((current) => current.map((item, i) => (i === index ? { ...item, minute } : item)))
                  }
                />
                <View style={styles.enabled}>
                  <Text style={[styles.meta, { color: colors.muted }]}>{t('common.done')}</Text>
                  <Switch
                    value={ping.enabled}
                    onValueChange={(enabled) =>
                      setPings((current) => current.map((item, i) => (i === index ? { ...item, enabled } : item)))
                    }
                    trackColor={{ false: colors.line, true: colors.accent }}
                    thumbColor={colors.scheme === 'dark' ? '#E4DDD4' : '#FFF8F2'}
                  />
                </View>
              </GlassSurface>
            ))}

            <SectionActionButton
              icon="notifications-outline"
              label={t('money.addPing')}
              onPress={() => void addExtra()}
              style={styles.blockAction}
            />
          </>
        ) : null}
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
        <PrimaryButton
          icon="checkmark-circle-outline"
          label={saving ? t('money.savingCard') : t('money.saveCard')}
          onPress={() => void save()}
          busy={saving}
        />
      </View>

      <CardPresetModal visible={presetOpen} onClose={() => setPresetOpen(false)} onSelect={applyPreset} />

      <RuleEditorModal
        draft={ruleDraft}
        isEditing={ruleDraft != null && rebateRules.some((item) => item.id === ruleDraft.id)}
        currency={settings.defaultCurrency}
        onClose={() => setRuleDraft(null)}
        onSave={(rule) => {
          setRebateRules((current) => {
            const index = current.findIndex((item) => item.id === rule.id);
            if (index >= 0) {
              const next = [...current];
              next[index] = rule;
              return next;
            }
            return [...current, rule];
          });
          setRuleDraft(null);
        }}
      />

      <PromoEditorModal
        draft={promoDraft}
        currency={settings.defaultCurrency}
        onClose={() => setPromoDraft(null)}
        onSave={(promo) => {
          setPromotions((current) => {
            const index = current.findIndex((item) => item.id === promo.id);
            if (index >= 0) {
              const next = [...current];
              next[index] = promo;
              return next;
            }
            return [...current, promo];
          });
          setPromoDraft(null);
        }}
      />
    </ScreenScaffold>
  );
}

/**
 * Purpose: optional numeric well for caps / thresholds with currency prefix badge.
 * Inputs: label, string value, change handler, theme colors, currency, placeholder.
 * Outputs: labeled inset row `[ HK$ ] [ value ]`.
 * Side effects: none besides onChangeText.
 * Design decisions: currency symbol (not ISO code) matches formatFriendlyMoney; empty means no limit.
 */
function OptionalNumberField({
  label,
  value,
  onChangeText,
  colors,
  currency,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  colors: ReturnType<typeof useThemeColors>;
  currency: MoneyCurrency;
  placeholder: string;
}) {
  return (
    <View style={[styles.fieldGroup, styles.flexField]}>
      <Text style={[styles.label, { color: colors.faint }]}>{label}</Text>
      <View style={[insetSurface(colors, 16), styles.affixWell]}>
        <View style={[styles.affixBadge, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.affixBadgeText, { color: colors.accent }]}>{currencySymbol(currency)}</Text>
        </View>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          keyboardType="decimal-pad"
          style={[styles.affixInput, { color: colors.ink }]}
          accessibilityLabel={label}
        />
      </View>
    </View>
  );
}

/**
 * Purpose: add/edit a category rebate rule in a sheet modal.
 * Inputs: draft rule or null; isEditing flag; currency; close/save.
 * Outputs: category chips + rate/cap fields with currency badges.
 * Side effects: none besides callbacks.
 */
function RuleEditorModal({
  draft,
  isEditing,
  currency,
  onClose,
  onSave,
}: {
  draft: CardRebateRule | null;
  isEditing: boolean;
  currency: MoneyCurrency;
  onClose: () => void;
  onSave: (rule: CardRebateRule) => void;
}) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const [category, setCategory] = useState('dining');
  const [rateDraft, setRateDraft] = useState('5');
  const [spendCap, setSpendCap] = useState('');
  const [rebateCap, setRebateCap] = useState('');
  const [minTx, setMinTx] = useState('');

  useEffect(() => {
    if (!draft) {
      return;
    }
    setCategory(draft.category);
    setRateDraft(formatPercentInput(draft.rebateRate));
    setSpendCap(draft.monthlySpendCap !== undefined ? String(draft.monthlySpendCap) : '');
    setRebateCap(draft.monthlyRebateCap !== undefined ? String(draft.monthlyRebateCap) : '');
    setMinTx(draft.minSpendPerTx !== undefined ? String(draft.minSpendPerTx) : '');
  }, [draft?.id]);

  if (!draft) {
    return null;
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={[styles.modalRoot, { backgroundColor: colors.paper }]}>
        <SheetChrome>
          <View style={styles.modalHeader}>
            <TextButton label={t('common.cancel')} tone="muted" onPress={onClose} />
            <Text style={[type.title2, { color: colors.ink }]}>
              {isEditing ? t('cardRewards.editRebateRule') : t('cardRewards.addRebateRule')}
            </Text>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: colors.faint }]}>{t('cardRewards.category')}</Text>
            <View style={styles.chipWrap}>
              {REBATE_CATEGORIES.map((id) => (
                <Chip
                  key={id}
                  label={categoryLabel(t, id)}
                  selected={category === id}
                  onPress={() => setCategory(id)}
                />
              ))}
            </View>
            <Text style={[styles.label, { color: colors.faint }]}>{t('cardRewards.rebateRatePercent')}</Text>
            <View style={[insetSurface(colors, 16), styles.affixWell]}>
              <TextInput
                value={rateDraft}
                onChangeText={setRateDraft}
                keyboardType="decimal-pad"
                style={[styles.affixInput, { color: colors.ink }]}
                accessibilityLabel={t('cardRewards.rebateRatePercent')}
              />
              <View style={[styles.affixBadge, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.affixBadgeText, { color: colors.accent }]}>%</Text>
              </View>
            </View>
            <OptionalNumberField
              label={t('cardRewards.monthlySpendCap')}
              value={spendCap}
              onChangeText={setSpendCap}
              colors={colors}
              currency={currency}
              placeholder={t('cardRewards.capPlaceholder')}
            />
            <OptionalNumberField
              label={t('cardRewards.monthlyRebateCap')}
              value={rebateCap}
              onChangeText={setRebateCap}
              colors={colors}
              currency={currency}
              placeholder={t('cardRewards.capPlaceholder')}
            />
            <OptionalNumberField
              label={t('cardRewards.minSpendPerTx')}
              value={minTx}
              onChangeText={setMinTx}
              colors={colors}
              currency={currency}
              placeholder={t('cardRewards.minSpendPlaceholder')}
            />
            <PrimaryButton
              icon="checkmark-circle-outline"
              label={t('common.save')}
              onPress={() => {
                const rate = Number(rateDraft);
                onSave({
                  ...draft,
                  category,
                  rebateRate: Number.isFinite(rate) && rate >= 0 ? rate / 100 : draft.rebateRate,
                  monthlySpendCap: parseOptionalNumber(spendCap),
                  monthlyRebateCap: parseOptionalNumber(rebateCap),
                  minSpendPerTx: parseOptionalNumber(minTx),
                });
              }}
            />
          </ScrollView>
        </SheetChrome>
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * Purpose: parse optional money / cap fields from text inputs.
 * Inputs: raw string.
 * Outputs: finite number or undefined.
 * Side effects: none.
 */
function parseOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Purpose: girlfriend-facing currency symbol for input badges (matches formatFriendlyMoney).
 * Inputs: MoneyCurrency code.
 * Outputs: HK$ / US$ / CN¥.
 * Side effects: none.
 */
function currencySymbol(currency: MoneyCurrency): string {
  if (currency === 'HKD') {
    return 'HK$';
  }
  if (currency === 'USD') {
    return 'US$';
  }
  return 'CN¥';
}

/**
 * Purpose: show rebate fraction as a clean percent string for inputs/chips.
 * Inputs: rate fraction (0.004 → 0.4).
 * Outputs: string without trailing noise.
 * Side effects: none.
 */
function formatPercentInput(rate: number): string {
  const percent = rate * 100;
  if (!Number.isFinite(percent)) {
    return '0';
  }
  const rounded = Math.round(percent * 1000) / 1000;
  return String(rounded);
}

/**
 * Purpose: compare rebate rates without float flicker on chips.
 * Inputs: two fractions.
 * Outputs: true when within 0.00005.
 * Side effects: none.
 */
function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.00005;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 12 },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    minWidth: 0,
  },
  tabLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  stickyFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fieldGroup: { gap: 6 },
  flexField: { flex: 1, minWidth: 0 },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  customRateLabel: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  sectionTitle: { fontFamily: fonts.bodySemi, fontSize: 17 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  nameInput: {
    fontFamily: fonts.bodySemi,
    fontSize: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  amount: {
    fontFamily: fonts.body,
    fontSize: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  affixWell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 52,
  },
  affixInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.body,
    fontSize: 18,
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  affixBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  affixBadgeText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  bankDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankChipLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, flexShrink: 1 },
  rowCaps: { flexDirection: 'row', gap: 12 },
  ruleCard: { padding: 14, gap: 8 },
  ruleTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  ruleTitleBlock: { flex: 1, minWidth: 0, gap: 6 },
  ruleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleTitle: { fontFamily: fonts.bodySemi, fontSize: 15 },
  ruleSubtitle: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  priorityBadge: {
    alignSelf: 'flex-start',
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.4,
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ruleActions: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
  iconHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTap: { flex: 1, minWidth: 0, gap: 4 },
  ping: { padding: 16, gap: 10 },
  pingRole: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  pingTitle: { fontFamily: fonts.bodySemi, fontSize: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  enabled: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  meta: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, flex: 1, minWidth: 0 },
  blockAction: { alignSelf: 'flex-start', maxWidth: '100%' },
  modalRoot: { flex: 1 },
  modalHeader: { paddingHorizontal: 20, paddingBottom: 8, gap: 4 },
  modalBody: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
});
