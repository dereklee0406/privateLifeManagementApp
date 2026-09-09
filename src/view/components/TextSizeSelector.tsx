import { StyleSheet, Text, View } from 'react-native';
import { useSettings } from '../../controller/SettingsProvider';
import type { FontSizePreference } from '../../model/settings/AppSettings';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { useTypography } from '../theme/TypographyProvider';
import { insetSurface } from '../theme/tokens';
import { Chip } from './Chip';

const SIZE_OPTIONS: Array<{ id: FontSizePreference; key: string }> = [
  { id: 'system', key: 'you.sizeSystem' },
  { id: 'small', key: 'you.sizeSmall' },
  { id: 'default', key: 'you.sizeDefault' },
  { id: 'large', key: 'you.sizeLarge' },
  { id: 'extraLarge', key: 'you.sizeExtraLarge' },
];

/**
 * Purpose: Settings Appearance control for user font-size preference with live preview.
 * Inputs: settings.fontSizePreference via useSettings; scaled type/fontScale via useTypography.
 * Outputs: chip row (System / Small / Default / Large / Extra Large) + neumorphic preview card.
 * Side effects: persists preference through setFontSizePreference.
 * Design decisions: View-only orchestration — scale math stays in Model (resolveFontScale) and
 *   TypographyProvider; preview uses the same `type` tokens as the rest of the app so the card
 *   mirrors real screens. Chips wrap like Look / Language for narrow widths.
 */
export function TextSizeSelector() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const { settings, setFontSizePreference } = useSettings();
  const { type, fontScale } = useTypography();
  const selected: FontSizePreference = settings.fontSizePreference || 'system';

  return (
    <View style={styles.fieldRow}>
      <Text style={[type.footnote, styles.fieldLabel, { color: colors.muted }]}>
        {t('you.textSize')}
      </Text>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={t('you.textSize')}>
        {SIZE_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          return (
            <Chip
              key={option.id}
              label={t(option.key)}
              selected={isSelected}
              onPress={() => void setFontSizePreference(option.id)}
            />
          );
        })}
      </View>
      <Text style={[type.footnote, { color: colors.faint }]}>{t('you.textSizeHint')}</Text>

      <View
        style={[styles.preview, insetSurface(colors, 16)]}
        accessibilityRole="summary"
        accessibilityLabel={t('you.previewSampleTitle')}
      >
        <Text style={[type.headline, { color: colors.ink, fontWeight: '600' }]}>
          {t('you.previewSampleTitle')}
        </Text>
        <Text
          style={[
            type.subhead,
            { color: colors.ink, marginTop: 4, lineHeight: Math.round(20 * fontScale) },
          ]}
        >
          {t('you.previewSampleBody')}
        </Text>
        <Text style={[type.footnote, { color: colors.faint, marginTop: 8 }]}>
          {t('you.previewSampleDate')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    minHeight: 44,
  },
  fieldLabel: {
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  preview: {
    padding: 16,
    marginTop: 12,
  },
});
