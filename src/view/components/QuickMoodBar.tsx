import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useJournal } from '../../controller/JournalProvider';
import { entriesOnDay } from '../../model/journal/journalCalendar';
import { getMoodDefinition, type MoodId } from '../../model/journal/Mood';
import { AppConfig } from '../../config/appConfig';
import { toDayKey } from '../../utils/dateUtils';
import { appHref } from '../../utils/navigation';
import { hapticLight, hapticSuccess } from '../../utils/haptics';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface, raisedSurface } from '../theme/tokens';
import { GlassSurface } from './GlassSurface';

interface QuickMoodOption {
  key: string;
  mood: MoodId;
  labelKey: 'home.moodGood' | 'home.moodSteady' | 'home.moodOff' | 'home.moodRough';
  emoji: string;
}

/** Four-slot Home check-in mapped 1:1 onto MoodId. */
const QUICK_MOODS: readonly QuickMoodOption[] = [
  { key: 'good', mood: 'happy', labelKey: 'home.moodGood', emoji: '😊' },
  { key: 'steady', mood: 'neutral', labelKey: 'home.moodSteady', emoji: '😐' },
  { key: 'off', mood: 'sad', labelKey: 'home.moodOff', emoji: '😔' },
  { key: 'rough', mood: 'angry', labelKey: 'home.moodRough', emoji: '😡' },
] as const;

/**
 * Purpose: 2-second inline mood check-in on Today Home (no full compose navigation).
 * Inputs: journal entries + createEntry / updateEntry.
 * Outputs: 4-slot segmented bar, optional one-line note, or today’s mood summary with edit.
 * Side effects: persists a mood page (mood + moodNote); haptic on save.
 * Design decisions: View maps Good / Steady / Off / Rough onto MoodId; Model still requires moodNote for empty-body saves.
 */
export function QuickMoodBar() {
  const colors = useThemeColors();
  const router = useRouter();
  const { t } = useI18n();
  const { entries, createEntry, updateEntry } = useJournal();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const now = useMemo(() => new Date(), [entries.length]);
  const todayKey = toDayKey(now);
  const todayEntries = useMemo(() => entriesOnDay(entries, todayKey), [entries, todayKey]);
  const todayMoodEntry = useMemo(() => {
    return (
      todayEntries.find((entry) => !entry.body.trim() && (entry.moodNote?.trim() || entry.mood)) ??
      todayEntries[0] ??
      null
    );
  }, [todayEntries]);

  const pending = QUICK_MOODS.find((item) => item.key === pendingKey) ?? null;

  const saveMood = async (
    option: QuickMoodOption,
    moodNote: string,
    options?: { keepPending?: boolean },
  ) => {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      const trimmed = moodNote.trim() || t(option.labelKey);
      if (todayMoodEntry && !todayMoodEntry.body.trim()) {
        await updateEntry(todayMoodEntry.id, { mood: option.mood, moodNote: trimmed });
      } else {
        await createEntry({
          title: '',
          body: '',
          mood: option.mood,
          moodNote: trimmed,
          tags: [],
        });
      }
      await hapticSuccess();
      if (!options?.keepPending) {
        setPendingKey(null);
        setNote('');
      }
    } finally {
      setSaving(false);
    }
  };

  const onPick = (option: QuickMoodOption) => {
    void hapticLight();
    setPendingKey(option.key);
    setNote('');
    void saveMood(option, '', { keepPending: true });
  };

  if (todayMoodEntry && !pendingKey) {
    const def = getMoodDefinition(todayMoodEntry.mood);
    const soft = QUICK_MOODS.find((item) => item.mood === todayMoodEntry.mood);
    const label = soft ? t(soft.labelKey) : t(`mood.${todayMoodEntry.mood}`);
    return (
      <GlassSurface style={styles.card} radius={18}>
        <Text style={[styles.kicker, { color: colors.accent }]}>{t('home.moodToday')}</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryEmoji}>{soft?.emoji ?? def.emoji}</Text>
          <View style={styles.summaryCopy}>
            <Text style={[styles.summaryTitle, { color: colors.ink }]} numberOfLines={1}>
              {label}
            </Text>
            {todayMoodEntry.moodNote ? (
              <Text style={[styles.summaryNote, { color: colors.muted }]} numberOfLines={1}>
                {todayMoodEntry.moodNote}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => {
              setPendingKey(soft?.key ?? 'steady');
              setNote(todayMoodEntry.moodNote ?? '');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('home.moodEdit')}
            style={styles.editHit}
          >
            <Text style={[styles.edit, { color: colors.accent }]}>{t('home.moodEdit')}</Text>
          </Pressable>
        </View>
      </GlassSurface>
    );
  }

  return (
    <GlassSurface style={styles.card} radius={18}>
      <Text style={[styles.kicker, { color: colors.accent }]}>{t('home.moodCheckIn')}</Text>
      <View style={styles.bar}>
        {QUICK_MOODS.map((option) => {
          const selected = pendingKey === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => onPick(option)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t(option.labelKey)}
              style={styles.slot}
            >
              <View
                style={[
                  styles.orb,
                  selected ? raisedSurface(colors, 20) : insetSurface(colors, 20),
                  {
                    backgroundColor: selected ? colors.mood[option.mood] : colors.well,
                    borderWidth: selected ? 1.5 : 0,
                    borderColor: selected ? colors.accent : 'transparent',
                  },
                ]}
              >
                <Text style={styles.emoji}>{option.emoji}</Text>
              </View>
              <Text
                style={[styles.slotLabel, { color: selected ? colors.ink : colors.faint }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {t(option.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {pending ? (
        <View style={styles.noteBlock}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('home.moodNotePlaceholder')}
            placeholderTextColor={colors.faint}
            maxLength={AppConfig.writing.maxMoodNoteLength}
            style={[insetSurface(colors, 14), styles.note, { color: colors.ink }]}
          />
          <View style={styles.noteActions}>
            <Pressable
              onPress={() => {
                setPendingKey(null);
                setNote('');
              }}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={[styles.actionMuted, { color: colors.muted }]}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => void saveMood(pending, note)}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={t('home.moodSave')}
            >
              <Text style={[styles.actionAccent, { color: colors.accent }]}>
                {saving ? t('common.saving') : t('home.moodSave')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(appHref('/compose?mode=text'))}
              accessibilityRole="button"
              accessibilityLabel={t('home.writeToday')}
            >
              <Text style={[styles.actionMuted, { color: colors.faint }]}>{t('common.write')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 10,
    marginBottom: 14,
  },
  kicker: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  slot: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 6,
  },
  orb: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 20,
  },
  slotLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
  },
  noteBlock: {
    gap: 8,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  noteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
    minHeight: 40,
  },
  actionAccent: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
  },
  actionMuted: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryEmoji: {
    fontSize: 28,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  summaryTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    lineHeight: 20,
  },
  summaryNote: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 18,
  },
  editHit: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  edit: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
  },
});
