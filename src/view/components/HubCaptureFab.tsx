import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticLight } from '../../utils/haptics';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { raisedAccent } from '../theme/tokens';
import { tabScenePaddingBottom } from '../theme/typography';
import { GlobalFastCaptureSheet } from './GlobalFastCaptureSheet';
import { QuickSpendSheet } from './QuickSpendSheet';

/**
 * Purpose: one Fast Capture FAB shared by all five hubs (Today, Journal, Rhythm, Wallet, Insights).
 * Inputs: none — owns its own sheet visibility.
 * Outputs: accent FAB + GlobalFastCaptureSheet (Write / Spend / Habit) + QuickSpendSheet handoff.
 * Side effects: light haptic on open; spend tile opens QuickSpendSheet after the capture sheet closes.
 * Design decisions: each hub screen mounts this once so the FAB sits in ScreenScaffold (full
 *   scene), not inside the tab bar (which would clip overflow). Transfer stays off the sheet
 *   (Wallet `/transfer/new` only).
 */
export function HubCaptureFab() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [quickSpendOpen, setQuickSpendOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => {
          void hapticLight();
          setCaptureOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('capture.title')}
        style={({ pressed }) => [
          raisedAccent(colors, 28),
          styles.fab,
          {
            bottom: tabScenePaddingBottom(insets.bottom) + 12,
            right: 22,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
        ]}
      >
        <Ionicons name="add" size={28} color={colors.accentInk} accessible={false} importantForAccessibility="no" />
      </Pressable>
      <GlobalFastCaptureSheet
        visible={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onSelectSpend={() => {
          setCaptureOpen(false);
          setTimeout(() => setQuickSpendOpen(true), 280);
        }}
      />
      <QuickSpendSheet visible={quickSpendOpen} onClose={() => setQuickSpendOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
