import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MoodId } from '../../model/journal/Mood';
import { MOODS } from '../../model/journal/Mood';
import { hapticLight } from '../../utils/haptics';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface, raisedSurface } from '../theme/tokens';

interface MoodPickerProps {
  value: MoodId;
  onChange: (mood: MoodId) => void;
}

/**
 * Purpose: let the writer choose one of four emoji moods for a page.
 * Inputs: selected mood and change handler.
 * Outputs: horizontal emoji row with localized labels.
 * Side effects: light haptic on selection.
 */
export function MoodPicker({ value, onChange }: MoodPickerProps) {
  const colors = useThemeColors();
  const { t } = useI18n();

  return (
    <View style={styles.row}>
      {MOODS.map((mood) => {
        const selected = mood.id === value;
        const label = t(`mood.${mood.id}`);
        return (
          <Pressable
            key={mood.id}
            onPress={() => {
              void hapticLight();
              onChange(mood.id);
            }}
            style={styles.item}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
          >
            <View
              style={[
                styles.orb,
                selected ? raisedSurface(colors, 26) : insetSurface(colors, 26),
                {
                  backgroundColor: selected ? colors.mood[mood.id] : colors.well,
                  transform: [{ scale: selected ? 1.06 : 1 }],
                },
              ]}
            >
              <Text style={styles.emoji}>{mood.emoji}</Text>
            </View>
            <Text
              style={[styles.label, { color: selected ? colors.ink : colors.faint }]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  item: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  orb: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 26,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.2,
    lineHeight: 14,
    textAlign: 'center',
    flexShrink: 1,
  },
});
