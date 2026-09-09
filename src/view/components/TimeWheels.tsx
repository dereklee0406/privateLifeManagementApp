import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n';
import { HourPicker } from './HourPicker';

interface TimeWheelsProps {
  hour: number;
  minute: number;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  /** Optional control beside the HOUR label (credit-card ping enable switch). */
  headerRight?: ReactNode;
}

/**
 * Purpose: two equal neumorph snap wheels — HOUR | MINUTE — without overlapping preview text.
 * Inputs: stored hour 0–23, minute 0–59, change handlers, optional hour-header control.
 * Outputs: a row of two 3-row inset wells. Preview and next-fire stay outside this component.
 * Side effects: onHourChange / onMinuteChange from each wheel.
 * Design decisions: minutes are a second HourPicker(kind=minute), not a NumberStepper, so the
 *   old 11:00 PM + Next Today collision cannot return. 12h/24h applies to the hour wheel only.
 */
export function TimeWheels({ hour, minute, onHourChange, onMinuteChange, headerRight }: TimeWheelsProps) {
  const { t } = useI18n();
  return (
    <View style={styles.row}>
      <View style={styles.col}>
        <HourPicker label={t('reminder.hour')} value={hour} onChange={onHourChange} headerRight={headerRight} />
      </View>
      <View style={styles.col}>
        <HourPicker kind="minute" label={t('reminder.minute')} value={minute} onChange={onMinuteChange} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, width: '100%', alignItems: 'flex-start' },
  col: { flex: 1, minWidth: 0 },
});
