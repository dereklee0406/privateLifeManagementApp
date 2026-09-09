import { createElement, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
 * Purpose: girlfriend-simple hour or minute list on web — scroll or tap, no native picker import.
 * Inputs: label, value, onChange, optional headerRight, kind (hour 0–23 or minute 00–59).
 * Outputs: neumorph inset well wrapping a snapping overflow list.
 * Side effects: onChange when she scrolls or clicks a row.
 * Design decisions: HTML overflow list (not input type=time) so Metro never pulls a native
 *   module into this file. Hour labels follow Customize 12h/24h; minutes stay 00–59.
 */
export function HourPicker({ label, value, onChange, headerRight, kind = 'hour' }: HourPickerProps) {
  const colors = useThemeColors();
  const { settings } = useSettings();
  const clock = resolveClockHourFormat(settings);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const items = wheelItems(kind);
  const selected = clampWheelValue(kind, value);
  const wellHeight = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_COUNT;
  const pad = WHEEL_ITEM_HEIGHT;
  const max = kind === 'minute' ? 59 : 23;

  useLayoutEffect(() => {
    const node = scrollerRef.current;
    if (!node) {
      return;
    }
    const expected = wheelScrollOffset(kind, selected);
    if (Math.abs(node.scrollTop - expected) > WHEEL_ITEM_HEIGHT / 2) {
      node.scrollTop = expected;
    }
  }, [kind, selected]);

  const listStyle: CSSProperties = {
    height: wellHeight,
    overflowY: 'auto',
    scrollSnapType: 'y mandatory',
    scrollbarWidth: 'none',
    WebkitOverflowScrolling: 'touch',
  };

  const spacerStyle: CSSProperties = { height: pad, flexShrink: 0 };
  const itemStyle = (isSelected: boolean): CSSProperties => ({
    height: WHEEL_ITEM_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    scrollSnapAlign: 'center',
    cursor: 'pointer',
    fontFamily: fonts.display,
    fontSize: isSelected ? 22 : 18,
    lineHeight: isSelected ? '28px' : '24px',
    color: isSelected ? colors.ink : colors.muted,
    userSelect: 'none',
    textAlign: 'center',
    paddingLeft: 4,
    paddingRight: 4,
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.faint }]}>{label}</Text>
        {headerRight}
      </View>
      <View style={[insetSurface(colors, 16), styles.well, { height: wellHeight }]}>
        {createElement(
          'div',
          {
            ref: scrollerRef,
            role: 'listbox',
            'aria-label': label,
            'aria-valuemin': 0,
            'aria-valuemax': max,
            'aria-valuenow': selected,
            onScroll: (event: { currentTarget: { scrollTop: number } }) => {
              const top = event.currentTarget.scrollTop;
              if (settleTimer.current) {
                clearTimeout(settleTimer.current);
              }
              settleTimer.current = setTimeout(() => {
                const next = wheelValueFromOffset(kind, top);
                onChange(next);
                if (scrollerRef.current) {
                  scrollerRef.current.scrollTop = wheelScrollOffset(kind, next);
                }
              }, 80);
            },
            style: listStyle,
          },
          createElement('div', { style: spacerStyle, 'aria-hidden': true }),
          ...items.map((item) => {
            const isSelected = item === selected;
            return createElement(
              'div',
              {
                key: item,
                role: 'option',
                'aria-selected': isSelected,
                onClick: () => onChange(item),
                style: itemStyle(isSelected),
              },
              formatWheelLabel(kind, item, clock),
            );
          }),
          createElement('div', { style: spacerStyle, 'aria-hidden': true }),
        )}
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
});
