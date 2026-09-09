import { StyleSheet, Text, View } from 'react-native';
import { formatDuration } from '../../utils/dateUtils';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface } from '../theme/tokens';

interface VoicePlayerProps {
  uri: string;
  durationMs?: number;
}

/**
 * Purpose: web stub for voice playback so Metro never loads expo-audio.
 * Inputs: unused URI plus optional duration.
 * Outputs: a phone-app message.
 * Side effects: none.
 */
export function VoicePlayer({ durationMs }: VoicePlayerProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  return (
    <View style={[insetSurface(colors, 20), styles.row]}>
      <Text style={[styles.copy, { color: colors.muted }]}>
        {t('voice.webNote')}
        {durationMs ? ` · ${formatDuration(durationMs)}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    padding: 14,
  },
  copy: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
});
