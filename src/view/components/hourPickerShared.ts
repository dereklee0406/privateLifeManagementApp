import type { ReactNode } from 'react';
import type { ClockHourFormat } from '../../model/settings/AppSettings';

export const WHEEL_ITEM_HEIGHT = 44;
export const WHEEL_VISIBLE_COUNT = 3;
export const HOUR_ITEM_HEIGHT = WHEEL_ITEM_HEIGHT;
export const HOUR_VISIBLE_COUNT = WHEEL_VISIBLE_COUNT;
export const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
export const MINUTES = Array.from({ length: 60 }, (_, minute) => minute);

export type WheelKind = 'hour' | 'minute';

export interface HourPickerProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Optional control beside the HOUR label (ping enable switch). */
  headerRight?: ReactNode;
  /** Hour (0–23, Customize 12h/24h labels) or minute (00–59, always digits). */
  kind?: WheelKind;
}

/**
 * Purpose: keep clock hours in 0–23.
 * Inputs: raw number from scroll offset or a form.
 * Outputs: integer hour, or 0 if not finite.
 * Side effects: none.
 * Design decisions: matches existing 24h stepper values (e.g. 10), not 1–12 AM/PM.
 */
export function clampHour(value: number): number {
  return clampWheelValue('hour', value);
}

/**
 * Purpose: keep minutes in 00–59.
 * Inputs: raw number from scroll offset or a form.
 * Outputs: integer minute, or 0 if not finite.
 * Side effects: none.
 */
export function clampMinute(value: number): number {
  return clampWheelValue('minute', value);
}

/**
 * Purpose: clamp a snap-wheel value to its legal range.
 * Inputs: hour (0–23) or minute (0–59) kind and a raw number.
 * Outputs: integer in range, or 0 if not finite.
 * Side effects: none.
 */
export function clampWheelValue(kind: WheelKind, value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const max = kind === 'minute' ? 59 : 23;
  return Math.min(max, Math.max(0, Math.round(value)));
}

/**
 * Purpose: 0–23 or 00–59 items for the snap well.
 * Inputs: wheel kind.
 * Outputs: integer array used by native and web lists.
 * Side effects: none.
 */
export function wheelItems(kind: WheelKind): number[] {
  return kind === 'minute' ? MINUTES : HOURS;
}

/**
 * Purpose: hour label on the wheel — 00–23 or 12 AM–11 PM.
 * Inputs: hour 0–23 and clock format.
 * Outputs: display string. Stored value stays 0–23.
 * Side effects: none.
 */
export function formatHourWheelLabel(hour: number, format: ClockHourFormat = '24h'): string {
  const safe = clampHour(hour);
  if (format === '24h') {
    return String(safe).padStart(2, '0');
  }
  const period = safe < 12 ? 'AM' : 'PM';
  const twelve = safe % 12 === 0 ? 12 : safe % 12;
  return `${twelve} ${period}`;
}

/**
 * Purpose: label a snap-wheel row.
 * Inputs: kind, stored value, Customize clock (hour wheel only).
 * Outputs: 12h/24h hour text, or zero-padded minutes.
 * Side effects: none.
 * Design decisions: minutes never follow 12h — they stay 00–59.
 */
export function formatWheelLabel(kind: WheelKind, value: number, format: ClockHourFormat = '24h'): string {
  if (kind === 'minute') {
    return String(clampMinute(value)).padStart(2, '0');
  }
  return formatHourWheelLabel(value, format);
}

/**
 * Purpose: content offset that centers `hour` in a 3-row well.
 * Inputs: hour 0–23.
 * Outputs: y in px (item height × hour).
 * Side effects: none.
 */
export function hourScrollOffset(hour: number): number {
  return wheelScrollOffset('hour', hour);
}

/**
 * Purpose: content offset that centers a wheel value in a 3-row well.
 * Inputs: kind and stored value.
 * Outputs: y in px.
 * Side effects: none.
 */
export function wheelScrollOffset(kind: WheelKind, value: number): number {
  return clampWheelValue(kind, value) * WHEEL_ITEM_HEIGHT;
}

/**
 * Purpose: map a snap scroll position back to 0–23.
 * Inputs: contentOffset.y / scrollTop.
 * Outputs: hour.
 * Side effects: none.
 */
export function hourFromOffset(offsetY: number): number {
  return wheelValueFromOffset('hour', offsetY);
}

/**
 * Purpose: map a snap scroll position back to the wheel value.
 * Inputs: kind and contentOffset.y / scrollTop.
 * Outputs: hour 0–23 or minute 0–59.
 * Side effects: none.
 */
export function wheelValueFromOffset(kind: WheelKind, offsetY: number): number {
  return clampWheelValue(kind, offsetY / WHEEL_ITEM_HEIGHT);
}
