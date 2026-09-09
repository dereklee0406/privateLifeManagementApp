import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveBuiltinBank } from '../../model/finance/creditCardRebates';
import type { CreditCardAccount } from '../../model/reminders/creditCards';
import { hapticLight } from '../../utils/haptics';
import type { TypeIconName } from '../icons/typeIcons';
import { useI18n, type Translate } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, raisedSurface } from '../theme/tokens';
import { type } from '../theme/typography';
import { SheetChrome } from './SheetChrome';
import { TextButton } from './TextButton';

export interface CardPickerForPromoModalProps {
  visible: boolean;
  cards: CreditCardAccount[];
  onClose: () => void;
  onSelect: (cardId: string) => void;
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
 * Purpose: let multi-card users pick which credit card a new bank promotion attaches to.
 * Inputs: visibility, card list, close, onSelect(cardId).
 * Outputs: sheet list with bank badge, icon, and card name.
 * Side effects: light haptic on select; does not persist.
 * Design decisions: View-only picker — parent opens PromoEditorModal after selection.
 */
export function CardPickerForPromoModal({
  visible,
  cards,
  onClose,
  onSelect,
}: CardPickerForPromoModalProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.paper }]}>
        <SheetChrome>
          <View style={styles.header}>
            <TextButton label={t('common.cancel')} tone="muted" onPress={onClose} />
            <Text style={[type.title2, { color: colors.ink }]}>{t('cardRewards.selectCardForPromo')}</Text>
          </View>
          <ScrollView
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            {cards.map((card) => {
              const bank = resolveBuiltinBank(card.bankId);
              const bankLabel = localizeBankName(t, card.bankId ?? bank.id, card.bankName || bank.name);
              const iconName = (bank.icon || 'card-outline') as TypeIconName;
              return (
                <Pressable
                  key={card.id}
                  accessibilityRole="button"
                  accessibilityLabel={card.name}
                  onPress={() => {
                    void hapticLight();
                    onSelect(card.id);
                  }}
                  style={[raisedSurface(colors, 16), styles.row]}
                >
                  <View style={[styles.bankDot, { backgroundColor: bank.brandColor }]}>
                    <Ionicons name={iconName} size={14} color="#FFFFFF" />
                  </View>
                  <View style={styles.textBlock}>
                    <Text style={[styles.cardName, { color: colors.ink }]} numberOfLines={1}>
                      {card.name}
                    </Text>
                    <View style={[styles.bankBadge, { backgroundColor: `${bank.brandColor}22` }]}>
                      <View style={[styles.bankBadgeDot, { backgroundColor: bank.brandColor }]} />
                      <Text style={[styles.bankBadgeText, { color: colors.ink }]} numberOfLines={1}>
                        {bankLabel}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.faint} />
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
 * Purpose: map builtin bank id to localized cardRewards.bank* label.
 * Inputs: translator, bank id, fallback display name.
 * Outputs: localized bank name.
 * Side effects: none.
 */
function localizeBankName(t: Translate, bankId: string, fallback: string): string {
  const key = BANK_I18N[bankId];
  if (!key) {
    return fallback;
  }
  const label = t(key);
  return label === key ? fallback : label;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8, gap: 4 },
  list: { paddingHorizontal: 20, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 64,
  },
  bankDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { flex: 1, minWidth: 0, gap: 6 },
  cardName: { fontFamily: fonts.bodySemi, fontSize: 16 },
  bankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: '100%',
  },
  bankBadgeDot: { width: 8, height: 8, borderRadius: 4 },
  bankBadgeText: { fontFamily: fonts.bodyMedium, fontSize: 12, flexShrink: 1 },
});
