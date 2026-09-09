import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SUGGESTED_TAGS } from '../../model/journal/tags';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { chipSurface, fonts, insetSurface } from '../theme/tokens';

interface TagChipsProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Purpose: pick suggested tags and add custom ones as chips.
 * Inputs: selected slugs and change handler.
 * Outputs: chip row plus a custom field.
 * Side effects: none besides onChange.
 */
export function TagChips({ value, onChange }: TagChipsProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const extras = value.filter((tag) => !SUGGESTED_TAGS.includes(tag));

  const toggle = (tag: string) => {
    if (value.includes(tag)) {
      onChange(value.filter((item) => item !== tag));
      return;
    }
    onChange([...value, tag]);
  };

  const addCustom = () => {
    const slug = draft.trim().replace(/^#/, '').toLowerCase();
    setDraft('');
    if (!slug || value.includes(slug)) {
      return;
    }
    onChange([...value, slug]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: colors.faint }]}>{t('compose.tag')}</Text>
      <View style={styles.row}>
        {SUGGESTED_TAGS.map((tag) => {
          const selected = value.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => toggle(tag)}
              style={[chipSurface(colors, selected), styles.chip]}
            >
              <Text style={[styles.chipLabel, { color: selected ? colors.accent : colors.ink }]} numberOfLines={2}>
                #{tag}
              </Text>
            </Pressable>
          );
        })}
        {extras.map((tag) => (
          <Pressable
            key={tag}
            onPress={() => toggle(tag)}
            style={[chipSurface(colors, true), styles.chip]}
          >
            <Text style={[styles.chipLabel, { color: colors.accent }]} numberOfLines={2}>
              #{tag}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={addCustom}
        placeholder={t('compose.addTag')}
        placeholderTextColor={colors.faint}
        autoCapitalize="none"
        style={[insetSurface(colors, 16), styles.input, { color: colors.ink }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  heading: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 0,
    maxWidth: '100%',
  },
  chipLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
