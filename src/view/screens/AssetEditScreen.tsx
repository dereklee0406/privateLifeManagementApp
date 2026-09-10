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
import { ASSET_KINDS, type AssetKind } from '../../model/finance/Asset';
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
 * Purpose: create or edit a manual asset (cash / bank / investment / property).
 * Inputs: optional route id; finance mutators; settings currency; FX table for the keypad.
 * Outputs: AssetDraft saved via FinanceProvider.
 * Side effects: create/update/delete asset; records this month’s net-worth snapshot; success haptic.
 * Design decisions: investment is a kind with a typed number — no brokerage login. Snapshot capture
 *   stays in the controller after save so Worth history updates without View math.
 */
export function AssetEditScreen() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { type, scaleFontSize } = useTypography();
  const router = useRouter();
  const { id: routeId } = useLocalSearchParams<{ id?: string }>();
  const id = typeof routeId === 'string' && routeId !== 'new' ? routeId : undefined;
  const { assets, createAsset, updateAsset, deleteAsset, recordMonthlyNetWorthSnapshot } = useFinance();
  const { creditCards } = useReminders();
  const { settings } = useSettings();
  const { table: fx, refreshRates } = useFxRates();
  const existing = id ? assets.find((item) => item.id === id) : undefined;
  const [kind, setKind] = useState<AssetKind>(existing?.kind ?? 'cash');
  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(existing ? amountToExpression(existing.value) : '');
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
    setAmount(amountToExpression(existing.value));
    setCurrency(existing.currency);
    setNote(existing.note ?? '');
  }, [existing]);

  /**
   * Purpose: refresh this month’s history after an asset write.
   * Inputs: none (uses cards + home currency).
   * Outputs: void.
   * Side effects: finance JSON write via FinanceProvider.
   */
  const persistSnapshot = async () => {
    await recordMonthlyNetWorthSnapshot(creditCards, settings.defaultCurrency);
  };

  /**
   * Purpose: create or update the asset, then capture this month’s net worth.
   * Inputs: form kind / name / value / currency / note.
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
        value: parsed,
        currency,
        note,
      };
      if (existing) {
        await updateAsset(existing.id, draft);
      } else {
        await createAsset(draft);
      }
      await persistSnapshot();
      await hapticSuccess();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  /**
   * Purpose: confirm then delete the asset and refresh this month’s snapshot.
   * Inputs: none (uses existing id).
   * Outputs: none.
   * Side effects: confirm dialog; deleteAsset; snapshot; router.back.
   */
  const onDelete = () => {
    if (!existing) {
      return;
    }
    const run = () =>
      void deleteAsset(existing.id)
        .then(() => persistSnapshot())
        .then(() => router.back());
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(t('worth.deleteAssetBody'))) {
        run();
      }
      return;
    }
    Alert.alert(t('worth.deleteAssetTitle'), t('worth.deleteAssetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: run },
    ]);
  };

  return (
    <FormCardGroup
      title={existing ? t('worth.assetTitle') : t('worth.newAsset')}
      headerTrailingIcon="checkmark"
      headerTrailingLabel={saving ? t('worth.savingAsset') : t('worth.keepAsset')}
      onHeaderTrailing={() => void save()}
      headerTrailingDisabled={!canSave}
      stickyButtonLabel={saving ? t('worth.savingAsset') : t('worth.keepAsset')}
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
        <Text style={sectionLabelStyle}>{t('worth.assetKind')}</Text>
        <View style={styles.wrap}>
          {ASSET_KINDS.map((item) => (
            <Chip
              key={item.id}
              icon={iconForType(item.id)}
              label={typeA11yLabel(t, item.id, item.label)}
              selected={kind === item.id}
              onPress={() => setKind(item.id)}
            />
          ))}
        </View>
        {kind === 'investment' ? (
          <Text style={[styles.hint, { color: colors.muted }]}>{t('worth.investmentHint')}</Text>
        ) : null}
      </FormCard>

      <FormCard>
        <Text style={sectionLabelStyle}>{t('worth.assetName')}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('worth.assetNamePlaceholder')}
          placeholderTextColor={colors.faint}
          style={[insetSurface(colors, 14), styles.note, { color: colors.ink, fontSize: noteFontSize }]}
        />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t('worth.assetNote')}
          placeholderTextColor={colors.faint}
          style={[insetSurface(colors, 14), styles.note, { color: colors.ink, fontSize: noteFontSize }]}
          returnKeyType="done"
          blurOnSubmit
        />
      </FormCard>

      {existing ? (
        <SectionActionButton
          icon="trash-outline"
          label={t('worth.deleteAsset')}
          tone="muted"
          onPress={onDelete}
        />
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
  hint: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  note: {
    fontFamily: fonts.body,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
  },
});
