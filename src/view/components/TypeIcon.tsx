import { Ionicons } from '@expo/vector-icons';
import type { ConfigurableReminderType } from '../../model/reminders/reminderTypes';
import { useThemeColors } from '../theme/ThemeProvider';
import {
  iconForReminderType,
  iconForType,
  TYPE_ICON_SIZE,
  type TypeIconName,
} from '../icons/typeIcons';

interface TypeIconProps {
  typeId: string;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
  /** Explicit glyph (e.g. spend catalog). Wins over reminderTypes / typeId map. */
  icon?: TypeIconName;
  /** When set (and icon omitted), resolve custom reminder-type icons from You → Reminder types. */
  reminderTypes?: ConfigurableReminderType[];
}

/**
 * Purpose: SF-like type glyph for spend rows, reminder rows, and calendar markers.
 * Inputs: stored type id, optional explicit icon, optional reminder-types catalog, size/color/a11y.
 * Outputs: 22pt Ionicons outline by default; parent owns the tap target when used in Chip.
 * Side effects: none.
 * Design decisions: presentation-only — ids stay in Model; View maps them to @expo/vector-icons (web-safe).
 */
export function TypeIcon({
  typeId,
  size = TYPE_ICON_SIZE,
  color,
  accessibilityLabel,
  icon,
  reminderTypes,
}: TypeIconProps) {
  const colors = useThemeColors();
  const name =
    icon ??
    (reminderTypes ? iconForReminderType(typeId, reminderTypes) : iconForType(typeId));
  return (
    <Ionicons
      name={name}
      size={size}
      color={color ?? colors.ink}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
