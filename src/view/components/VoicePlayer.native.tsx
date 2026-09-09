import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { formatDuration } from '../../utils/dateUtils';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface, raisedSurface } from '../theme/tokens';

interface VoicePlayerProps {
  uri: string;
  durationMs?: number;
}

/**
 * Purpose: play a saved voice clip on Android and iOS.
 * Inputs: file URI and optional duration for the label.
 * Outputs: play / pause icon control.
 * Side effects: starts audio playback.
 * Design decisions: expo-audio is imported only from this .native.tsx file.
 */
export function VoicePlayer({ uri, durationMs }: VoicePlayerProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const label = durationMs ? formatDuration(durationMs) : t('voice.title');
  const playing = status.playing;

  return (
    <View style={[insetSurface(colors, 20), styles.row]}>
      <Pressable
        onPress={() => {
          if (playing) {
            player.pause();
          } else {
            player.play();
          }
        }}
        style={[raisedSurface(colors, 14), styles.btn, { backgroundColor: colors.accentSoft }]}
        accessibilityRole="button"
        accessibilityLabel={playing ? t('voice.pauseA11y') : t('voice.playA11y')}
      >
        <Ionicons
          name={playing ? 'pause' : 'play'}
          size={20}
          color={colors.accent}
          accessible={false}
          importantForAccessibility="no"
        />
      </Pressable>
      <Text style={[styles.meta, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
  },
  btn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { fontFamily: fonts.body, fontSize: 14 },
});
