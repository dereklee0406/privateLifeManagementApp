import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import type { TodayPrediction } from '../../model/insights/predictions';
import { appHref } from '../../utils/navigation';
import { localizeTodayPrediction, useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

/**
 * Purpose: one muted prediction line on Today (and Insights week echo) — not a second hero.
 * Inputs: TodayPrediction from Model.
 * Outputs: compact tappable line.
 * Side effects: navigates to href (Rhythm / Wallet / Compose). No notifications.
 * Design decisions: sits under Season; Next Up stays the due hero. Skip rendering when null.
 */
export function TodayPredictionLine({ prediction }: { prediction: TodayPrediction }) {
  const colors = useThemeColors();
  const router = useRouter();
  const { t } = useI18n();
  const line = localizeTodayPrediction(t, prediction);
  return (
    <Pressable
      onPress={() => router.push(appHref(prediction.href))}
      accessibilityRole="button"
      accessibilityLabel={t('home.predictionA11y', { line })}
      hitSlop={8}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.line, { color: colors.muted }]} numberOfLines={2}>
        {line}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
});
