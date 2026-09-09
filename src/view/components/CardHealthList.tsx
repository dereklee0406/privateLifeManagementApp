import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CardHealthRow, CardHealthStatus } from '../../model/finance/cardHealth';
import type { Translate } from '../i18n';
import { useI18n } from '../i18n';
import { GlassSurface } from './GlassSurface';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

/**
 * Purpose: map model English statusLabel tokens to localized traffic-light copy.
 * Inputs: statusLabel from cardHealthStatus; translator.
 * Outputs: localized label, or the original string if unrecognized.
 * Side effects: none.
 */
function localizeCardStatusLabel(statusLabel: string, t: Translate): string {
  if (statusLabel === 'overdue') {
    return t('money.statusOverdue');
  }
  if (statusLabel === 'due today') {
    return t('money.statusDueToday');
  }
  if (statusLabel === 'due soon') {
    return t('money.statusDueSoon');
  }
  if (statusLabel === 'ok') {
    return t('money.statusOk');
  }
  return statusLabel;
}

/**
 * Purpose: present Card Health rows — days-to-due, amount, statement vs due, traffic light.
 * Inputs: computed rows and a tap handler.
 * Outputs: neumorph cards; quiet empty copy when there are no cards (header owns Add a card).
 * Side effects: none besides onOpenCard.
 */
export function CardHealthList({
  rows,
  onOpenCard,
}: {
  rows: CardHealthRow[];
  onOpenCard: (id: string) => void;
}) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const tone = (status: CardHealthStatus): string => {
    if (status === 'overdue') {
      return colors.danger;
    }
    if (status === 'soon') {
      return colors.accent;
    }
    return colors.climate.neutral;
  };

  if (rows.length === 0) {
    return <Text style={[styles.empty, { color: colors.faint }]}>{t('money.noCardsYet')}</Text>;
  }

  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <Pressable key={row.id} onPress={() => onOpenCard(row.id)}>
          <GlassSurface style={styles.card} radius={18}>
            <View style={styles.head}>
              <Text style={[styles.name, { color: colors.ink }]}>{row.name}</Text>
              <Text style={[styles.status, { color: tone(row.status) }]}>
                {localizeCardStatusLabel(row.statusLabel, t)}
              </Text>
            </View>
            <Text style={[styles.line, { color: colors.muted }]}>{row.dueLine}</Text>
            <Text style={[styles.line, { color: colors.faint }]}>{row.cycleLine}</Text>
          </GlassSurface>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  card: { padding: 16, gap: 6, minHeight: 56 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22, flex: 1, minWidth: 0 },
  status: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18, flexShrink: 1, textAlign: 'right', maxWidth: '42%' },
  line: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
});
