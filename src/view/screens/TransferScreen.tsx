import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../controller/FinanceProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import { useFxRates } from '../../controller/FxRateProvider';
import {
  amountToExpression,
  evaluateAmountExpression,
  isCompleteAmountExpression,
} from '../../model/finance/amountCalculator';
import { isTransferDraftValid, type TransferDraft } from '../../model/finance/Transfer';
import type { MoneyCurrency } from '../../model/settings/AppSettings';
import { dateFromDayKey, dayKeyFromDate } from '../../controller/dateFieldValue';
import { toDayKey } from '../../utils/dateUtils';
import { hapticSuccess } from '../../utils/haptics';
import { AmountCalculatorField } from '../components/AmountCalculatorField';
import { Chip } from '../components/Chip';
import { DateField } from '../components/DateField';
import { FormCard, FormCardGroup } from '../components/FormCardGroup';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { useTypography } from '../theme/TypographyProvider';
import { fonts, insetSurface } from '../theme/tokens';
import { formatMoney } from '../../model/finance/Expense';

const AMOUNT_BUMPS = [100, 500, 1000, 5000] as const;

/**
 * Purpose: transfer funds between accounts or make a credit card repayment.
 * Inputs: assets from FinanceProvider, credit cards from ReminderProvider.
 * Outputs: TransferEntry saved and account balances atomically updated.
 * Side effects: updates FinanceDocument; triggers success haptic.
 * Design decisions: 3-card structure (Route / Amount / Details) with sticky CTA
 *   matching Expense and Income flows.
 */
export function TransferScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const colors = useThemeColors();
  const { type, scaleFontSize } = useTypography();
  const { assets, transferFunds } = useFinance();
  const { creditCards } = useReminders();
  const { settings } = useSettings();
  const { table: fx } = useFxRates();

  const [fromAssetId, setFromAssetId] = useState<string>(() => assets[0]?.id ?? '');
  const [destinationType, setDestinationType] = useState<'asset' | 'card'>('asset');
  const [toAssetId, setToAssetId] = useState<string>(() => {
    const candidate = assets.find((a) => a.id !== (assets[0]?.id ?? ''));
    return candidate?.id ?? '';
  });
  const [toCardId, setToCardId] = useState<string>(() => creditCards[0]?.id ?? '');

  const [amount, setAmount] = useState('0');
  const [currency, setCurrency] = useState<MoneyCurrency>(settings.defaultCurrency);
  const [dayKey, setDayKey] = useState(() => toDayKey(new Date()));
  const [fee, setFee] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [keypadCollapsed, setKeypadCollapsed] = useState(true);

  const selectedFromAsset = useMemo(() => assets.find((a) => a.id === fromAssetId), [assets, fromAssetId]);

  const parsedAmount = useMemo(() => {
    if (!isCompleteAmountExpression(amount)) {
      return 0;
    }
    return Math.max(0, evaluateAmountExpression(amount));
  }, [amount]);

  const parsedFee = useMemo(() => {
    const num = parseFloat(fee);
    return Number.isFinite(num) && num > 0 ? num : 0;
  }, [fee]);

  const transferDraft: TransferDraft = useMemo(
    () => ({
      fromAssetId,
      toAssetId: destinationType === 'asset' ? toAssetId : undefined,
      toCardId: destinationType === 'card' ? toCardId : undefined,
      amount: parsedAmount,
      currency,
      fee: parsedFee > 0 ? parsedFee : undefined,
      dayKey,
      note: note.trim() || undefined,
    }),
    [fromAssetId, destinationType, toAssetId, toCardId, parsedAmount, currency, parsedFee, dayKey, note],
  );

  const assetIds = useMemo(() => assets.map((a) => a.id), [assets]);
  const canSave = useMemo(() => !saving && isTransferDraftValid(transferDraft, assetIds), [
    saving,
    transferDraft,
    assetIds,
  ]);

  const handleSave = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    try {
      await transferFunds(transferDraft);
      await hapticSuccess();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const sectionLabelStyle = [
    styles.sectionLabel,
    type.caption,
    { color: colors.muted, fontSize: scaleFontSize(12) },
  ];
  const noteFontSize = scaleFontSize(16);

  // Available destination assets (cannot transfer to self)
  const destinationAssets = useMemo(() => assets.filter((a) => a.id !== fromAssetId), [assets, fromAssetId]);

  return (
    <FormCardGroup
      title={t('money.transferTitle')}
      headerTrailingIcon="checkmark"
      headerTrailingLabel={saving ? t('common.saving') : t('money.confirmTransfer')}
      onHeaderTrailing={() => void handleSave()}
      headerTrailingDisabled={!canSave}
      stickyButtonLabel={saving ? t('common.saving') : t('money.confirmTransfer')}
      onStickyButtonPress={() => void handleSave()}
      stickyButtonDisabled={!canSave}
      stickyButtonBusy={saving}
    >
      {/* Card 1: Route Selection (From ➔ To) */}
      <FormCard>
        <View style={styles.section}>
          <Text style={sectionLabelStyle}>{t('money.transferFrom')}</Text>
          {assets.length === 0 ? (
            <Text style={[type.footnote, { color: colors.faint }]}>{t('money.noAccountsHint')}</Text>
          ) : (
            <View style={styles.wrap}>
              {assets.map((asset) => (
                <Chip
                  key={asset.id}
                  leadingIcon={asset.kind === 'cash' ? 'cash-outline' : 'wallet-outline'}
                  label={`${asset.name} (${formatMoney(asset.value, asset.currency)})`}
                  selected={fromAssetId === asset.id}
                  onPress={() => {
                    setFromAssetId(asset.id);
                    if (destinationType === 'asset' && toAssetId === asset.id) {
                      const next = assets.find((a) => a.id !== asset.id);
                      if (next) {
                        setToAssetId(next.id);
                      }
                    }
                  }}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.routeDivider}>
          <View style={[styles.routeLine, { backgroundColor: colors.line }]} />
          <View style={[styles.arrowCircle, { backgroundColor: colors.paper, borderColor: colors.line }]}>
            <Ionicons name="arrow-down" size={16} color={colors.accent} />
          </View>
          <View style={[styles.routeLine, { backgroundColor: colors.line }]} />
        </View>

        <View style={styles.section}>
          <View style={styles.destinationToggleRow}>
            <Text style={sectionLabelStyle}>{t('money.transferTo')}</Text>
            {creditCards.length > 0 && (
              <View style={styles.destKindRow}>
                <Chip
                  label={t('money.accountOption')}
                  selected={destinationType === 'asset'}
                  onPress={() => setDestinationType('asset')}
                />
                <Chip
                  leadingIcon="card-outline"
                  label={t('money.creditCardRepay')}
                  selected={destinationType === 'card'}
                  onPress={() => setDestinationType('card')}
                />
              </View>
            )}
          </View>

          {destinationType === 'asset' ? (
            destinationAssets.length === 0 ? (
              <Text style={[type.footnote, { color: colors.faint }]}>{t('money.noDestAccountHint')}</Text>
            ) : (
              <View style={styles.wrap}>
                {destinationAssets.map((asset) => (
                  <Chip
                    key={asset.id}
                    leadingIcon={asset.kind === 'cash' ? 'cash-outline' : 'wallet-outline'}
                    label={`${asset.name} (${formatMoney(asset.value, asset.currency)})`}
                    selected={toAssetId === asset.id}
                    onPress={() => setToAssetId(asset.id)}
                  />
                ))}
              </View>
            )
          ) : (
            <View style={styles.wrap}>
              {creditCards.map((card) => (
                <Chip
                  key={card.id}
                  leadingIcon="card-outline"
                  label={card.name}
                  selected={toCardId === card.id}
                  onPress={() => setToCardId(card.id)}
                />
              ))}
            </View>
          )}
        </View>
      </FormCard>

      {/* Card 2: Amount Hero */}
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
                const current = parsedAmount > 0 ? parsedAmount : 0;
                setAmount(amountToExpression(current + bump));
              }}
            />
          ))}
        </View>

        {selectedFromAsset && parsedAmount > 0 ? (
          <View style={[insetSurface(colors, 16), styles.balancePreview]}>
            <Text style={[sectionLabelStyle, { marginBottom: 2 }]}>{t('money.sourceRemaining')}</Text>
            <Text
              style={[
                styles.previewValue,
                {
                  color: selectedFromAsset.value - (parsedAmount + parsedFee) < 0 ? colors.danger : colors.ink,
                  fontSize: scaleFontSize(16),
                  lineHeight: Math.round(scaleFontSize(16) * 1.35),
                },
              ]}
            >
              {formatMoney(
                Math.max(0, selectedFromAsset.value - (parsedAmount + parsedFee)),
                selectedFromAsset.currency,
              )}
            </Text>
          </View>
        ) : null}
      </FormCard>

      {/* Card 3: Details (Date, Fee, Note) */}
      <FormCard>
        <DateField
          label={t('money.transferDate')}
          value={dateFromDayKey(dayKey)}
          onChange={(next) => setDayKey(dayKeyFromDate(next))}
        />

        <View style={styles.feeRow}>
          <TextInput
            value={fee}
            onChangeText={setFee}
            placeholder={t('money.transferFeeOptional')}
            placeholderTextColor={colors.faint}
            keyboardType="decimal-pad"
            style={[
              insetSurface(colors, 14),
              styles.input,
              {
                color: colors.ink,
                fontSize: noteFontSize,
                lineHeight: Math.round(noteFontSize * 1.35),
                minHeight: Math.max(48, Math.round(44 * Math.min(1.2, noteFontSize / 16))),
              },
            ]}
          />
        </View>

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t('spend.note')}
          placeholderTextColor={colors.faint}
          style={[
            insetSurface(colors, 14),
            styles.input,
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
  section: { gap: 8 },
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
  routeDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  routeLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  destinationToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  destKindRow: {
    flexDirection: 'row',
    gap: 6,
  },
  bumpRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  bumpPill: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  balancePreview: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  previewValue: {
    fontFamily: fonts.bodySemi,
    fontVariant: ['tabular-nums'],
  },
  feeRow: {
    width: '100%',
  },
  input: {
    fontFamily: fonts.body,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
    fontVariant: ['tabular-nums'],
  },
});
