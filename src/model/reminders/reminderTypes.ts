import { createId } from '../../utils/idUtils';

/**
 * Purpose: user-configurable reminder top-level types/categories (You → Reminder types).
 * Inputs: AppSettings.reminderTypes or defaults; add/hide actions from settings UI.
 * Outputs: normalized ConfigurableReminderType lists; active ids for filter / compose chips.
 * Side effects: none — persistence is SettingsController / AsyncStorage.
 * Design decisions: builtins keep stable ids from the category tree so existing reminders stay valid;
 *   custom types store a free-text label (not a translation key); soft-hide (active:false) so
 *   rows never crash; this module does not import categories.ts (avoids a cycle).
 */

/** Ionicons outline names offered when she adds a custom reminder type. */
export const REMINDER_TYPE_ICON_PALETTE = [
  'star-outline',
  'bookmark-outline',
  'notifications-outline',
  'gift-outline',
  'home-outline',
  'people-outline',
  'briefcase-outline',
  'school-outline',
  'fitness-outline',
  'medkit-outline',
  'heart-outline',
  'leaf-outline',
  'paw-outline',
  'car-outline',
  'airplane-outline',
  'cafe-outline',
  'musical-notes-outline',
  'basketball-outline',
  'wallet-outline',
  'card-outline',
  'receipt-outline',
  'cash-outline',
  'trending-up-outline',
  'bed-outline',
  'person-outline',
  'ellipsis-horizontal-outline',
] as const;

export type ReminderTypeIconName = (typeof REMINDER_TYPE_ICON_PALETTE)[number];

export interface ConfigurableReminderType {
  id: string;
  /**
   * Custom display name she typed. Builtins omit this and use i18n `types.{id}`.
   */
  label?: string;
  /** Ionicons outline name from REMINDER_TYPE_ICON_PALETTE (or a known builtin map). */
  icon: ReminderTypeIconName;
  /** When false, hidden from pickers/filters; still resolvable for old reminders. */
  active: boolean;
  /** Built-in catalog row — hide instead of hard-delete; label comes from i18n. */
  builtin?: boolean;
}

const BUILTIN_DEFAULTS: ReadonlyArray<{ id: string; icon: ReminderTypeIconName }> = [
  { id: 'financial', icon: 'wallet-outline' },
  { id: 'health', icon: 'heart-outline' },
  { id: 'household', icon: 'bed-outline' },
  { id: 'family', icon: 'people-outline' },
  { id: 'vehicle', icon: 'car-outline' },
  { id: 'work', icon: 'briefcase-outline' },
  { id: 'personal', icon: 'person-outline' },
  { id: 'other', icon: 'ellipsis-horizontal-outline' },
];

/**
 * Purpose: default top-level reminder types matching the shipped category tree tops.
 * Inputs: none.
 * Outputs: Financial / Health / Household / Family / Vehicle / Work / Personal / Other (all on).
 * Side effects: none.
 */
export const DEFAULT_REMINDER_TYPES: ConfigurableReminderType[] = BUILTIN_DEFAULTS.map((row) => ({
  id: row.id,
  icon: row.icon,
  active: true,
  builtin: true,
}));

const ICON_SET = new Set<string>(REMINDER_TYPE_ICON_PALETTE);

/**
 * Purpose: coerce a stored icon string to a known palette / builtin glyph.
 * Inputs: raw icon from AsyncStorage / backup.
 * Outputs: ReminderTypeIconName (fallback ellipsis).
 * Side effects: none.
 */
export function normalizeReminderTypeIcon(
  raw: unknown,
  fallback: ReminderTypeIconName = 'ellipsis-horizontal-outline',
): ReminderTypeIconName {
  if (typeof raw === 'string' && ICON_SET.has(raw)) {
    return raw as ReminderTypeIconName;
  }
  return fallback;
}

/**
 * Purpose: sanitize one persisted reminder-type row.
 * Inputs: unknown JSON object.
 * Outputs: ConfigurableReminderType or null when unusable.
 * Side effects: none.
 */
export function normalizeReminderTypeRow(raw: unknown): ConfigurableReminderType | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== 'string' || !value.id.trim()) {
    return null;
  }
  const id = value.id.trim();
  const builtinDefault = BUILTIN_DEFAULTS.find((row) => row.id === id);
  const builtin = value.builtin === true || Boolean(builtinDefault);
  const custom = !builtin;
  const label =
    custom && typeof value.label === 'string' && value.label.trim()
      ? value.label.trim().slice(0, 40)
      : undefined;
  if (custom && !label) {
    return null;
  }
  const active =
    id === 'other' ? true : value.active !== false && value.enabled !== false;
  return {
    id,
    ...(label ? { label } : {}),
    icon: normalizeReminderTypeIcon(value.icon, builtinDefault?.icon ?? 'ellipsis-horizontal-outline'),
    active,
    ...(builtin ? { builtin: true } : {}),
  };
}

/**
 * Purpose: hydrate reminder types from settings (missing = defaults for older installs).
 * Inputs: optional stored array.
 * Outputs: normalized list; empty / junk storage falls back to defaults so chips never vanish.
 * Side effects: none.
 */
export function resolveReminderTypes(
  settings: { reminderTypes?: ConfigurableReminderType[] } | null | undefined,
): ConfigurableReminderType[] {
  const stored = settings?.reminderTypes;
  if (!stored || stored.length === 0) {
    return DEFAULT_REMINDER_TYPES.map((row) => ({ ...row }));
  }
  const normalized = stored
    .map(normalizeReminderTypeRow)
    .filter((row): row is ConfigurableReminderType => row != null);
  if (normalized.length === 0) {
    return DEFAULT_REMINDER_TYPES.map((row) => ({ ...row }));
  }
  const seen = new Set(normalized.map((row) => row.id));
  const missingBuiltins = DEFAULT_REMINDER_TYPES.filter((row) => !seen.has(row.id));
  const merged = [...normalized, ...missingBuiltins];
  const other = merged.find((row) => row.id === 'other');
  const withoutOther = merged.filter((row) => row.id !== 'other');
  if (!other) {
    return [...withoutOther, { id: 'other', icon: 'ellipsis-horizontal-outline', active: true, builtin: true }];
  }
  return [...withoutOther, { ...other, active: true, builtin: true }];
}

/**
 * Purpose: types shown on filter chips and the compose Group picker.
 * Inputs: resolved reminder types.
 * Outputs: active rows only, in saved order.
 * Side effects: none.
 */
export function activeReminderTypes(types: ConfigurableReminderType[]): ConfigurableReminderType[] {
  return types.filter((row) => row.active);
}

/**
 * Purpose: look up a configured type by id (including inactive).
 * Inputs: resolved list and id.
 * Outputs: row or undefined.
 * Side effects: none.
 */
export function findReminderTypeConfig(
  types: ConfigurableReminderType[],
  id: string | undefined,
): ConfigurableReminderType | undefined {
  if (!id) {
    return undefined;
  }
  return types.find((row) => row.id === id);
}

/**
 * Purpose: English / stored label for a custom type id when i18n is unavailable.
 * Inputs: id and optional configured types.
 * Outputs: custom label or undefined.
 * Side effects: none.
 */
export function reminderTypeCustomLabel(
  id: string,
  types?: ConfigurableReminderType[],
): string | undefined {
  return types ? findReminderTypeConfig(types, id)?.label : undefined;
}

/**
 * Purpose: icon for a reminder top id from configuration.
 * Inputs: id and resolved types.
 * Outputs: configured icon or undefined (caller falls back to typeIcons map).
 * Side effects: none.
 */
export function reminderTypeConfiguredIcon(
  id: string | undefined,
  types?: ConfigurableReminderType[],
): ReminderTypeIconName | undefined {
  if (!id || !types) {
    return undefined;
  }
  return findReminderTypeConfig(types, id)?.icon;
}

/**
 * Purpose: add a custom reminder type (kept before Other).
 * Inputs: current list, display label, icon.
 * Outputs: next list with the new type appended before Other.
 * Side effects: none.
 */
export function addCustomReminderType(
  current: ConfigurableReminderType[],
  label: string,
  icon: ReminderTypeIconName,
): ConfigurableReminderType[] {
  const trimmed = label.trim().slice(0, 40);
  if (!trimmed) {
    return current;
  }
  const resolved = resolveReminderTypes({ reminderTypes: current });
  const withoutOther = resolved.filter((row) => row.id !== 'other');
  const other = resolved.find((row) => row.id === 'other') ?? {
    id: 'other',
    icon: 'ellipsis-horizontal-outline' as const,
    active: true,
    builtin: true,
  };
  return [
    ...withoutOther,
    {
      id: `custom-${createId()}`,
      label: trimmed,
      icon: normalizeReminderTypeIcon(icon),
      active: true,
    },
    { ...other, active: true, builtin: true },
  ];
}

/**
 * Purpose: soft-hide a type, or hard-remove a custom row.
 * Inputs: current list, id; hardRemove for custom delete.
 * Outputs: updated list; never removes or hides `other`.
 * Side effects: none.
 * Design decisions: reminders that still store a removed top id keep working via fallbacks.
 */
export function removeReminderType(
  current: ConfigurableReminderType[],
  id: string,
  hardRemove = false,
): ConfigurableReminderType[] {
  if (id === 'other') {
    return current;
  }
  const next = resolveReminderTypes({ reminderTypes: current });
  if (hardRemove) {
    return next.filter((row) => row.id !== id);
  }
  return next.map((row) => (row.id === id ? { ...row, active: false } : row));
}

/**
 * Purpose: toggle whether a type appears in pickers/filters.
 * Inputs: current list, id, active flag.
 * Outputs: updated list (`other` always stays active).
 * Side effects: none.
 */
export function setReminderTypeActive(
  current: ConfigurableReminderType[],
  id: string,
  active: boolean,
): ConfigurableReminderType[] {
  if (id === 'other' && !active) {
    return current;
  }
  return resolveReminderTypes({ reminderTypes: current }).map((row) =>
    row.id === id ? { ...row, active } : row,
  );
}

/**
 * Purpose: reset catalog to shipping defaults.
 * Inputs: none.
 * Outputs: fresh DEFAULT_REMINDER_TYPES copy.
 * Side effects: none.
 */
export function resetReminderTypes(): ConfigurableReminderType[] {
  return DEFAULT_REMINDER_TYPES.map((row) => ({ ...row }));
}
