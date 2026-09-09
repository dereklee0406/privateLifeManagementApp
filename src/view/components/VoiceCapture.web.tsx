import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface } from '../theme/tokens';

export interface VoiceCaptureValue {
  uri: string;
  durationMs: number;
}

interface VoiceCaptureProps {
  value: VoiceCaptureValue | null;
  onChange: (next: VoiceCaptureValue | null) => void;
  heading?: string;
}

/**
 * Purpose: web stub for voice capture so Metro never loads expo-audio.
 * Inputs: unused clip state (always null on web).
 * Outputs: a clear phone-app message.
 * Side effects: none.
 */
export function VoiceCapture({ heading }: VoiceCaptureProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const title = heading ?? t('voice.title');
  return (
    <View style={[insetSurface(colors, 20), styles.card]}>
      <Text style={[styles.heading, { color: colors.faint }]}>{title}</Text>
      <Text style={[styles.copy, { color: colors.muted }]}>{t('voice.webNote')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 8,
  },
  heading: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  copy: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
});
