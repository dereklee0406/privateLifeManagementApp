import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appHref } from '../../utils/navigation';
import { hapticLight } from '../../utils/haptics';
import { HubSegmentControl, type HubSegmentOption } from '../components/HubSegmentControl';
import { LargeTitle } from '../components/LargeTitle';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { raisedSurface } from '../theme/tokens';
import { tabScenePaddingBottom, type } from '../theme/typography';
import { RhythmStreaksPanel } from './rhythm/RhythmStreaksPanel';
import { RhythmTasksPanel } from './rhythm/RhythmTasksPanel';

export type RhythmSegment = 'tasks' | 'streaks';

/**
 * Purpose: Tab 3 Habits & Rhythm hub — Due & Tasks + Consistency heatmap in one place.
 * Inputs: optional `tab` search param (`tasks` | `streaks`) for deep links from `/habits`.
 * Outputs: editorial header, HubSegmentControl, active panel only.
 * Side effects: navigation to create reminder; segment haptic via HubSegmentControl.
 * Design decisions: thin View orchestration; list/heatmap logic lives in panel components;
 *   shared HubSegmentControl matches Money / Journal tactile pattern (100% visual consistency).
 *   Journal owns Calendar companion (Timeline / Calendar). This screen owns Tab 3 landing.
 */
export function RhythmScreen({
  initialSegment = 'tasks',
}: {
  initialSegment?: RhythmSegment;
}) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();

  const paramSegment: RhythmSegment | null =
    params.tab === 'streaks' ? 'streaks' : params.tab === 'tasks' ? 'tasks' : null;

  const [segment, setSegment] = useState<RhythmSegment>(paramSegment ?? initialSegment);

  useEffect(() => {
    if (paramSegment) {
      setSegment(paramSegment);
    }
  }, [paramSegment]);

  const segmentOptions = useMemo<HubSegmentOption<RhythmSegment>[]>(
    () => [
      { id: 'tasks', label: t('rhythm.tabTasks'), icon: 'checkbox-outline' },
      { id: 'streaks', label: t('rhythm.tabStreaks'), icon: 'flame-outline' },
    ],
    [t],
  );

  return (
    <ScreenScaffold>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: tabScenePaddingBottom(insets.bottom) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            <Text style={[type.footnote, styles.headerKicker, { color: colors.accent }]}>
              {t('rhythm.headerKicker')}
            </Text>
            <LargeTitle title={t('rhythm.headerTitle')} />
          </View>
          <Pressable
            onPress={() => {
              void hapticLight();
              router.push(appHref('/reminders/new'));
            }}
            style={({ pressed }) => [
              raisedSurface(colors, 14),
              styles.addButton,
              {
                transform: [{ scale: pressed ? 0.94 : 1 }],
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('common.add')}
          >
            <Ionicons name="add" size={22} color={colors.ink} accessible={false} importantForAccessibility="no" />
          </Pressable>
        </View>

        <HubSegmentControl options={segmentOptions} value={segment} onChange={setSegment} />

        {segment === 'tasks' ? <RhythmTasksPanel /> : <RhythmStreaksPanel />}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerKicker: {
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
