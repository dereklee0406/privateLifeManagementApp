import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { dateFromDayKey, dayKeyFromDate } from '../../controller/dateFieldValue';
import type { CardBankPromotion } from '../../model/reminders/creditCards';
import type { MoneyCurrency } from '../../model/settings/AppSettings';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface } from '../theme/tokens';
import { type } from '../theme/typography';
import { CardPresetModal, categoryLabel } from './CardPresetModal';
import { Chip } from './Chip';
import { DateField } from './DateField';
import { PrimaryButton } from './PrimaryButton';
import { SheetChrome } from './SheetChrome';
import { TextButton } from './TextButton';

export interface PromoEditorModalProps {
  draft: CardBankPromotion | null;
  currency: MoneyCurrency;
  cardName?: string;
  onClose: () => void;
  onSave: (promo: CardBankPromotion) => void;
}

const PROMO_CATEGORIES = [
  'all',
  'dining',
  'online',
  'supermarket',
  'travel',
  'shopping',
  'overseas',
  'transport',
  'entertainment',
  'bills',
  'other',
] as const;

/**
 * Purpose: reusable sheet modal for creating/editing a CardBankPromotion.
 * Inputs: draft promo or null; display currency; optional card name; close/save callbacks.
 * Outputs: title, category, extra rate %, date range, registration, stackable flag, lower limits & upper limits.
 * Side effects: none besides onClose / onSave.
 * Design decisions: structured sections clearly distinguish lower limits (min spend per tx / total spend)
 *   from upper limits (rebate cap / spend cap); uses currency badges for glanceability.
 */
export function PromoEditorModal({ draft, currency, cardName, onClose, onSave }: PromoEditorModalProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [rateDraft, setRateDraft] = useState('3');
  const [startDate, setStartDate] = useState(dayKeyFromDate(new Date()));
  const [endDate, setEndDate] = useState(dayKeyFromDate(new Date()));
  const [requiresRegistration, setRequiresRegistration] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isStackable, setIsStackable] = useState(draft?.isStackable ?? false);
  const [minSpendPerTx, setMinSpendPerTx] = useState('');
  const [minTotalSpend, setMinTotalSpend] = useState('');
  const [maxCap, setMaxCap] = useState('');
  const [maxSpendCap, setMaxSpendCap] = useState('');

  useEffect(() => {
    if (!draft) {
      return;
    }
    setTitle(draft.title);
    setCategory(draft.category || 'all');
    setRateDraft(formatPercentInput(draft.extraRebateRate));
    setStartDate(draft.startDate);
    setEndDate(draft.endDate);
    setRequiresRegistration(draft.requiresRegistration);
    setIsRegistered(draft.isRegistered);
    setIsStackable(draft.isStackable ?? false);
    setMinSpendPerTx(draft.minSpendPerTx !== undefined ? String(draft.minSpendPerTx) : '');
    setMinTotalSpend(draft.minTotalSpend !== undefined ? String(draft.minTotalSpend) : '');
    setMaxCap(draft.maxRebateCap !== undefined ? String(draft.maxRebateCap) : '');
    setMaxSpendCap(draft.maxSpendCap !== undefined ? String(draft.maxSpendCap) : '');
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
            <Text style={[type.title2, { color: colors.ink }]}>{t('cardRewards.editPromotion')}</Text>
            {cardName ? (
              <Text style={[styles.cardHint, { color: colors.muted }]} numberOfLines={1}>
                {cardName}
              </Text>
            ) : null}
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: colors.faint }]}>{t('cardRewards.promoTitle')}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('cardRewards.promoTitlePlaceholder')}
              placeholderTextColor={colors.faint}
              style={[insetSurface(colors, 16), styles.amount, { color: colors.ink }]}
            />

            <Text style={[styles.label, { color: colors.faint }]}>{t('cardRewards.category')}</Text>
            <View style={styles.chipWrap}>
              {PROMO_CATEGORIES.map((catId) => (
                <Chip
                  key={catId}
                  label={categoryLabel(t, catId)}
                  selected={category === catId}
                  onPress={() => setCategory(catId)}
                />
              ))}
            </View>

            <Text style={[styles.label, { color: colors.faint }]}>{t('cardRewards.extraRebateRate')}</Text>
            <View style={[insetSurface(colors, 16), styles.affixWell]}>
              <TextInput
                value={rateDraft}
                onChangeText={setRateDraft}
                keyboardType="decimal-pad"
                style={[styles.affixInput, { color: colors.ink }]}
                accessibilityLabel={t('cardRewards.extraRebateRate')}
              />
              <View style={[styles.affixBadge, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.affixBadgeText, { color: colors.accent }]}>%</Text>
              </View>
            </View>

            <DateField
              label={t('cardRewards.startDate')}
              value={dateFromDayKey(startDate)}
              onChange={(next) => setStartDate(dayKeyFromDate(next))}
            />
            <DateField
              label={t('cardRewards.endDate')}
              value={dateFromDayKey(endDate)}
              onChange={(next) => setEndDate(dayKeyFromDate(next))}
            />

            <View style={styles.enabled}>
              <Text style={[styles.meta, { color: colors.muted }]}>{t('cardRewards.requiresRegistration')}</Text>
              <Switch
                value={requiresRegistration}
                onValueChange={setRequiresRegistration}
                trackColor={{ false: colors.line, true: colors.accent }}
                thumbColor={colors.scheme === 'dark' ? '#E4DDD4' : '#FFF8F2'}
              />
            </View>
            <View style={styles.enabled}>
              <Text style={[styles.meta, { color: colors.muted }]}>{t('cardRewards.isRegistered')}</Text>
              <Switch
                value={isRegistered}
                onValueChange={setIsRegistered}
                trackColor={{ false: colors.line, true: colors.accent }}
                thumbColor={colors.scheme === 'dark' ? '#E4DDD4' : '#FFF8F2'}
              />
            </View>
            <View style={styles.enabled}>
              <Text style={[styles.meta, { color: colors.muted }]}>{t('cardRewards.isStackable')}</Text>
              <Switch
                value={isStackable}
                onValueChange={setIsStackable}
                trackColor={{ false: colors.line, true: colors.accent }}
                thumbColor={colors.scheme === 'dark' ? '#E4DDD4' : '#FFF8F2'}
              />
            </View>

            {/* Lower Limits Section */}
            <Text style={[styles.sectionHeading, { color: colors.ink }]}>{t('cardRewards.lowerLimitsSection')}</Text>
            <OptionalCapField
              label={t('cardRewards.promoMinSpendPerTx')}
              value={minSpendPerTx}
              onChangeText={setMinSpendPerTx}
              currency={currency}
              placeholder={t('cardRewards.minSpendPlaceholder')}
            />
            <OptionalCapField
              label={t('cardRewards.promoMinTotalSpend')}
              value={minTotalSpend}
              onChangeText={setMinTotalSpend}
              currency={currency}
              placeholder={t('cardRewards.minSpendPlaceholder')}
            />

            {/* Upper Limits Section */}
            <Text style={[styles.sectionHeading, { color: colors.ink }]}>{t('cardRewards.upperLimitsSection')}</Text>
            <OptionalCapField
              label={t('cardRewards.promoMaxRebateCap')}
              value={maxCap}
              onChangeText={setMaxCap}
              currency={currency}
              placeholder={t('cardRewards.capPlaceholder')}
            />
            <OptionalCapField
              label={t('cardRewards.promoMaxSpendCap')}
              value={maxSpendCap}
              onChangeText={setMaxSpendCap}
              currency={currency}
              placeholder={t('cardRewards.capPlaceholder')}
            />

            <PrimaryButton
              icon="checkmark-circle-outline"
              label={t('cardRewards.savePromotion')}
              onPress={() => {
                const rate = Number(rateDraft);
                onSave({
                  ...draft,
                  title: title.trim() || t('cardRewards.editPromotion'),
                  category: category === 'all' ? undefined : category,
                  extraRebateRate: Number.isFinite(rate) && rate >= 0 ? rate / 100 : draft.extraRebateRate,
                  startDate,
                  endDate,
                  requiresRegistration,
                  isRegistered,
                  isStackable,
                  minSpendPerTx: parseOptionalNumber(minSpendPerTx),
                  minTotalSpend: parseOptionalNumber(minTotalSpend),
                  maxSpendCap: parseOptionalNumber(maxSpendCap),
                  maxRebateCap: parseOptionalNumber(maxCap),
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
 * Purpose: optional promo limit field with currency badge.
 * Inputs: label, string value, change handler, currency, placeholder.
 * Outputs: labeled inset row `[ HK$ ] [ value ]`.
 * Side effects: onChangeText only.
 */
function OptionalCapField({
  label,
  value,
  onChangeText,
  currency,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  currency: MoneyCurrency;
  placeholder: string;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.fieldGroup}>
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
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Purpose: currency symbol for input badges (matches formatFriendlyMoney).
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
 * Purpose: show rebate fraction as a clean percent string for inputs.
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

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  modalHeader: { paddingHorizontal: 20, paddingBottom: 8, gap: 4 },
  cardHint: { fontFamily: fonts.body, fontSize: 13 },
  modalBody: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  fieldGroup: { gap: 6 },
  label: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionHeading: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    letterSpacing: 0.3,
    marginTop: 12,
    marginBottom: 2,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  enabled: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  meta: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, flex: 1, minWidth: 0 },
});
