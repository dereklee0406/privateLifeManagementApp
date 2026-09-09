import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { formatDuration } from '../../utils/dateUtils';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, raisedAccent, raisedSurface } from '../theme/tokens';
import { VoicePlayer } from './VoicePlayer';

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
 * Purpose: record, pause, stop, and preview a voice journal clip on native devices.
 * Inputs: current clip and change handler.
 * Outputs: recorder chrome with duration and SF-style action icons.
 * Side effects: microphone permission, audio session, writes a recording into the document directory.
 * Design decisions: expo-audio is imported only here. directory: 'document' keeps clips out of cache.
 */
export function VoiceCapture({ value, onChange, heading }: VoiceCaptureProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const title = heading ?? t('voice.title');
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
  const state = useAudioRecorderState(recorder);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('voice.micNeededTitle'), t('voice.micNeededBody'));
      return;
    }
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        interruptionMode: 'mixWithOthers',
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPaused(false);
    } catch {
      setError(t('voice.recordError'));
    }
  };

  const pause = () => {
    recorder.pause();
    setPaused(true);
  };

  const resume = () => {
    recorder.record();
    setPaused(false);
  };

  const stop = async () => {
    await recorder.stop();
    setPaused(false);
    const uri = recorder.uri;
    if (uri) {
      onChange({ uri, durationMs: state.durationMillis });
    }
  };

  if (value) {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.heading, { color: colors.faint }]}>{title}</Text>
        <VoicePlayer uri={value.uri} durationMs={value.durationMs} />
        <Pressable
          onPress={() => onChange(null)}
          accessibilityRole="button"
          accessibilityLabel={t('voice.removeRecording')}
        >
          <Text style={[styles.remove, { color: colors.danger }]}>{t('voice.removeRecording')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: colors.faint }]}>{title}</Text>
      <Text style={[styles.clock, { color: colors.ink }]}>{formatDuration(state.durationMillis)}</Text>
      <View style={styles.actions}>
        {!state.isRecording && !paused ? (
          <Pressable
            onPress={() => void start()}
            style={[raisedAccent(colors, 16), styles.primary]}
            accessibilityRole="button"
            accessibilityLabel={t('voice.record')}
          >
            <Ionicons name="mic" size={20} color={colors.accentInk} accessible={false} importantForAccessibility="no" />
            <Text style={[styles.primaryLabel, { color: colors.accentInk }]}>{t('voice.record')}</Text>
          </Pressable>
        ) : null}
        {state.isRecording ? (
          <Pressable
            onPress={pause}
            style={[raisedSurface(colors, 16), styles.secondary]}
            accessibilityRole="button"
            accessibilityLabel={t('voice.pause')}
          >
            <Ionicons name="pause" size={20} color={colors.ink} accessible={false} importantForAccessibility="no" />
            <Text style={[styles.secondaryLabel, { color: colors.ink }]}>{t('voice.pause')}</Text>
          </Pressable>
        ) : null}
        {paused ? (
          <Pressable
            onPress={resume}
            style={[raisedSurface(colors, 16), styles.secondary]}
            accessibilityRole="button"
            accessibilityLabel={t('voice.resume')}
          >
            <Ionicons name="play" size={20} color={colors.ink} accessible={false} importantForAccessibility="no" />
            <Text style={[styles.secondaryLabel, { color: colors.ink }]}>{t('voice.resume')}</Text>
          </Pressable>
        ) : null}
        {state.isRecording || paused ? (
          <Pressable
            onPress={() => void stop()}
            style={[raisedAccent(colors, 16), styles.primary]}
            accessibilityRole="button"
            accessibilityLabel={t('voice.stop')}
          >
            <Ionicons name="stop" size={20} color={colors.accentInk} accessible={false} importantForAccessibility="no" />
            <Text style={[styles.primaryLabel, { color: colors.accentInk }]}>{t('voice.stop')}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  heading: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  clock: { fontFamily: fonts.display, fontSize: 36 },
  actions: { flexDirection: 'row', gap: 8 },
  primary: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryLabel: { fontFamily: fonts.bodySemi, fontSize: 15 },
  secondary: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryLabel: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  remove: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  error: { fontFamily: fonts.body, fontSize: 13 },
});
