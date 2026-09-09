import { createElement, type CSSProperties } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { toDayKey } from '../../utils/dateUtils';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface } from '../theme/tokens';
import { useI18n } from '../i18n';
import { formatDateFieldValue, type DateFieldProps } from './dateFieldShared';

/**
 * Purpose: tap-the-well calendar date on web via the browser date control — no native datetimepicker import.
 * Inputs: label, Date value, onChange, optional display mode.
 * Outputs: neumorph inset field wrapping `<input type="date" />`.
 * Side effects: none besides onChange.
 * Design decisions: Metro crashes if @react-native-community/datetimepicker is imported on web, so this file stays HTML-only.
 */
export function DateField({ label, value, onChange, display = 'date' }: DateFieldProps) {
  const colors = useThemeColors();
  const { intlLocale } = useI18n();
  const inputStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    border: 'none',
    outline: 'none',
    boxShadow: 'none',
    margin: 0,
    padding: 0,
    cursor: 'pointer',
    fontSize: 16,
    colorScheme: colors.scheme,
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: colors.faint }]} numberOfLines={2}>
        {label}
      </Text>
      <View style={[insetSurface(colors, 16), styles.well]}>
        <Text style={[styles.value, { color: colors.ink, pointerEvents: 'none' }]} numberOfLines={2}>
          {formatDateFieldValue(value, display, intlLocale)}
        </Text>
        {createElement('input', {
          type: 'date',
          value: toDayKey(value),
          'aria-label': label,
          onClick: (event: { currentTarget?: { showPicker?: () => void } }) => {
            try {
              event.currentTarget?.showPicker?.();
            } catch {
              // Ignore browsers without showPicker support
            }
          },
          onChange: (event: { target: { value: string } }) => {
            if (!event.target.value) {
              return;
            }
            const [year, month, day] = event.target.value.split('-').map(Number);
            onChange(new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0));
          },
          style: inputStyle,
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, minWidth: 0 },
  heading: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    flexShrink: 1,
    minWidth: 0,
  },
  well: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    position: 'relative',
  },
  value: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, flexShrink: 1, minWidth: 0 },
});
