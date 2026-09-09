import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { hapticBoundary, hapticLight } from '../../utils/haptics';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface, raisedSurface } from '../theme/tokens';

interface DayOfMonthStepperProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
}

/**
 * Purpose: pick a recurring civil day-of-month (1–31) for statement/due — not a calendar date.
 * Inputs: label, current day 1–31, onChange.
 * Outputs: − / + row with ordinal (or plain day) display and a typed number field.
 * Side effects: hapticLight on successful ±; hapticBoundary when already at 1 or 31.
 * Design decisions: credit-card statement/due are monthly civil days; Web DateField calendar
 *   overlays break those fields, so this control never opens a year/month picker.
 */
export function DayOfMonthStepper({ label, value, onChange }: DayOfMonthStepperProps) {
  const colors = useThemeColors();
  const { intlLocale } = useI18n();
  const inputRef = useRef<TextInput>(null);
  const clamped = clampDay(value);
  const [draft, setDraft] = useState(String(clamped));

  useEffect(() => {
    setDraft(String(clamped));
  }, [clamped]);

  const commit = (raw: number) => {
    const next = clampDay(raw);
    onChange(next);
    setDraft(String(next));
  };

  /**
   * Purpose: nudge day by ±1 with tactile success vs bound feedback.
   * Inputs: delta −1 or +1.
   * Outputs: none (commits via onChange when in range).
   * Side effects: hapticLight on success; hapticBoundary at 1/− or 31/+; no-op value at bounds.
   */
  const step = (delta: number) => {
    const atMin = delta < 0 && clamped <= 1;
    const atMax = delta > 0 && clamped >= 31;
    if (atMin || atMax) {
      void hapticBoundary();
      return;
    }
    void hapticLight();
    commit(clamped + delta);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.faint }]} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => step(-1)}
          accessibilityRole="button"
          accessibilityLabel={`${label} decrease`}
          style={[raisedSurface(colors, 14), styles.btn]}
        >
          <Text style={[styles.btnLabel, { color: colors.ink }]}>−</Text>
        </Pressable>
        <Pressable
          onPress={() => inputRef.current?.focus()}
          style={[insetSurface(colors, 14), styles.valueWell]}
        >
          <Text style={[styles.ordinal, { color: colors.accent }]} pointerEvents="none" numberOfLines={1}>
            {formatDayOfMonth(clamped, intlLocale)}
          </Text>
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={(text) => {
              const digits = text.replace(/[^\d]/g, '').slice(0, 2);
              setDraft(digits);
              if (digits.length === 0) {
                return;
              }
              const parsed = Number(digits);
              if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 31) {
                onChange(parsed);
              }
            }}
            onBlur={() => {
              const parsed = Number(draft);
              commit(Number.isFinite(parsed) ? parsed : clamped);
            }}
            keyboardType="number-pad"
            maxLength={2}
            selectTextOnFocus
            style={[styles.input, { color: colors.ink }]}
            accessibilityLabel={label}
          />
        </Pressable>
        <Pressable
          onPress={() => step(1)}
          accessibilityRole="button"
          accessibilityLabel={`${label} increase`}
          style={[raisedSurface(colors, 14), styles.btn]}
        >
          <Text style={[styles.btnLabel, { color: colors.ink }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Purpose: keep day-of-month in the valid monthly range.
 * Inputs: raw number.
 * Outputs: integer 1–31.
 * Side effects: none.
 */
function clampDay(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(31, Math.max(1, Math.round(value)));
}

/**
 * Purpose: girlfriend-readable day label (15th in English; plain day otherwise).
 * Inputs: day 1–31, BCP-47 locale.
 * Outputs: display string.
 * Side effects: none.
 */
function formatDayOfMonth(day: number, locale: string): string {
  if (!locale.toLowerCase().startsWith('en')) {
    return String(day);
  }
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

const styles = StyleSheet.create({
  wrap: { gap: 6, minWidth: 0 },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  btnLabel: { fontFamily: fonts.display, fontSize: 22 },
  valueWell: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  ordinal: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.4 },
  input: {
    fontFamily: fonts.display,
    fontSize: 24,
    textAlign: 'center',
    minWidth: 48,
    padding: 0,
    margin: 0,
  },
});
