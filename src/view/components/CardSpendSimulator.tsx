import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatFriendlyMoney } from '../../model/finance/Expense';
import { calculateTransactionRebate } from '../../model/finance/creditCardRebates';
import type { CreditCardAccount } from '../../model/reminders/creditCards';
import type { MoneyCurrency } from '../../model/settings/AppSettings';
import { hapticLight } from '../../utils/haptics';
import { useI18n } from '../i18n';
import { TYPE_ICON_SIZE } from '../icons/typeIcons';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface, raisedSurface } from '../theme/tokens';
import { useTypography } from '../theme/TypographyProvider';
import { categoryLabel } from './CardPresetModal';
import { Chip } from './Chip';
import { GlassSurface } from './GlassSurface';

interface CardSpendSimulatorProps {
  card: Partial<CreditCardAccount>;
  currency?: MoneyCurrency;
}

const AMOUNT_BUMPS = [100, 500, 1000, 2000] as const;
const SIMULATOR_CATEGORIES = ['dining', 'online', 'groceries', 'transport', 'other'] as const;

/**
 * Purpose: live spend → rebate preview while editing card rates, rules, and caps.
 * Inputs: partial draft card fields + optional reporting currency (default HKD).
 * Outputs: GlassSurface with amount pills, category chips, and real-time rebate result.
 * Side effects: light haptic on amount bump taps; no persistence.
 * Design decisions: synthesizes a minimal CreditCardAccount so calculateTransactionRebate
 *   can run against draft form state without a saved id; month expenses stay empty so the
 *   preview reflects rules/caps in isolation.
 */
export function CardSpendSimulator({ card, currency = 'HKD' }: CardSpendSimulatorProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const { type, scaleFontSize } = useTypography();

  const [testAmount, setTestAmount] = useState(500);
  const [amountDraft, setAmountDraft] = useState('500');
  const [selectedCategory, setSelectedCategory] =
    useState<(typeof SIMULATOR_CATEGORIES)[number]>('dining');

  const syntheticCard = useMemo(() => toSyntheticCard(card), [card]);

  const rebateResult = useMemo(
    () =>
      calculateTransactionRebate(
        syntheticCard,
        testAmount,
        selectedCategory,
        new Date(),
        [],
      ),
    [syntheticCard, testAmount, selectedCategory],
  );

  const bumpAmount = (delta: number) => {
    void hapticLight();
    const next = Math.max(0, Math.round((testAmount + delta) * 100) / 100);
    setTestAmount(next);
    setAmountDraft(String(next));
  };

  const commitAmountDraft = (raw: string) => {
    const parsed = Number(raw.replace(/,/g, ''));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setAmountDraft(String(testAmount));
      return;
    }
    const next = Math.round(parsed * 100) / 100;
    setTestAmount(next);
    setAmountDraft(String(next));
  };

  const rateBadge = formatRatePercent(rebateResult.effectiveRate);
  const rebateLabel = `+${formatFriendlyMoney(rebateResult.rebateAmount, currency)}`;
  const capLabel = rebateResult.isCapExceeded
    ? t('cardRewards.capStatusExceeded')
    : rebateResult.capRemaining !== undefined
      ? t('cardRewards.capStatusRemaining', {
          remaining: formatFriendlyMoney(rebateResult.capRemaining, currency),
        })
      : null;

  return (
    <GlassSurface style={styles.card} radius={22}>
      <View style={styles.header} accessibilityRole="header">
        <View style={[raisedSurface(colors, 14), styles.iconWell]} accessible={false}>
          <Ionicons name="calculator-outline" size={TYPE_ICON_SIZE} color={colors.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={[type.headline, { color: colors.ink }]} numberOfLines={2}>
            {t('cardRewards.simulatorTitle')}
          </Text>
          <Text style={[type.footnote, { color: colors.muted }]} numberOfLines={3}>
            {t('cardRewards.simulatorDesc')}
          </Text>
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: colors.faint }]}>{t('cardRewards.testAmount')}</Text>
        <View style={styles.chipWrap}>
          {AMOUNT_BUMPS.map((bump) => (
            <Chip
              key={bump}
              label={`+${bump.toLocaleString('en-US')}`}
              selected={false}
              onPress={() => bumpAmount(bump)}
              scalable={false}
            />
          ))}
        </View>
        <TextInput
          value={amountDraft}
          onChangeText={(text) => {
            const cleaned = text.replace(/[^\d.]/g, '');
            setAmountDraft(cleaned);
            const parsed = Number(cleaned);
            if (Number.isFinite(parsed) && parsed >= 0) {
              setTestAmount(Math.round(parsed * 100) / 100);
            }
          }}
          onBlur={() => commitAmountDraft(amountDraft)}
          keyboardType="decimal-pad"
          selectTextOnFocus
          placeholder="500"
          placeholderTextColor={colors.faint}
          style={[insetSurface(colors, 16), styles.amountInput, { color: colors.ink }]}
          accessibilityLabel={t('cardRewards.testAmount')}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: colors.faint }]}>{t('cardRewards.testCategory')}</Text>
        <View style={styles.chipWrap}>
          {SIMULATOR_CATEGORIES.map((category) => (
            <Chip
              key={category}
              label={categoryLabel(t, category)}
              selected={selectedCategory === category}
              onPress={() => setSelectedCategory(category)}
            />
          ))}
        </View>
      </View>

      <View
        style={[insetSurface(colors, 18), styles.resultWell]}
        accessibilityRole="summary"
        accessibilityLabel={t('cardRewards.simulatedReturn', {
          amount: rebateLabel,
          rate: rateBadge,
        })}
      >
        <View style={styles.resultTop}>
          <Text
            style={[
              styles.rebateAmount,
              { color: colors.accent, fontSize: scaleFontSize(28) },
            ]}
            numberOfLines={1}
          >
            {rebateLabel}
          </Text>
          <View style={[styles.rateBadge, { backgroundColor: colors.accentSoft }]}>
            <Text
              style={[
                styles.rateBadgeText,
                { color: colors.accent, fontSize: scaleFontSize(13) },
              ]}
            >
              {rateBadge}
            </Text>
          </View>
        </View>

        <Text style={[type.subhead, { color: colors.ink }]} numberOfLines={3}>
          {rebateResult.explanation}
        </Text>

        {capLabel ? (
          <View
            style={[
              styles.capBadge,
              {
                backgroundColor: rebateResult.isCapExceeded
                  ? `${colors.danger}22`
                  : colors.well,
              },
            ]}
          >
            <Text
              style={[
                styles.capBadgeText,
                {
                  color: rebateResult.isCapExceeded ? colors.danger : colors.muted,
                  fontSize: scaleFontSize(12),
                },
              ]}
              numberOfLines={2}
            >
              {capLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </GlassSurface>
  );
}

/**
 * Purpose: build a calculable CreditCardAccount from draft/partial editor fields.
 * Inputs: Partial card bag from the form.
 * Outputs: CreditCardAccount with stable simulator id and safe defaults.
 * Side effects: none.
 */
function toSyntheticCard(partial: Partial<CreditCardAccount>): CreditCardAccount {
  const now = new Date().toISOString();
  return {
    id: partial.id?.trim() || 'simulator-draft',
    name: partial.name?.trim() || 'Card',
    dueDayOfMonth: partial.dueDayOfMonth ?? 1,
    statementDayOfMonth: partial.statementDayOfMonth ?? 1,
    amountDue: partial.amountDue,
    currentBalance: partial.currentBalance,
    bankId: partial.bankId,
    bankName: partial.bankName,
    cardTier: partial.cardTier,
    rewardType: partial.rewardType,
    baseRebateRate: partial.baseRebateRate,
    rebateRules: partial.rebateRules,
    monthlySpendCap: partial.monthlySpendCap,
    monthlyRebateCap: partial.monthlyRebateCap,
    annualSpendCap: partial.annualSpendCap,
    minMonthlySpendRequirement: partial.minMonthlySpendRequirement,
    promotions: partial.promotions,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}

/**
 * Purpose: show effective rebate fraction as a compact percent badge.
 * Inputs: rate fraction (0.05 → 5.0%).
 * Outputs: percent label with one decimal when needed.
 * Side effects: none.
 */
function formatRatePercent(rate: number): string {
  const pct = (Number.isFinite(rate) ? rate : 0) * 100;
  const rounded = Math.round(pct * 10) / 10;
  const body = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${body}%`;
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWell: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amountInput: {
    fontFamily: fonts.display,
    fontSize: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 52,
    fontVariant: ['tabular-nums'],
  },
  resultWell: {
    padding: 16,
    gap: 10,
  },
  resultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  rebateAmount: {
    fontFamily: fonts.display,
    flexShrink: 1,
    minWidth: 0,
    fontVariant: ['tabular-nums'],
  },
  rateBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rateBadgeText: {
    fontFamily: fonts.bodySemi,
    fontVariant: ['tabular-nums'],
  },
  capBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  capBadgeText: {
    fontFamily: fonts.bodyMedium,
    fontVariant: ['tabular-nums'],
  },
});
