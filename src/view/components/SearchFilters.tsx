import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { JournalSearchInput, DateRangePreset } from '../../model/journal/journalSearch';
import { MOODS, type MoodId } from '../../model/journal/Mood';
import { SUGGESTED_TAGS } from '../../model/journal/tags';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { chipSurface, fonts, insetSurface } from '../theme/tokens';

const DATE_PRESETS: Array<{ id: DateRangePreset; label: string }> = [
  { id: 'any', label: 'Any date' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'year', label: 'This year' },
];

interface SearchFiltersProps {
  value: JournalSearchInput;
  onChange: (next: JournalSearchInput) => void;
}

/**
 * Purpose: collect search filters; does not filter itself.
 * Inputs: current JournalSearchInput and change handler.
 * Outputs: keyword field, mood chips, tag chips, date-range presets.
 * Side effects: none besides onChange. Filtering runs in Model via the controller.
 */
export function SearchFilters({ value, onChange }: SearchFiltersProps) {
  const colors = useThemeColors();
  const { t } = useI18n();

  const toggleMood = (mood: MoodId) => {
    onChange({ ...value, mood: value.mood === mood ? null : mood });
  };

  const toggleTag = (tag: string) => {
    const tags = value.tags.includes(tag) ? value.tags.filter((item) => item !== tag) : [...value.tags, tag];
    onChange({ ...value, tags });
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        value={value.keywords}
        onChangeText={(keywords) => onChange({ ...value, keywords })}
        placeholder={t('pages.searchPlaceholder')}
        placeholderTextColor={colors.faint}
        style={[insetSurface(colors, 22), styles.search, { color: colors.ink }]}
      />
      <View style={styles.row}>
        {MOODS.map((mood) => {
          const selected = value.mood === mood.id;
          return (
            <Pressable key={mood.id} onPress={() => toggleMood(mood.id)} style={[chipSurface(colors, selected), styles.chip]}>
              <Text style={styles.chipEmoji}>{mood.emoji}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.row}>
        {SUGGESTED_TAGS.map((tag) => {
          const selected = value.tags.includes(tag);
          return (
            <Pressable key={tag} onPress={() => toggleTag(tag)} style={[chipSurface(colors, selected), styles.chip]}>
              <Text style={[styles.chipLabel, { color: selected ? colors.accent : colors.muted }]} numberOfLines={2}>
                #{tag}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.row}>
        {DATE_PRESETS.map((preset) => {
          const selected = value.datePreset === preset.id;
          return (
            <Pressable
              key={preset.id}
              onPress={() => onChange({ ...value, datePreset: preset.id })}
              style={[chipSurface(colors, selected), styles.chip]}
            >
              <Text style={[styles.chipLabel, { color: selected ? colors.accent : colors.muted }]} numberOfLines={2}>
                {preset.id === 'any'
                  ? t('pages.anyDate')
                  : preset.id === '7d'
                    ? t('pages.days7')
                    : preset.id === '30d'
                      ? t('pages.days30')
                      : t('pages.thisYear')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 20 },
  search: {
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    maxWidth: '100%',
  },
  chipEmoji: { fontSize: 16 },
  chipLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, flexShrink: 1 },
});
