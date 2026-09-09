import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppConfig } from '../../config/appConfig';
import { LocationField } from '../components/LocationField';
import type { JournalLocation } from '../../model/journal/JournalEntry';
import { useJournal } from '../../controller/JournalProvider';
import type { MoodId } from '../../model/journal/Mood';
import { formatLongDate } from '../../utils/dateUtils';
import { hapticSuccess } from '../../utils/haptics';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { BackButton } from '../components/BackButton';
import { MoodPicker } from '../components/MoodPicker';
import { MoodNoteField } from '../components/MoodNoteField';
import { PhotoAttachments } from '../components/PhotoAttachments';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SectionActionButton } from '../components/SectionActionButton';
import { TagChips } from '../components/TagChips';
import { VoiceCapture, type VoiceCaptureValue } from '../components/VoiceCapture';
import { VoicePlayer } from '../components/VoicePlayer';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

/**
 * Purpose: read and edit a stored journal page, including media.
 * Inputs: route id plus journal context.
 * Outputs: editor for an existing entry, or a missing-state.
 * Side effects: update/delete persistence and navigation.
 */
export function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { getEntry, updateEntry, deleteEntry } = useJournal();
  const entry = id ? getEntry(id) : undefined;
  const [mood, setMood] = useState<MoodId>('neutral');
  const [moodNote, setMoodNote] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [voice, setVoice] = useState<VoiceCaptureValue | null>(null);
  const [location, setLocation] = useState<JournalLocation | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) {
      return;
    }
    setMood(entry.mood);
    setMoodNote(entry.moodNote ?? '');
    setTitle(entry.title);
    setBody(entry.body);
    setTags(entry.tags);
    setPhotoUris(entry.photoUris);
    setVoice(entry.voiceUri ? { uri: entry.voiceUri, durationMs: entry.voiceDurationMs ?? 0 } : null);
    setLocation(entry.location);
  }, [entry?.id]);

  if (!entry) {
    return (
      <ScreenScaffold>
        <View style={[styles.missing, { paddingTop: insets.top + 24 }]}>
          <Text style={[styles.missingText, { color: colors.muted }]}>{t('pages.pageNotFound')}</Text>
          <BackButton />
        </View>
      </ScreenScaffold>
    );
  }

  const onSave = async () => {
    setSaving(true);
    await updateEntry(entry.id, {
      title,
      body,
      mood,
      moodNote: moodNote || null,
      tags,
      photoUris,
      voiceUri: voice?.uri ?? null,
      voiceDurationMs: voice?.durationMs ?? null,
      location: location ?? null,
    });
    await hapticSuccess();
    setSaving(false);
    router.back();
  };

  const onDelete = () => {
    const run = () => {
      void deleteEntry(entry.id).then(() => router.back());
    };
    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        window.confirm(`${t('pages.deletePageConfirmTitle')} ${t('pages.deletePageConfirmBody')}`)
      ) {
        run();
      }
      return;
    }
    Alert.alert(t('pages.deletePageConfirmTitle'), t('pages.deletePageConfirmBody'), [
      { text: t('pages.keepPage'), style: 'cancel' },
      { text: t('pages.releasePage'), style: 'destructive', onPress: run },
    ]);
  };

  return (
    <ScreenScaffold>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader
          title={entry.title || formatLongDate(new Date(entry.createdAt))}
          trailingIcon="trash-outline"
          trailingLabel={t('common.delete')}
          trailingTone="danger"
          onTrailing={onDelete}
        />
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <MoodPicker value={mood} onChange={setMood} />
          <MoodNoteField value={moodNote} onChange={setMoodNote} />
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={AppConfig.writing.maxTitleLength}
            style={[styles.title, { color: colors.ink }]}
          />
          {entry.kind === 'voice' ? (
            voice ? (
              <>
                <VoicePlayer uri={voice.uri} durationMs={voice.durationMs} />
                <SectionActionButton
                  icon="trash-outline"
                  label={t('common.delete')}
                  tone="muted"
                  onPress={() => setVoice(null)}
                />
              </>
            ) : (
              <VoiceCapture value={voice} onChange={setVoice} heading={t('pages.replaceRecording')} />
            )
          ) : (
            <>
              <MarkdownEditor value={body} onChange={setBody} />
              <PhotoAttachments
                uris={photoUris}
                onChange={setPhotoUris}
                onOcrText={(text) => {
                  setBody((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text));
                }}
              />
              <VoiceCapture value={voice} onChange={setVoice} heading={t('pages.voiceNote')} />
            </>
          )}
          <TagChips value={tags} onChange={setTags} />
          <LocationField value={location} onChange={setLocation} />
          <PrimaryButton
            icon="checkmark-circle-outline"
            label={saving ? t('common.saving') : t('common.save')}
            onPress={() => void onSave()}
            disabled={saving}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 22, gap: 22 },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40 },
  missing: { paddingHorizontal: 24, gap: 12 },
  missingText: { fontFamily: fonts.display, fontSize: 28 },
});
