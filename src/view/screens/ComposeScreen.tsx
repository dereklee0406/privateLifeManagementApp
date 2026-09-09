import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { dateFromDayKey, journalCreatedAtFromDate } from '../../controller/dateFieldValue';
import { toDayKey } from '../../utils/dateUtils';
import { leaveScreen } from '../../utils/navigation';
import { hapticSuccess } from '../../utils/haptics';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { MoodPicker } from '../components/MoodPicker';
import { MoodNoteField } from '../components/MoodNoteField';
import { PhotoAttachments } from '../components/PhotoAttachments';
import { BackButton } from '../components/BackButton';
import { DateField } from '../components/DateField';
import { KeyboardDismissScrollView } from '../components/KeyboardDismissScrollView';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SheetChrome } from '../components/SheetChrome';
import { TagChips } from '../components/TagChips';
import { VoiceCapture, type VoiceCaptureValue } from '../components/VoiceCapture';
import { GlassSurface } from '../components/GlassSurface';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, groupedRadius } from '../theme/tokens';
import { type } from '../theme/typography';

/**
 * Purpose: compose a written page or a voice-first journal page (journal only).
 * Inputs: optional mode/date query params; journal createEntry.
 * Outputs: Write vs Voice choice, then the matching editor with an optional calendar day override.
 * Side effects: persists a page and pops the stack.
 */
export function ComposeScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { mode, date, prompt } = useLocalSearchParams<{ mode?: string; date?: string; prompt?: string }>();
  const composeMode = mode === 'voice' || mode === 'text' ? mode : undefined;
  const dayKey = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  const starter = typeof prompt === 'string' ? prompt : undefined;

  const go = (next: 'text' | 'voice') => {
    router.replace({
      pathname: '/compose',
      params: dayKey ? { mode: next, date: dayKey } : { mode: next },
    });
  };

  return (
    <ScreenScaffold>
      <SheetChrome>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!composeMode ? (
          <View style={[styles.choice, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}>
            <BackButton />
            <Text style={[type.title1, { color: colors.ink }]}>{t('compose.howKeep')}</Text>
            <Pressable onPress={() => go('text')}>
              <GlassSurface style={styles.choiceCard} radius={groupedRadius}>
                <Text style={[styles.choiceTitle, { color: colors.ink }]}>{t('common.write')}</Text>
                <Text style={[styles.choiceBody, { color: colors.muted }]}>{t('compose.writeBody')}</Text>
              </GlassSurface>
            </Pressable>
            <Pressable onPress={() => go('voice')}>
              <GlassSurface style={styles.choiceCard} radius={groupedRadius}>
                <Text style={[styles.choiceTitle, { color: colors.ink }]}>{t('common.record')}</Text>
                <Text style={[styles.choiceBody, { color: colors.muted }]}>{t('compose.recordBody')}</Text>
              </GlassSurface>
            </Pressable>
          </View>
        ) : composeMode === 'voice' ? (
          <VoiceComposeForm dayKey={dayKey} />
        ) : (
          <TextComposeForm dayKey={dayKey} starter={starter} />
        )}
      </KeyboardAvoidingView>
      </SheetChrome>
    </ScreenScaffold>
  );
}

function TextComposeForm({ dayKey, starter }: { dayKey?: string; starter?: string }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { createEntry } = useJournal();
  const [mood, setMood] = useState<MoodId>('neutral');
  const [moodNote, setMoodNote] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState(starter ?? '');
  const [tags, setTags] = useState<string[]>([]);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [voice, setVoice] = useState<VoiceCaptureValue | null>(null);
  const [location, setLocation] = useState<JournalLocation | undefined>();
  const [saving, setSaving] = useState(false);
  const [pageDate, setPageDate] = useState(() => dateFromDayKey(dayKey ?? toDayKey(new Date())));
  const canSave = (body.trim().length > 0 || photoUris.length > 0 || Boolean(voice)) && !saving;

  const onSave = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    await createEntry({
      kind: 'text',
      title,
      body,
      mood,
      moodNote,
      tags,
      photoUris,
      voiceUri: voice?.uri,
      voiceDurationMs: voice?.durationMs,
      createdAt: journalCreatedAtFromDate(pageDate),
      location,
    });
    await hapticSuccess();
    leaveScreen(router);
  };

  return (
    <>
      <ScreenHeader
        title={t('compose.newPage')}
        trailingIcon="checkmark"
        trailingLabel={saving ? t('compose.keeping') : t('common.keep')}
        onTrailing={() => void onSave()}
        trailingDisabled={!canSave}
      />
      <KeyboardDismissScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
      <DateField label={t('compose.pageDay')} value={pageDate} onChange={setPageDate} />
      <MoodPicker value={mood} onChange={setMood} />
      <MoodNoteField value={moodNote} onChange={setMoodNote} />
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={t('compose.titlePlaceholder')}
        placeholderTextColor={colors.faint}
        maxLength={AppConfig.writing.maxTitleLength}
        style={[styles.titleInput, { color: colors.ink }]}
      />
      <MarkdownEditor value={body} onChange={setBody} placeholder={t('compose.bodyPlaceholder')} />
      <TagChips value={tags} onChange={setTags} />
      <LocationField value={location} onChange={setLocation} />
      <PhotoAttachments
        uris={photoUris}
        onChange={setPhotoUris}
        onOcrText={(text) => {
          setBody((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text));
        }}
      />
      <VoiceCapture value={voice} onChange={setVoice} heading={t('compose.mic')} />
      <PrimaryButton
        icon="checkmark-circle-outline"
        label={saving ? t('compose.keeping') : t('compose.keepPage')}
        onPress={() => void onSave()}
        disabled={!canSave}
      />
      </KeyboardDismissScrollView>
    </>
  );
}

function VoiceComposeForm({ dayKey }: { dayKey?: string }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { createEntry } = useJournal();
  const [mood, setMood] = useState<MoodId>('neutral');
  const [moodNote, setMoodNote] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [voice, setVoice] = useState<VoiceCaptureValue | null>(null);
  const [location, setLocation] = useState<JournalLocation | undefined>();
  const [saving, setSaving] = useState(false);
  const [pageDate, setPageDate] = useState(() => dateFromDayKey(dayKey ?? toDayKey(new Date())));
  const canSave = Boolean(voice) && !saving;

  const onSave = async () => {
    if (!voice || !canSave) {
      return;
    }
    setSaving(true);
    await createEntry({
      kind: 'voice',
      title,
      body: '',
      mood,
      moodNote,
      tags,
      voiceUri: voice.uri,
      voiceDurationMs: voice.durationMs,
      createdAt: journalCreatedAtFromDate(pageDate),
      location,
    });
    await hapticSuccess();
    leaveScreen(router);
  };

  return (
    <>
      <ScreenHeader
        title={t('compose.voiceJournal')}
        trailingIcon="checkmark"
        trailingLabel={saving ? t('compose.keeping') : t('common.keep')}
        onTrailing={() => void onSave()}
        trailingDisabled={!canSave}
      />
      <KeyboardDismissScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
      <DateField label={t('compose.pageDay')} value={pageDate} onChange={setPageDate} />
      <VoiceCapture value={voice} onChange={setVoice} heading={t('compose.recording')} />
      <MoodPicker value={mood} onChange={setMood} />
      <MoodNoteField value={moodNote} onChange={setMoodNote} />
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={t('compose.voiceTitlePlaceholder')}
        placeholderTextColor={colors.faint}
        maxLength={AppConfig.writing.maxTitleLength}
        style={[styles.titleInput, { color: colors.ink }]}
      />
      <TagChips value={tags} onChange={setTags} />
      <LocationField value={location} onChange={setLocation} />
      <PrimaryButton
        icon="checkmark-circle-outline"
        label={saving ? t('compose.keeping') : t('compose.keepVoice')}
        onPress={() => void onSave()}
        disabled={!canSave}
      />
      </KeyboardDismissScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  choice: { paddingHorizontal: 22, gap: 16 },
  choiceCard: { padding: 20, gap: 8 },
  choiceTitle: { fontFamily: fonts.bodySemi, fontSize: 22 },
  choiceBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  content: { paddingHorizontal: 22, gap: 14 },
  titleInput: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34 },
});
