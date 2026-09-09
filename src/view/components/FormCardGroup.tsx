import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../theme/ThemeProvider';
import { raisedSurface } from '../theme/tokens';
import { KeyboardDismissScrollView } from './KeyboardDismissScrollView';
import { PrimaryButton } from './PrimaryButton';
import { ScreenHeader } from './ScreenHeader';
import { ScreenScaffold } from './ScreenScaffold';
import { SheetChrome } from './SheetChrome';
import type { Ionicons } from '@expo/vector-icons';

export interface FormCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Purpose: standard neumorphic card wrapper used across Halo transactional forms.
 * Inputs: children and optional style overrides.
 * Outputs: raisedSurface(22) container with standard 14pt padding and gap.
 */
export function FormCard({ children, style }: FormCardProps) {
  const colors = useThemeColors();
  return <View style={[raisedSurface(colors, 22), styles.card, style]}>{children}</View>;
}

export interface FormCardGroupProps {
  title: string;
  headerTrailingLabel?: string;
  headerTrailingIcon?: keyof typeof Ionicons.glyphMap;
  onHeaderTrailing?: () => void;
  headerTrailingDisabled?: boolean;
  children: ReactNode;
  stickyButtonLabel: string;
  stickyButtonIcon?: keyof typeof Ionicons.glyphMap;
  onStickyButtonPress: () => void | Promise<void>;
  stickyButtonDisabled?: boolean;
  stickyButtonBusy?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Purpose: reusable MVC Form-Card-Group container for transactional modal sheets
 * (Expense, Income, Transfer, Split).
 * Inputs: header props, card children, sticky CTA props.
 * Outputs: full-screen sheet with auto-insets, scroll dismissal, and pinned bottom action.
 * Side effects: none.
 * Design decisions: encapsulates standard safe-area padding (`insets.bottom + 90` clearance)
 * so content is never obscured by the pinned sticky button.
 */
export function FormCardGroup({
  title,
  headerTrailingLabel,
  headerTrailingIcon,
  onHeaderTrailing,
  headerTrailingDisabled,
  children,
  stickyButtonLabel,
  stickyButtonIcon = 'checkmark-circle-outline',
  onStickyButtonPress,
  stickyButtonDisabled,
  stickyButtonBusy,
  contentStyle,
}: FormCardGroupProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <ScreenScaffold>
      <SheetChrome>
        <ScreenHeader
          title={title}
          trailingIcon={headerTrailingIcon}
          trailingLabel={headerTrailingLabel}
          onTrailing={onHeaderTrailing}
          trailingDisabled={headerTrailingDisabled}
        />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <KeyboardDismissScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom, 16) + 90 },
              contentStyle,
            ]}
          >
            {children}
          </KeyboardDismissScrollView>

          <View
            style={[
              styles.stickyBar,
              {
                paddingBottom: Math.max(insets.bottom, 12),
                backgroundColor: colors.paper,
                borderTopColor: colors.line,
              },
            ]}
          >
            <PrimaryButton
              icon={stickyButtonIcon}
              label={stickyButtonLabel}
              onPress={onStickyButtonPress}
              disabled={stickyButtonDisabled}
              busy={stickyButtonBusy}
            />
          </View>
        </KeyboardAvoidingView>
      </SheetChrome>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 22, gap: 14 },
  card: {
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  stickyBar: {
    paddingHorizontal: 22,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
