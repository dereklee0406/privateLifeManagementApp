import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppConfig } from '../../config/appConfig';
import { hapticLight } from '../../utils/haptics';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface, raisedSurface } from '../theme/tokens';

interface PinPadProps {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  onSubmit?: (pin: string) => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const;

/**
 * Purpose: 4–6 digit PIN entry shared by lock screen and You-tab setup.
 * Inputs: current PIN string and change handler.
 * Outputs: numeric keypad UI.
 * Side effects: light haptic on keypress.
 */
export function PinPad({ value, onChange, maxLength = AppConfig.lock.pinMaxLength, onSubmit }: PinPadProps) {
  const colors = useThemeColors();

  const press = (key: string) => {
    void hapticLight();
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }
    if (!key || value.length >= maxLength) {
      return;
    }
    const next = value + key;
    onChange(next);
    if (next.length >= 4 && next.length === maxLength && onSubmit) {
      onSubmit(next);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.dots}>
        {Array.from({ length: Math.max(4, value.length) }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index < value.length ? raisedSurface(colors, 6) : insetSurface(colors, 6),
              { backgroundColor: index < value.length ? colors.accent : colors.well },
            ]}
          />
        ))}
      </View>
      <View style={styles.grid}>
        {KEYS.map((key, index) => (
          <Pressable
            key={`${key}-${index}`}
            onPress={() => press(key)}
            disabled={!key}
            style={[key ? raisedSurface(colors, 16) : null, styles.key]}
          >
            <Text style={[styles.keyLabel, { color: colors.ink }]}>{key}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 28, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 10 },
  dot: { width: 12, height: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 264, gap: 12, justifyContent: 'center' },
  key: {
    width: 80,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyLabel: { fontFamily: fonts.display, fontSize: 22 },
});
