import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { JournalLocation } from '../../model/journal/JournalEntry';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface } from '../theme/tokens';

interface LocationFieldProps {
  value?: JournalLocation;
  onChange: (next: JournalLocation | undefined) => void;
}

/**
 * Purpose: optional typed place name on web without expo-location.
 * Inputs: current location and change handler.
 * Outputs: text field; coordinates are never set on web.
 * Side effects: none.
 * Design decisions: no expo-location import so Metro web cannot crash.
 */
export function LocationField({ value, onChange }: LocationFieldProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: colors.faint }]}>{t('location.place')}</Text>
      <TextInput
        value={value?.name ?? ''}
        onChangeText={(name) => onChange(name.trim() ? { name: name.trim() } : undefined)}
        placeholder={t('location.placeholderWeb')}
        placeholderTextColor={colors.faint}
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
  },
});
