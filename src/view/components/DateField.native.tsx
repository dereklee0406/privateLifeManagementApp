import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface } from '../theme/tokens';
import { useI18n } from '../i18n';
import { formatDateFieldValue, type DateFieldProps } from './dateFieldShared';

/**
 * Purpose: tap-the-well calendar date on Android/iOS. Native datetimepicker lives only here.
 * Inputs: label, Date value, onChange, optional display mode.
 * Outputs: neumorph inset field; system calendar; Date back to the form.
 * Side effects: opens the OS date UI; does not persist.
 * Design decisions: Metro web must never import this module. Android uses a calendar dialog;
 *   iOS shows an inline calendar plus Done. Time-of-day is not this field.
 */
export function DateField({ label, value, onChange, display = 'date' }: DateFieldProps) {
  const colors = useThemeColors();
  const { t, intlLocale } = useI18n();
  const [open, setOpen] = useState(false);

  const apply = (next: Date) => {
    onChange(new Date(next.getFullYear(), next.getMonth(), next.getDate(), 12, 0, 0, 0));
    if (Platform.OS !== 'ios') {
      setOpen(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: colors.faint }]} numberOfLines={2}>
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen((current) => !current)}
        style={[insetSurface(colors, 16), styles.well]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={[styles.value, { color: colors.ink }]} numberOfLines={2}>
          {formatDateFieldValue(value, display, intlLocale)}
        </Text>
      </Pressable>
      {open ? (
        <View style={styles.picker}>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={value}
              mode="date"
              display="inline"
              onValueChange={(_event, date) => apply(date)}
              onDismiss={() => setOpen(false)}
              themeVariant={colors.scheme}
              locale={intlLocale}
            />
          ) : (
            <DateTimePicker
              value={value}
              mode="date"
              display="calendar"
              onValueChange={(_event, date) => apply(date)}
              onDismiss={() => setOpen(false)}
              onChange={(event, date) => {
                if (event.type === 'dismissed') {
                  setOpen(false);
                  return;
                }
                if (date) {
                  apply(date);
                }
              }}
            />
          )}
          {Platform.OS === 'ios' ? (
            <Pressable onPress={() => setOpen(false)} style={styles.done} accessibilityRole="button">
              <Text style={[styles.doneLabel, { color: colors.accent }]}>{t('common.done')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
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
  },
  value: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, flexShrink: 1, minWidth: 0 },
  picker: { gap: 8 },
  done: { minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  doneLabel: { fontFamily: fonts.bodyMedium, fontSize: 16 },
});
