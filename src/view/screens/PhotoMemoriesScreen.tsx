import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useJournal } from '../../controller/JournalProvider';
import {
  collectJournalPhotos,
  filterJournalPhotos,
  groupPhotosByMonth,
  type PhotoMemoryFilter,
} from '../../model/journal/photoMemories';
import { hapticLight } from '../../utils/haptics';
import { useI18n } from '../i18n';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { JournalMediaImage } from '../components/JournalMediaImage';
import { PhotoReelViewer } from '../components/PhotoReelViewer';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenScaffold } from '../components/ScreenScaffold';
import type { TypeIconName } from '../icons/typeIcons';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

const FILTERS: { id: PhotoMemoryFilter; icon: TypeIconName }[] = [
  { id: 'all', icon: 'images-outline' },
  { id: 'month', icon: 'calendar-outline' },
  { id: 'year', icon: 'time-outline' },
];

/**
 * Purpose: photos already on journal pages, grouped by month, plus a private full-screen reel.
 * Inputs: journal entries.
 * Outputs: month grid; tap opens her photo reel (not the page). Empty: one sentence + Write today.
 * Side effects: navigation to compose or a page from the reel; haptic on opening the reel.
 * Design decisions: this stays an on-device album. No share sheet, comments, or social feed.
 */
export function PhotoMemoriesScreen() {
  const { t, intlLocale } = useI18n();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { entries } = useJournal();
  const [filter, setFilter] = useState<PhotoMemoryFilter>('all');
  const [reelIndex, setReelIndex] = useState<number | null>(null);
  const photos = useMemo(() => collectJournalPhotos(entries), [entries]);
  const visible = useMemo(() => filterJournalPhotos(photos, filter), [photos, filter]);
  const groups = useMemo(() => groupPhotosByMonth(visible, intlLocale), [visible, intlLocale]);

  /**
   * Purpose: open the private reel on the tapped photo.
   * Inputs: index in the filtered list.
   * Outputs: none.
   * Side effects: haptic; sets reelIndex.
   * Design decisions: skip a miss from indexOf so we never open at -1.
   */
  const openReel = (index: number) => {
    if (index < 0) {
      return;
    }
    void hapticLight();
    setReelIndex(index);
  };

  return (
    <ScreenScaffold>
      <ScreenHeader title={t('photos.title')} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.lede, { color: colors.muted }]}>{t('photos.lede')}</Text>
        {photos.length > 0 ? (
          <View style={styles.filters}>
            {FILTERS.map(({ id, icon }) => (
              <Chip
                key={id}
                icon={icon}
                label={id === 'all' ? t('common.all') : id === 'month' ? t('photos.thisMonth') : t('photos.thisYear')}
                selected={filter === id}
                onPress={() => setFilter(id)}
              />
            ))}
          </View>
        ) : null}
        {visible.length === 0 ? (
          <EmptyState
            message={photos.length === 0 ? t('photos.empty') : t('photos.emptyFilter')}
            actionLabel={photos.length === 0 ? t('home.writeToday') : undefined}
            actionIcon={photos.length === 0 ? 'create-outline' : undefined}
            onAction={photos.length === 0 ? () => router.push('/compose?mode=text') : undefined}
          />
        ) : (
          groups.map((group) => (
            <View key={group.monthKey} style={styles.month}>
              <Text style={[styles.monthLabel, { color: colors.muted }]}>{group.label}</Text>
              <View style={styles.grid}>
                {group.photos.map((item) => {
                  const index = visible.indexOf(item);
                  return (
                    <Pressable
                      key={`${item.entryId}-${item.uri}-${index}`}
                      onPress={() => openReel(index)}
                      style={styles.cell}
                      accessibilityRole="button"
                      accessibilityLabel={item.title}
                    >
                      <JournalMediaImage uri={item.uri} style={styles.thumb} thumbnail />
                      <Text style={[styles.caption, { color: colors.muted }]} numberOfLines={2}>
                        {item.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
      {reelIndex !== null && visible.length > 0 ? (
        <PhotoReelViewer
          photos={visible}
          startIndex={reelIndex}
          onClose={() => setReelIndex(null)}
          onOpenPage={(entryId) => {
            setReelIndex(null);
            router.push(`/entry/${entryId}`);
          }}
        />
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, gap: 12 },
  lede: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%' },
  month: { gap: 10, marginTop: 8 },
  monthLabel: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  cell: { width: '48%', minWidth: 0, maxWidth: '48%', gap: 8 },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: 18 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
});
