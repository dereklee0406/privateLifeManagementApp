import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AppConfig } from '../../config/appConfig';
import { useFinance } from '../../controller/FinanceProvider';
import { useFxRates } from '../../controller/FxRateProvider';
import {
  evaluateAmountExpression,
  isCompleteAmountExpression,
} from '../../model/finance/amountCalculator';
import { INCOME_KINDS, type IncomeKind } from '../../model/finance/Income';
import type { MoneyCurrency } from '../../model/settings/AppSettings';
import { dateFromDayKey, dayKeyFromDate } from '../../controller/dateFieldValue';
import { toDayKey } from '../../utils/dateUtils';
import { hapticSuccess } from '../../utils/haptics';
import { AmountCalculatorField } from '../components/AmountCalculatorField';
import { Chip } from '../components/Chip';
import { DateField } from '../components/DateField';
import { FormCard, FormCardGroup } from '../components/FormCardGroup';
import { iconForType, typeA11yLabel } from '../icons/typeIcons';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { useTypography } from '../theme/TypographyProvider';
import { fonts, insetSurface } from '../theme/tokens';

/**
 * Purpose: log a manual income row (income only — not chained to a journal page).
 * Inputs: finance + FX cache.
 * Outputs: kind, calculator amount, HKD-default currency, date, note.
 * Side effects: FinanceController.createIncome; refresh FX on mount for keypad convert.
 * Design decisions: reuses the compact spend AmountCalculatorField so currency + evaluated
 *   number stay one pattern (including auto-convert when she switches HKD|USD|CNY). Layout is
 *   three grouped cards (Amount / Kind / Details) plus a sticky Keep bar so Kind, Date, Note,
 *   and save stay reachable without scrolling past a tall keypad.
 */
export function IncomeEditScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { type, scaleFontSize } = useTypography();
  const router = useRouter();
  const { createIncome } = useFinance();
  const { table: fx, refreshRates } = useFxRates();
  const [kind, setKind] = useState<IncomeKind>('salary');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<MoneyCurrency>(AppConfig.money.defaultCurrency);
  const [dayKey, setDayKey] = useState(toDayKey(new Date()));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const parsed = evaluateAmountExpression(amount);
  const canSave = isCompleteAmountExpression(amount) && !saving;
  const noteFontSize = scaleFontSize(16);
  const sectionLabelStyle = [
    styles.sectionLabel,
    type.footnote,
    { color: colors.muted, fontSize: scaleFontSize(13) },
  ];

  useEffect(() => {
    void refreshRates();
  }, [refreshRates]);

  const save = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    await createIncome({
      kind,
      amount: parsed,
      currency,
      dayKey,
      note,
    });
    await hapticSuccess();
    router.back();
  };

  return (
    <FormCardGroup
      title={t('money.logIncomeTitle')}
      headerTrailingIcon="checkmark"
      headerTrailingLabel={saving ? t('money.savingIncome') : t('money.keepIncome')}
      onHeaderTrailing={() => void save()}
      headerTrailingDisabled={!canSave}
      stickyButtonLabel={saving ? t('money.savingIncome') : t('money.keepIncome')}
      onStickyButtonPress={() => void save()}
      stickyButtonDisabled={!canSave}
      stickyButtonBusy={saving}
    >
      {/* Card 1 — Amount hero */}
      <View style={styles.amountBlock}>
        <AmountCalculatorField
          expression={amount}
          onChange={setAmount}
          currency={currency}
          onCurrencyChange={setCurrency}
          fxTable={fx}
        />
      </View>

      {/* Card 2 — Kind */}
      <FormCard>
        <Text style={sectionLabelStyle}>{t('money.incomeKind')}</Text>
        <View style={styles.wrap}>
          {INCOME_KINDS.map((item) => (
            <Chip
              key={item.id}
              icon={iconForType(item.id)}
              label={typeA11yLabel(t, item.id, item.label)}
              selected={kind === item.id}
              onPress={() => setKind(item.id)}
            />
          ))}
        </View>
      </FormCard>

      {/* Card 3 — Details (date + note) */}
      <FormCard>
        <DateField
          label={t('money.incomeDate')}
          value={dateFromDayKey(dayKey)}
          onChange={(next) => setDayKey(dayKeyFromDate(next))}
        />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t('money.incomeNotePlaceholder')}
          placeholderTextColor={colors.faint}
          style={[
            insetSurface(colors, 14),
            styles.note,
            {
              color: colors.ink,
              fontSize: noteFontSize,
              lineHeight: Math.round(noteFontSize * 1.35),
              minHeight: Math.max(48, Math.round(44 * Math.min(1.2, noteFontSize / 16))),
            },
          ]}
          returnKeyType="done"
          blurOnSubmit
        />
      </FormCard>
    </FormCardGroup>
  );
}

const styles = StyleSheet.create({
  amountBlock: { width: '100%' },
  sectionLabel: {
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    alignItems: 'flex-start',
  },
  note: {
    fontFamily: fonts.body,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
