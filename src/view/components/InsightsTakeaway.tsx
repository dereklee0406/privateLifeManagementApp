import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { appHref } from '../../utils/navigation';
import { hapticLight } from '../../utils/haptics';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

/**
 * Purpose: Insights editorial takeaway — one pressure line, typeset as the story, not a caption.
 * Inputs: localized line + hub href from pressure kind.
 * Outputs: large tappable paragraph (44pt hit).
 * Side effects: haptic + navigation.
 * Design decisions: no equal-weight GlassSurface. Hierarchy is type size + accent kicker.
 *   Share card still uses insights.pressureLabel; this screen uses takeawayLabel.
 */
export function InsightsTakeaway({ line, href }: { line: string; href: string }) {
  const colors = useThemeColors();
  const router = useRouter();
  const { t } = useI18n();

  return (
    <Pressable
      onPress={() => {
        void hapticLight();
        router.push(appHref(href));
      }}
      accessibilityRole="button"
      accessibilityLabel={`${t('insights.takeawayLabel')}. ${line}`}
      style={({ pressed }) => [styles.hit, { opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={styles.copy}>
        <Text style={[styles.kicker, { color: colors.accent }]}>{t('insights.takeawayLabel')}</Text>
        <Text style={[styles.line, { color: colors.ink }]}>{line}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.faint} accessible={false} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  kicker: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  line: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '600',
  },
});
