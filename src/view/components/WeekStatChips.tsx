import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WeeklyChipCopy } from '../i18n/weekCopy';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, raisedSurface } from '../theme/tokens';

interface WeekStatChipsProps {
  chips: WeeklyChipCopy;
}

type ChipIcon = 'journal-outline' | 'wallet-outline' | 'checkmark-circle-outline';

/**
 * Purpose: four neumorphic This week metric chips for Today Home.
 * Inputs: localized chip copy (pages / mood / spend / reminders).
 * Outputs: 2×2 responsive grid of raised clay chips.
 * Side effects: none.
 * Design decisions: mood shows emoji instead of an Ionicons glyph; dual shadows from raisedSurface.
 */
export function WeekStatChips({ chips }: WeekStatChipsProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.grid}>
      <MetricChip
        icon="journal-outline"
        value={chips.pagesValue}
        caption={chips.pagesCaption}
        accent={colors.accent}
      />
      <MetricChip
        emoji={chips.moodEmoji}
        value={chips.moodValue}
        caption={chips.moodCaption}
        accent={colors.accent}
      />
      <MetricChip
        icon="wallet-outline"
        value={chips.spendValue}
        caption={chips.spendCaption}
        accent={colors.accent}
      />
      <MetricChip
        icon="checkmark-circle-outline"
        value={chips.remindersValue}
        caption={chips.remindersCaption}
        accent={colors.accent}
      />
    </View>
  );
}

function MetricChip({
  icon,
  emoji,
  value,
  caption,
  accent,
}: {
  icon?: ChipIcon;
  emoji?: string;
  value: string;
  caption: string;
  accent: string;
}) {
  const colors = useThemeColors();
  return (
    <View style={[raisedSurface(colors, 18), styles.chip]}>
      {emoji ? (
        <Text style={styles.emoji} accessible={false}>
          {emoji}
        </Text>
      ) : icon ? (
        <Ionicons name={icon} size={18} color={accent} accessible={false} />
      ) : null}
      <Text style={[styles.value, { color: colors.ink }]} numberOfLines={2}>
        {value}
      </Text>
      <Text style={[styles.caption, { color: colors.muted }]} numberOfLines={1}>
        {caption}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    width: '47%',
    flexGrow: 1,
    minWidth: 132,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 4,
    alignItems: 'flex-start',
  },
  emoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  value: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    lineHeight: 20,
    minWidth: 0,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
});
