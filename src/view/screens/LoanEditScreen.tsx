import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFinance } from '../../controller/FinanceProvider';
import { useFxRates } from '../../controller/FxRateProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import {
  amountToExpression,
  evaluateAmountExpression,
  isCompleteAmountExpression,
} from '../../model/finance/amountCalculator';
import { LOAN_KINDS, type LoanKind } from '../../model/finance/Loan';
import type { MoneyCurrency } from '../../model/settings/AppSettings';
import { hapticSuccess } from '../../utils/haptics';
import { AmountCalculatorField } from '../components/AmountCalculatorField';
import { Chip } from '../components/Chip';
import { FormCard, FormCardGroup } from '../components/FormCardGroup';
import { SectionActionButton } from '../components/SectionActionButton';
import { iconForType, typeA11yLabel } from '../icons/typeIcons';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { useTypography } from '../theme/TypographyProvider';
import { fonts, insetSurface } from '../theme/tokens';

/**
 * Purpose: create or edit a manual loan balance (mortgage / personal / car).
 * Inputs: optional route id; finance mutators; settings currency; FX table for the keypad.
 * Outputs: LoanDraft saved via FinanceProvider.
 * Side effects: create/update/delete loan; records this month’s net-worth snapshot; success haptic.
 * Design decisions: not an amortization table. reminderId stays optional and unset from this form
 *   so Worth stays a typed number, not a reminder editor.
 */
export function LoanEditScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { type, scaleFontSize } = useTypography();
  const router = useRouter();
  const { id: routeId } = useLocalSearchParams<{ id?: string }>();
  const id = typeof routeId === 'string' && routeId !== 'new' ? routeId : undefined;
  const { loans, createLoan, updateLoan, deleteLoan, recordMonthlyNetWorthSnapshot } = useFinance();
  const { creditCards } = useReminders();
  const { settings } = useSettings();
  const { table: fx, refreshRates } = useFxRates();
  const existing = id ? loans.find((item) => item.id === id) : undefined;
  const [kind, setKind] = useState<LoanKind>(existing?.kind ?? 'personal');
  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(existing ? amountToExpression(existing.balance) : '');
  const [currency, setCurrency] = useState<MoneyCurrency>(existing?.currency ?? settings.defaultCurrency);
  const [note, setNote] = useState(existing?.note ?? '');
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

  const hydratedId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!existing || hydratedId.current === existing.id) {
      return;
    }
    hydratedId.current = existing.id;
    setKind(existing.kind);
    setName(existing.name);
    setAmount(amountToExpression(existing.balance));
    setCurrency(existing.currency);
    setNote(existing.note ?? '');
  }, [existing]);

  /**
   * Purpose: refresh this month’s history after a loan write.
   * Inputs: none (uses cards + home currency).
   * Outputs: void.
   * Side effects: finance JSON write via FinanceProvider.
   */
  const persistSnapshot = async () => {
    await recordMonthlyNetWorthSnapshot(creditCards, settings.defaultCurrency);
  };

  /**
   * Purpose: create or update the loan, then capture this month’s net worth.
   * Inputs: form kind / name / balance / currency / note.
   * Outputs: none (navigates back).
   * Side effects: finance persist; haptic; router.back.
   */
  const save = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    try {
      const draft = {
        kind,
        name,
        balance: parsed,
        currency,
        reminderId: existing?.reminderId,
        note,
      };
      if (existing) {
        await updateLoan(existing.id, draft);
      } else {
        await createLoan(draft);
      }
      await persistSnapshot();
      await hapticSuccess();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  /**
   * Purpose: confirm then delete the loan and refresh this month’s snapshot.
   * Inputs: none (uses existing id).
   * Outputs: none.
   * Side effects: confirm dialog; deleteLoan; snapshot; router.back.
   */
  const onDelete = () => {
    if (!existing) {
      return;
    }
    const run = () =>
      void deleteLoan(existing.id)
        .then(() => persistSnapshot())
        .then(() => router.back());
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(t('worth.deleteLoanBody'))) {
        run();
      }
      return;
    }
    Alert.alert(t('worth.deleteLoanTitle'), t('worth.deleteLoanBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: run },
    ]);
  };

  return (
    <FormCardGroup
      title={existing ? t('worth.loanTitle') : t('worth.newLoan')}
      headerTrailingIcon="checkmark"
      headerTrailingLabel={saving ? t('worth.savingLoan') : t('worth.keepLoan')}
      onHeaderTrailing={() => void save()}
      headerTrailingDisabled={!canSave}
      stickyButtonLabel={saving ? t('worth.savingLoan') : t('worth.keepLoan')}
      onStickyButtonPress={() => void save()}
      stickyButtonDisabled={!canSave}
      stickyButtonBusy={saving}
    >
      <View style={styles.amountBlock}>
        <AmountCalculatorField
          expression={amount}
          onChange={setAmount}
          currency={currency}
          onCurrencyChange={setCurrency}
          fxTable={fx}
        />
      </View>

      <FormCard>
        <Text style={sectionLabelStyle}>{t('worth.loanKind')}</Text>
        <View style={styles.wrap}>
          {LOAN_KINDS.map((item) => (
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

      <FormCard>
        <Text style={sectionLabelStyle}>{t('worth.loanName')}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('worth.loanNamePlaceholder')}
          placeholderTextColor={colors.faint}
          style={[insetSurface(colors, 14), styles.note, { color: colors.ink, fontSize: noteFontSize }]}
        />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t('worth.loanNote')}
          placeholderTextColor={colors.faint}
          style={[insetSurface(colors, 14), styles.note, { color: colors.ink, fontSize: noteFontSize }]}
          returnKeyType="done"
          blurOnSubmit
        />
      </FormCard>

      {existing ? (
        <SectionActionButton icon="trash-outline" label={t('worth.deleteLoan')} tone="muted" onPress={onDelete} />
      ) : null}
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
    minHeight: 44,
  },
});
