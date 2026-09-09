import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TypeIconName } from '../icons/typeIcons';
import { useThemeColors } from '../theme/ThemeProvider';
import { type } from '../theme/typography';
import { PrimaryButton } from './PrimaryButton';

/**
 * Purpose: girlfriend-simple empty or search-miss copy plus one next tap.
 * Inputs: one sentence, optional soft icon backdrop, optional action label/handler/icon.
 * Outputs: muted line (+ optional watermark) + clay button when an action exists.
 * Side effects: onAction only.
 * Design decisions: backdropIcon is decorative (low opacity) so empty lists feel warmer without
 *   competing with the prompt or CTA.
 */
export function EmptyState({
  message,
  backdropIcon,
  actionLabel,
  actionIcon,
  onAction,
}: {
  message: string;
  /** Soft watermark icon behind the prompt (e.g. card-outline on Payment Cards). */
  backdropIcon?: TypeIconName;
  actionLabel?: string;
  actionIcon?: TypeIconName;
  onAction?: () => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.wrap}>
      {backdropIcon ? (
        <View style={styles.backdrop} accessible={false} importantForAccessibility="no">
          <Ionicons name={backdropIcon} size={72} color={colors.faint} style={styles.backdropIcon} />
        </View>
      ) : null}
      <Text style={[styles.message, { color: colors.muted }]}>{message}</Text>
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} icon={actionIcon} onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, marginTop: 8, position: 'relative', alignItems: 'stretch' },
  backdrop: {
    position: 'absolute',
    top: -4,
    right: 8,
    opacity: 0.22,
    zIndex: 0,
  },
  backdropIcon: {
    opacity: 1,
  },
  message: { ...type.body, zIndex: 1 },
});
