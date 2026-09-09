import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BUILTIN_BANKS,
  POPULAR_CARD_PRESETS,
  type PopularCardPreset,
} from '../../model/finance/creditCardRebates';
import { hapticLight } from '../../utils/haptics';
import { useI18n } from '../i18n';
import type { TypeIconName } from '../icons/typeIcons';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, raisedSurface } from '../theme/tokens';
import { type } from '../theme/typography';
import { SheetChrome } from './SheetChrome';
import { TextButton } from './TextButton';

interface CardPresetModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (preset: PopularCardPreset) => void;
}

const BANK_I18N: Record<string, string> = {
  hsbc: 'cardRewards.bankHsbc',
  scb: 'cardRewards.bankScb',
  hangseng: 'cardRewards.bankHangseng',
  boc: 'cardRewards.bankBoc',
  citi: 'cardRewards.bankCiti',
  dbs: 'cardRewards.bankDbs',
  mox: 'cardRewards.bankMox',
  bea: 'cardRewards.bankBea',
  ccb: 'cardRewards.bankCcb',
  amex: 'cardRewards.bankAmex',
  chase: 'cardRewards.bankChase',
  other: 'cardRewards.bankOther',
};

/**
 * Purpose: 1-tap popular-card picker that seeds bank, rates, rules, and caps.
 * Inputs: visibility, close, onSelect(preset).
 * Outputs: modal list of POPULAR_CARD_PRESETS with bank brand + base rate summary.
 * Side effects: light haptic on select; does not persist.
 * Design decisions: View-only; clones happen in the editor when applying the preset bag.
 */
export function CardPresetModal({ visible, onClose, onSelect }: CardPresetModalProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.paper }]}>
        <SheetChrome>
          <View style={[styles.header, { paddingTop: 8 }]}>
            <TextButton label={t('common.cancel')} tone="muted" onPress={onClose} />
            <Text style={[type.title2, { color: colors.ink }]}>{t('cardRewards.popularPresets')}</Text>
          </View>
          <ScrollView
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            {POPULAR_CARD_PRESETS.map((preset) => {
              const bank = BUILTIN_BANKS.find((item) => item.id === preset.bankId);
              const bankLabel = t(BANK_I18N[preset.bankId] ?? 'cardRewards.bankOther');
              const basePct = formatPercent(preset.baseRebateRate);
              const topRules = preset.rebateRules
                .slice(0, 3)
                .map((rule) => `${rule.category} ${formatPercent(rule.rebateRate)}`)
                .join(' · ');
              return (
                <Pressable
                  key={preset.id}
                  accessibilityRole="button"
                  accessibilityLabel={preset.name}
                  onPress={() => {
                    void hapticLight();
                    onSelect(preset);
                    onClose();
                  }}
                  style={[raisedSurface(colors, 18), styles.row]}
                >
                  <View
                    style={[styles.dot, { backgroundColor: bank?.brandColor ?? colors.muted }]}
                    accessible={false}
                  />
                  <View style={styles.meta}>
                    <Text style={[styles.name, { color: colors.ink }]}>{preset.name}</Text>
                    <Text style={[styles.sub, { color: colors.muted }]}>
                      {bankLabel}
                      {preset.cardTier ? ` · ${preset.cardTier}` : ''}
                      {` · ${basePct} ${t('cardRewards.baseRebate')}`}
                    </Text>
                    {topRules ? (
                      <Text style={[styles.rules, { color: colors.faint }]} numberOfLines={2}>
                        {topRules}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={(bank?.icon as TypeIconName) || 'card-outline'}
                    size={20}
                    color={colors.faint}
                    accessible={false}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        </SheetChrome>
      </View>
    </Modal>
  );
}

/**
 * Purpose: localize builtin bank id for chips and preset rows.
 * Inputs: translator, bankId, optional fallback name.
 * Outputs: display string.
 * Side effects: none.
 */
export function bankDisplayName(
  t: (key: string) => string,
  bankId: string,
  fallback?: string,
): string {
  const key = BANK_I18N[bankId] ?? 'cardRewards.bankOther';
  const translated = t(key);
  if (translated && translated !== key) {
    return translated;
  }
  return fallback?.trim() || bankId;
}

/**
 * Purpose: label a rebate category id for chips and rule rows.
 * Inputs: translator, category id.
 * Outputs: localized or English fallback.
 * Side effects: none.
 */
export function categoryLabel(t: (key: string) => string, category: string): string {
  if (category === 'online') {
    return t('cardRewards.categoryOnline');
  }
  if (category === 'overseas') {
    return t('cardRewards.categoryOverseas');
  }
  if (category === 'all') {
    return t('cardRewards.categoryAll');
  }
  const key = `types.${category}`;
  const translated = t(key);
  if (translated && translated !== key) {
    return translated;
  }
  return category;
}

/**
 * Purpose: display a rebate fraction as a compact percent label.
 * Inputs: rate fraction (0.04 → 4%).
 * Outputs: trimmed percent string with %.
 * Side effects: none.
 */
function formatPercent(rate: number): string {
  const pct = rate * 100;
  const rounded = Math.round(pct * 100) / 100;
  return `${rounded}%`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, gap: 8, paddingBottom: 8 },
  list: { paddingHorizontal: 20, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 72,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  meta: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: fonts.bodySemi, fontSize: 16 },
  sub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  rules: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, marginTop: 2 },
});
