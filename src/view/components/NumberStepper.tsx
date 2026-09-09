import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, raisedSurface } from '../theme/tokens';

interface StepperProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}

/**
 * Purpose: +/- integer control for Every-N intervals (not clock minutes).
 * Inputs: label, value, bounds.
 * Outputs: stepper row.
 * Side effects: none besides onChange.
 * Design decisions: calendar dates use DateField; clock time uses TimeWheels (hour + minute).
 *   Reminder compose must not put this stepper in a flex:1 well beside the wheels.
 */
export function NumberStepper({ label, value, onChange, min = 0, max = 99 }: StepperProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.muted }]} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.row}>
        <Pressable onPress={() => onChange(Math.max(min, value - 1))} style={[raisedSurface(colors, 14), styles.btn]}>
          <Text style={[styles.btnLabel, { color: colors.ink }]}>−</Text>
        </Pressable>
        <Text style={[styles.value, { color: colors.ink }]}>{value}</Text>
        <Pressable onPress={() => onChange(Math.min(max, value + 1))} style={[raisedSurface(colors, 14), styles.btn]}>
          <Text style={[styles.btnLabel, { color: colors.ink }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 0, gap: 6 },
  label: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', lineHeight: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  btnLabel: { fontFamily: fonts.display, fontSize: 20 },
  value: { fontFamily: fonts.display, fontSize: 22, minWidth: 36, textAlign: 'center' },
});
