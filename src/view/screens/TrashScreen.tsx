import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTrash } from '../../controller/TrashProvider';
import { trashDaysLeft } from '../../model/trash/TrashItem';
import { formatFriendlyMoney } from '../../model/finance/Expense';
import { useI18n } from '../i18n';
import { EmptyState } from '../components/EmptyState';
import { GlassSurface } from '../components/GlassSurface';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, raisedAccent } from '../theme/tokens';

/**
 * Purpose: You → Recently deleted — restore a page or spend for 30 days.
 * Inputs: TrashProvider.
 * Outputs: list with Restore; empty copy when the bin is clear.
 * Side effects: restore writes the row back on this phone.
 */
export function TrashScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { items, restore } = useTrash();
  const { t } = useI18n();
  const now = new Date();

  return (
    <ScreenScaffold>
      <ScreenHeader title={t('trash.title')} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lede, { color: colors.muted }]}>
          {t('trash.lede')}
        </Text>
        {items.length === 0 ? (
          <EmptyState message={t('trash.empty')} />
        ) : (
          items.map((item) => {
            const days = trashDaysLeft(item, now);
            const title =
              item.kind === 'page'
                ? item.page?.title || t('trash.untitled')
                : item.spend
                  ? `${formatFriendlyMoney(item.spend.amount, item.spend.currency)}${item.spend.note ? ` · ${item.spend.note}` : ''}`
                  : t('trash.spend');
            return (
              <GlassSurface key={item.id} style={styles.card} radius={22}>
                <View style={styles.copy}>
                    <Text style={[styles.kind, { color: colors.accent }]}>{item.kind === 'page' ? t('trash.page') : t('trash.spend')}</Text>
                  <Text style={[styles.itemTitle, { color: colors.ink }]} numberOfLines={2}>
                    {title}
                  </Text>
                  <Text style={[styles.meta, { color: colors.faint }]}>
                    {days === 1 ? t('trash.dayLeft') : t('trash.daysLeft', { count: days })}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void restore(item.id)}
                  style={[raisedAccent(colors, 16), styles.restore]}
                  accessibilityLabel={`Restore ${title}`}
                >
                  <Ionicons
                    name="arrow-undo-outline"
                    size={16}
                    color={colors.accentInk}
                    accessible={false}
                    importantForAccessibility="no"
                  />
                  <Text style={[styles.restoreLabel, { color: colors.accentInk }]}>{t('trash.restore')}</Text>
                </Pressable>
              </GlassSurface>
            );
          })
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, gap: 14 },
  lede: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  card: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  kind: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.4 },
  itemTitle: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22 },
  meta: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  restore: {
    minHeight: 44,
    minWidth: 88,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  restoreLabel: { fontFamily: fonts.bodySemi, fontSize: 14 },
});
