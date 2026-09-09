import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AppConfig } from '../../config/appConfig';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface } from '../theme/tokens';

interface MoodNoteFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Purpose: optional one-line mood context under the emoji picker (max 80 chars).
 * Inputs: current note and change handler.
 * Outputs: inset text field. Presentation only.
 * Side effects: none besides onChange.
 */
export function MoodNoteField({ value, onChange }: MoodNoteFieldProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: colors.faint }]}>{t('mood.note')}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={t('mood.notePlaceholder')}
        placeholderTextColor={colors.faint}
        maxLength={AppConfig.writing.maxMoodNoteLength}
        style={[insetSurface(colors, 16), styles.input, { color: colors.ink }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  heading: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
});
