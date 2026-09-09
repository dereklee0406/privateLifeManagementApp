import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { JournalEntry } from '../../model/journal/JournalEntry';
import { getMoodDefinition } from '../../model/journal/Mood';
import { stripMarkdown } from '../../model/journal/markdown';
import { formatRelative } from '../../utils/dateUtils';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, groupedRadius } from '../theme/tokens';
import { type } from '../theme/typography';
import { GlassSurface } from './GlassSurface';
import { JournalMediaImage } from './JournalMediaImage';

interface EntryCardProps {
  entry: JournalEntry;
  onPress: () => void;
  /** When true, skip the outer clay card — parent GroupedSection provides it. */
  grouped?: boolean;
}

/**
 * Purpose: present a journal page as a raised card or an inset grouped row.
 * Inputs: entry, press handler, optional grouped (iOS list).
 * Outputs: tappable summary with mood, preview, tags, optional photo.
 * Side effects: none (navigation is the caller's job).
 */
export function EntryCard({ entry, onPress, grouped }: EntryCardProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const mood = getMoodDefinition(entry.mood);
  const moodKey = `mood.${mood.id}`;
  const moodLabel = t(moodKey);
  const preview = stripMarkdown(entry.body).slice(0, 140);
  const thumb = entry.photoUris[0];

  const inner = (
    <>
      <View style={styles.top}>
        <Text style={styles.emoji}>{mood.emoji}</Text>
        <Text style={[styles.mood, { color: colors.muted }]} numberOfLines={2}>
          {moodLabel !== moodKey ? moodLabel : mood.label}
          {entry.moodNote ? ` · ${entry.moodNote}` : ''}
        </Text>
        {entry.kind === 'voice' ? (
          <Text style={[styles.kind, { color: colors.accent }]}>{t('voice.title')}</Text>
        ) : null}
        <Text style={[styles.meta, { color: colors.faint }]}>{formatRelative(entry.createdAt)}</Text>
      </View>
      <View style={styles.main}>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.ink }]} numberOfLines={2}>
            {entry.title}
          </Text>
          {preview ? (
            <Text style={[styles.body, { color: colors.muted }]} numberOfLines={3}>
              {preview}
            </Text>
          ) : entry.kind === 'voice' ? (
            <Text style={[styles.body, { color: colors.muted }]}>{t('voice.voicePage')}</Text>
          ) : null}
          {entry.tags.length > 0 ? (
            <Text style={[styles.tags, { color: colors.faint }]}>
              {entry.tags.map((tag) => `#${tag}`).join('  ')}
            </Text>
          ) : null}
          {entry.location?.name ? (
            <Text style={[styles.tags, { color: colors.faint }]}>{entry.location.name}</Text>
          ) : null}
        </View>
        {thumb ? <JournalMediaImage uri={thumb} style={styles.thumb} /> : null}
      </View>
    </>
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={entry.title}
      style={grouped ? styles.groupedHit : undefined}
    >
      {grouped ? inner : <GlassSurface style={styles.card} radius={groupedRadius}>{inner}</GlassSurface>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 10,
  },
  groupedHit: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    minHeight: 44,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emoji: {
    fontSize: 18,
  },
  mood: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    minWidth: 0,
  },
  kind: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  meta: {
    ...type.caption,
  },
  main: {
    flexDirection: 'row',
    gap: 12,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  title: {
    ...type.headline,
  },
  body: {
    ...type.subhead,
  },
  tags: {
    ...type.caption,
    fontWeight: '500',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
});
