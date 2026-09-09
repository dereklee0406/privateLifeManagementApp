import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMoodDefinition } from '../../model/journal/Mood';
import { clampPhotoIndex, stepPhotoIndex, type PhotoMemory } from '../../model/journal/photoMemories';
import { formatMemoryDate } from '../../utils/dateUtils';
import { hapticLight } from '../../utils/haptics';
import { useReduceMotion } from '../../utils/reduceMotion';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { type } from '../theme/typography';
import { BackButton } from './BackButton';
import { JournalMediaImage } from './JournalMediaImage';
import { TextButton } from './TextButton';

interface PhotoReelViewerProps {
  photos: PhotoMemory[];
  startIndex: number;
  onClose: () => void;
  onOpenPage: (entryId: string) => void;
}

const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

/**
 * Purpose: one-line reel caption from the page date, mood, and optional mood note.
 * Inputs: photo memory, Intl locale, translated mood label.
 * Outputs: e.g. "Sep 8, 2026 · 😊 Happy" or with her mood note.
 * Side effects: none.
 * Design decisions: date first; every page has a mood so it always shows; a note replaces the generic label.
 */
function formatPhotoReelCaption(photo: PhotoMemory, intlLocale: string, moodLabel: string): string {
  const date = formatMemoryDate(photo.createdAt, intlLocale);
  const emoji = getMoodDefinition(photo.mood).emoji;
  const note = photo.moodNote?.trim();
  if (note) {
    return `${date} · ${emoji} ${note}`;
  }
  return `${date} · ${emoji} ${moodLabel}`;
}

/**
 * Purpose: full-screen private viewer of her journal photos (Stories/Reels *chrome*, not a social feed).
 * Inputs: newest-first photos, opening index, close / open-page handlers.
 * Outputs: vertical snap paging, or a crossfade when Reduce Motion is on; large prev/next taps.
 * Side effects: Android hardware back closes the viewer; light haptic on tap-advance.
 * Design decisions: photos-only; no share, comments, follow, or loop; contain (not crop) so the picture stays hers.
 */
export function PhotoReelViewer({ photos, startIndex, onClose, onOpenPage }: PhotoReelViewerProps) {
  const { t, intlLocale } = useI18n();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const listRef = useRef<FlatList<PhotoMemory>>(null);
  const incomingOpacity = useRef(new Animated.Value(1)).current;
  const [index, setIndex] = useState(() => clampPhotoIndex(startIndex, photos.length));
  const [pageHeight, setPageHeight] = useState(0);
  const [incoming, setIncoming] = useState<PhotoMemory | null>(null);
  const indexRef = useRef(index);
  indexRef.current = index;

  const current = photos[index];

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  useEffect(() => {
    if (reduceMotion || pageHeight <= 0) {
      return;
    }
    listRef.current?.scrollToIndex({ index: indexRef.current, animated: false });
  }, [pageHeight, reduceMotion]);

  const goTo = useCallback(
    (next: number, fromTap: boolean) => {
      if (next === indexRef.current || photos.length === 0) {
        return;
      }
      if (fromTap) {
        void hapticLight();
      }
      if (reduceMotion) {
        const nextPhoto = photos[next];
        if (!nextPhoto) {
          return;
        }
        setIncoming(nextPhoto);
        incomingOpacity.setValue(0);
        Animated.timing(incomingOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start(({ finished }) => {
          if (!finished) {
            return;
          }
          setIndex(next);
          setIncoming(null);
          incomingOpacity.setValue(1);
        });
        return;
      }
      setIndex(next);
      if (pageHeight > 0) {
        listRef.current?.scrollToIndex({ index: next, animated: true });
      }
    },
    [incomingOpacity, pageHeight, photos, reduceMotion],
  );

  const goDelta = useCallback(
    (delta: 1 | -1) => {
      goTo(stepPhotoIndex(indexRef.current, photos.length, delta), true);
    },
    [goTo, photos.length],
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (typeof first?.index === 'number') {
      setIndex(first.index);
    }
  }).current;

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageHeight <= 0) {
        return;
      }
      const next = Math.round(event.nativeEvent.contentOffset.y / pageHeight);
      setIndex(clampPhotoIndex(next, photos.length));
    },
    [pageHeight, photos.length],
  );

  if (!current) {
    return null;
  }

  const shown = incoming ?? current;
  const caption = formatPhotoReelCaption(shown, intlLocale, t(`mood.${shown.mood}`));

  return (
    <View
      style={[styles.root, { backgroundColor: colors.paper }]}
      onLayout={(event) => {
        const height = event.nativeEvent.layout.height;
        if (height > 0 && height !== pageHeight) {
          setPageHeight(height);
        }
      }}
      accessibilityViewIsModal
      accessibilityLabel={t('photos.reelA11y')}
    >
      {reduceMotion || pageHeight <= 0 ? (
        <View style={styles.stage}>
          <View style={styles.layer}>
            <JournalMediaImage uri={current.uri} resizeMode="contain" style={styles.photo} />
          </View>
          {incoming ? (
            <Animated.View style={[styles.layer, { opacity: incomingOpacity }]}>
              <JournalMediaImage uri={incoming.uri} resizeMode="contain" style={styles.photo} />
            </Animated.View>
          ) : null}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={photos}
          keyExtractor={(item, itemIndex) => `${item.entryId}-${item.uri}-${itemIndex}`}
          pagingEnabled
          disableIntervalMomentum
          snapToInterval={pageHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          initialScrollIndex={clampPhotoIndex(startIndex, photos.length)}
          getItemLayout={(_, itemIndex) => ({
            length: pageHeight,
            offset: pageHeight * itemIndex,
            index: itemIndex,
          })}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY}
          renderItem={({ item }) => (
            <View style={{ height: pageHeight, width: '100%' }}>
              <JournalMediaImage uri={item.uri} resizeMode="contain" style={styles.photo} />
            </View>
          )}
        />
      )}

      <View
        style={[styles.taps, { top: insets.top + 52, bottom: insets.bottom + 96 }]}
        pointerEvents="box-none"
      >
        <Pressable
          style={styles.tapPrev}
          onPress={() => goDelta(-1)}
          accessibilityRole="button"
          accessibilityLabel={t('photos.previous')}
        />
        <Pressable
          style={styles.tapNext}
          onPress={() => goDelta(1)}
          accessibilityRole="button"
          accessibilityLabel={t('photos.next')}
        />
      </View>

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <BackButton onPress={onClose} />
        <Text style={[type.subhead, styles.progress, { color: colors.muted }]}>
          {t('photos.progress', { current: index + 1, total: photos.length })}
        </Text>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <Text style={[type.headline, { color: colors.ink }]} numberOfLines={3}>
          {caption}
        </Text>
        <TextButton label={t('photos.openPage')} onPress={() => onOpenPage(shown.entryId)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },
  stage: {
    flex: 1,
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  photo: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  taps: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
  },
  tapPrev: {
    flex: 0.35,
    minWidth: 44,
  },
  tapNext: {
    flex: 0.65,
    minWidth: 44,
  },
  top: {
    position: 'absolute',
    left: 22,
    right: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progress: {
    marginLeft: 12,
  },
  bottom: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 0,
    gap: 4,
    alignItems: 'flex-start',
  },
});
