import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TypeIconName } from '../icons/typeIcons';
import { useThemeColors } from '../theme/ThemeProvider';
import { useTypography } from '../theme/TypographyProvider';
import { BackButton } from './BackButton';
import { HeaderIconButton } from './HeaderIconButton';
import { TextButton } from './TextButton';

/**
 * Purpose: compact navigation bar on pushed screens — Back chevron, centered title, optional trailing action.
 * Inputs: title; optional onBack; optional trailing icon (preferred) or label + handler; optional leadingWidth.
 * Outputs: 44pt bar with scaled navTitle. Large titles stay on root tabs via LargeTitle.
 * Side effects: Back uses leaveScreen unless onBack is passed.
 * Design decisions: Keep/Add/Done use HeaderIconButton; rare text trailers still use TextButton.
 *   Title uses useTypography so font-size preference reaches pushed screens.
 */
export function ScreenHeader({
  title,
  onBack,
  trailingIcon,
  trailingLabel,
  onTrailing,
  trailingDisabled,
  trailingTone = 'accent',
  includeSafeArea = true,
}: {
  title: string;
  onBack?: () => void;
  /** When set with onTrailing, renders a raised icon (a11y = trailingLabel). */
  trailingIcon?: TypeIconName;
  trailingLabel?: string;
  onTrailing?: () => void;
  trailingDisabled?: boolean;
  trailingTone?: 'accent' | 'muted' | 'danger';
  includeSafeArea?: boolean;
}) {
  const colors = useThemeColors();
  const { type } = useTypography();
  const insets = useSafeAreaInsets();
  const trailing =
    onTrailing && trailingIcon && trailingLabel ? (
      <HeaderIconButton
        icon={trailingIcon}
        accessibilityLabel={trailingLabel}
        onPress={onTrailing}
        disabled={trailingDisabled}
      />
    ) : onTrailing && trailingLabel ? (
      <TextButton label={trailingLabel} onPress={onTrailing} disabled={trailingDisabled} tone={trailingTone} />
    ) : (
      <View style={styles.balance} />
    );

  return (
    <View style={[styles.bar, includeSafeArea ? { paddingTop: insets.top + 4 } : null]}>
      <View style={styles.side}>
        <BackButton onPress={onBack} />
      </View>
      <Text style={[type.navTitle, styles.title, { color: colors.ink }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.trailing]}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  side: {
    minWidth: 52,
    justifyContent: 'center',
  },
  trailing: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    minWidth: 0,
  },
  balance: {
    width: 44,
    height: 44,
  },
});
