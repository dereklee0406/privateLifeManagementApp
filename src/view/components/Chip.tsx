import { Platform, Pressable, StyleSheet, Text, View, type PressableProps, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight } from '../../utils/haptics';
import { useThemeColors } from '../theme/ThemeProvider';
import { useTypography } from '../theme/TypographyProvider';
import { chipSurface, fonts } from '../theme/tokens';
import { reminderTypeTextProps, reminderTypeTextStyle } from './scalableLabel';
import { TYPE_ICON_SIZE, type TypeIconName } from '../icons/typeIcons';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: ViewStyle;
  /** Shrink/wrap long labels. Default true. Ignored when `icon` is set. */
  scalable?: boolean;
  /** When set, the chip is icon-only (44pt); `label` is a11y + web tooltip. */
  icon?: TypeIconName;
  /** Optional leading glyph beside the label (Paid with card chips). Ignored when `icon` is set. */
  leadingIcon?: TypeIconName;
  /** Long-press for secondary actions (e.g. open editor while tap logs). */
  onLongPress?: () => void;
}

type ChipPressableProps = PressableProps & { title?: string };

/**
 * Purpose: compact selectable chip used by reminder/money pickers.
 * Inputs: label, selected, press, optional Ionicons name, optional extra style, optional scalable (default true).
 * Outputs: inset or raised pill — selected chips use a crisp 1.5px accent border/glow.
 * Side effects: light haptic on toggle when Customize haptics are on; then onPress.
 * Design decisions: text chips wrap instead of shrinking the row; type chips drop the visible word and keep neumorph glow
 *   so the selected type is obvious. Screen readers still hear Car / 按揭 via `label`. Label fontSize
 *   scales with useTypography (14 × fontScale) so Appearance text-size presets reach chips.
 *   Optional `leadingIcon` keeps Paid with cash/card glyphs beside the name without switching to icon-only mode.
 */
export function Chip({
  label,
  selected,
  onPress,
  style,
  scalable = true,
  icon,
  leadingIcon,
  onLongPress,
}: ChipProps) {
  const colors = useThemeColors();
  const { fontScale } = useTypography();
  const scaleProps = scalable ? reminderTypeTextProps(2) : { numberOfLines: 1 as const };
  const ink = selected ? colors.accent : colors.ink;
  const pressableProps: ChipPressableProps = {
    onPress: () => {
      void hapticLight();
      onPress();
    },
    onLongPress,
    accessibilityRole: 'button',
    accessibilityLabel: label,
    accessibilityState: { selected },
    style: ({ pressed }) => [
      chipSurface(colors, selected),
      styles.chip,
      icon ? styles.iconChip : null,
      {
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      },
      style,
    ],
  };
  if (Platform.OS === 'web') {
    pressableProps.title = label;
  }
  return (
    <Pressable {...pressableProps}>
      {icon ? (
        <Ionicons
          name={icon}
          size={TYPE_ICON_SIZE}
          color={ink}
          accessible={false}
          importantForAccessibility="no"
        />
      ) : (
        <View style={styles.labelRow}>
          {leadingIcon ? (
            <Ionicons
              name={leadingIcon}
              size={16}
              color={ink}
              accessible={false}
              importantForAccessibility="no"
            />
          ) : null}
          <Text
            style={[
              styles.label,
              reminderTypeTextStyle,
              { color: ink, fontSize: Math.round(14 * fontScale) },
            ]}
            {...scaleProps}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    maxWidth: '100%',
    minWidth: 0,
    flexShrink: 0,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  iconChip: {
    width: 44,
    minWidth: 44,
    paddingVertical: 0,
    paddingHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    minWidth: 0,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    maxWidth: '100%',
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
});
