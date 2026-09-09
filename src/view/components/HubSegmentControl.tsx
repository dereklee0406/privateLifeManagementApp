import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TypeIconName } from '../icons/typeIcons';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface, raisedSurface } from '../theme/tokens';
import { useTypography } from '../theme/TypographyProvider';
import { hapticLight } from '../../utils/haptics';

export interface HubSegmentOption<T extends string> {
  id: T;
  label: string;
  icon?: TypeIconName;
}

interface HubSegmentControlProps<T extends string> {
  options: readonly HubSegmentOption<T>[];
  value: T;
  onChange: (id: T) => void;
}

/**
 * Purpose: neumorphic inset track with raised selected pill for hub-level segment switching.
 * Inputs: options (id/label/icon), current value, onChange.
 * Outputs: accessible tablist control; presentation only.
 * Side effects: light haptic on selection change.
 * Design decisions: mirrors QuickSpendSheet modeTrack (inset well + raisedAccent soft pill)
 *   so Money / Rhythm hubs share one tactile pattern without duplicating styles.
 */
export function HubSegmentControl<T extends string>({
  options,
  value,
  onChange,
}: HubSegmentControlProps<T>) {
  const colors = useThemeColors();
  const { type, scaleFontSize } = useTypography();
  const labelSize = scaleFontSize(13);

  const select = (id: T) => {
    if (id === value) {
      return;
    }
    void hapticLight();
    onChange(id);
  };

  return (
    <View
      style={[insetSurface(colors, 16), styles.track]}
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => select(option.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={({ pressed }) => [
              selected ? raisedSurface(colors, 14) : null,
              styles.segment,
              {
                backgroundColor: selected ? colors.accentSoft : 'transparent',
                borderWidth: selected ? 1.5 : 0,
                borderColor: selected ? colors.accent : 'transparent',
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            {option.icon ? (
              <Ionicons
                name={option.icon}
                size={15}
                color={selected ? colors.accent : colors.muted}
                accessible={false}
                importantForAccessibility="no"
              />
            ) : null}
            <Text
              style={[
                type.footnote,
                styles.label,
                {
                  color: selected ? colors.accent : colors.muted,
                  fontSize: labelSize,
                  fontFamily: fonts.bodySemi,
                },
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 14,
  },
  label: {
    flexShrink: 1,
  },
});
