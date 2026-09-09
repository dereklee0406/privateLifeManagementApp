import { useCallback, useRef } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface } from '../theme/tokens';
import { useSettings } from '../../controller/SettingsProvider';
import { resolveClockHourFormat } from '../../model/settings/AppSettings';
import {
  clampWheelValue,
  formatWheelLabel,
  wheelItems,
  wheelScrollOffset,
  wheelValueFromOffset,
  WHEEL_ITEM_HEIGHT,
  WHEEL_VISIBLE_COUNT,
  type HourPickerProps,
} from './hourPickerShared';

/**
 * Purpose: girlfriend-simple hour or minute wheel on iOS/Android — flick or tap, not +/−.
 * Inputs: label, value, onChange, optional headerRight, kind (hour 0–23 or minute 00–59).
 * Outputs: neumorph inset snap list; selected value centered.
 * Side effects: onChange when the wheel settles or she taps a row.
 * Design decisions: ScrollView snap stays in this native file. Nested in page ScrollViews
 *   with nestedScrollEnabled so the well can be flicked. Hour labels follow Customize 12h/24h;
 *   minutes are always 00–59. Compose lays two equal wheels side by side — no NumberStepper.
 */
export function HourPicker({ label, value, onChange, headerRight, kind = 'hour' }: HourPickerProps) {
  const colors = useThemeColors();
  const { settings } = useSettings();
  const clock = resolveClockHourFormat(settings);
  const scrollRef = useRef<ScrollView>(null);
  const items = wheelItems(kind);
  const selected = clampWheelValue(kind, value);
  const wellHeight = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_COUNT;
  const pad = WHEEL_ITEM_HEIGHT;
  const max = kind === 'minute' ? 59 : 23;

  const syncToValue = useCallback(
    (next: number) => {
      scrollRef.current?.scrollTo({ y: wheelScrollOffset(kind, next), animated: false });
    },
    [kind],
  );

  const settle = (offsetY: number) => {
    const next = wheelValueFromOffset(kind, offsetY);
    if (next !== selected) {
      onChange(next);
    } else {
      syncToValue(next);
    }
  };

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    settle(event.nativeEvent.contentOffset.y);
  };

  const onDragEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const velocity = event.nativeEvent.velocity?.y ?? 0;
    if (Math.abs(velocity) > 0.05) {
      return;
    }
    settle(event.nativeEvent.contentOffset.y);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.faint }]}>{label}</Text>
        {headerRight}
      </View>
      <View style={[insetSurface(colors, 16), styles.well, { height: wellHeight }]}>
        <ScrollView
          ref={scrollRef}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={WHEEL_ITEM_HEIGHT}
          disableIntervalMomentum
          decelerationRate="fast"
          onMomentumScrollEnd={onMomentumEnd}
          onScrollEndDrag={onDragEnd}
          onContentSizeChange={() => syncToValue(selected)}
          contentContainerStyle={{ paddingVertical: pad }}
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min: 0, max, now: selected, text: formatWheelLabel(kind, selected, clock) }}
        >
          {items.map((item) => {
            const isSelected = item === selected;
            return (
              <Pressable
                key={item}
                onPress={() => {
                  onChange(item);
                  syncToValue(item);
                }}
                style={styles.item}
                accessibilityRole="button"
                accessibilityLabel={`${formatWheelLabel(kind, item, clock)}`}
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.itemLabel,
                    { color: isSelected ? colors.ink : colors.muted },
                    isSelected ? styles.itemSelected : null,
                  ]}
                >
                  {formatWheelLabel(kind, item, clock)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 0, width: '100%', gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 28 },
  heading: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  well: { overflow: 'hidden' },
  item: { height: WHEEL_ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  itemLabel: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, textAlign: 'center' },
  itemSelected: { fontSize: 22, lineHeight: 28 },
});
