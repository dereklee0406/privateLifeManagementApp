import { Platform, StyleSheet, type TextStyle, ViewStyle } from 'react-native';
import type { MoodId } from '../../model/journal/Mood';
import type { ThemePreference } from '../../model/settings/AppSettings';

/** Clay fill + dual shadow; same object can sit on View or TextInput. */
type ClaySurfaceStyle = Pick<
  ViewStyle & TextStyle,
  'backgroundColor' | 'borderRadius' | 'borderWidth' | 'borderColor' | 'boxShadow'
>;

export type ColorScheme = 'dark' | 'light';
export type ClimateId = 'happy' | 'neutral' | 'stress';

export interface ThemeColors {
  scheme: ColorScheme;
  ink: string;
  paper: string;
  muted: string;
  faint: string;
  line: string;
  glass: string;
  glassBorder: string;
  surface: string;
  well: string;
  washTop: string;
  washBottom: string;
  shadowLight: string;
  shadowDark: string;
  raisedShadow: string;
  insetShadow: string;
  accentRaisedShadow: string;
  /** Hairline + soft glow used by selected chips. */
  accentGlow: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  danger: string;
  mesh: string[];
  mood: Record<MoodId, string>;
  climate: Record<ClimateId, string>;
}

/**
 * Purpose: dark neumorph palette — soft charcoal canvas, dual shadows, clay accent.
 * Design decisions: paper is charcoal, never #000, so highlight + shade can extrude.
 */
export const darkColors: ThemeColors = {
  scheme: 'dark',
  ink: '#E4DDD4',
  paper: '#2C2B28',
  muted: '#A39B92',
  faint: '#8F887F',
  line: '#232220',
  glass: '#2C2B28',
  glassBorder: 'rgba(255, 255, 255, 0.05)',
  surface: '#2C2B28',
  well: '#252422',
  washTop: '#32312E',
  washBottom: '#272624',
  shadowLight: '#3A3936',
  shadowDark: '#1C1B19',
  raisedShadow: '8px 8px 16px #1C1B19, -5px -5px 12px #3A3936',
  insetShadow: 'inset 5px 5px 10px #1C1B19, inset -4px -4px 10px #3A3936',
  accentRaisedShadow: '6px 6px 14px rgba(0,0,0,0.38), -4px -4px 10px rgba(255,210,170,0.16)',
  /** Soft inner glow for selected chips / active filters. */
  accentGlow: 'inset 0 0 0 1.5px rgba(232,176,134,0.55), 0 0 10px rgba(232,176,134,0.18)',
  accent: '#E8B086',
  accentInk: '#2A1E16',
  accentSoft: 'rgba(232,176,134,0.18)',
  danger: '#E8A8A4',
  mesh: ['#32312E', '#2C2B28', '#272624', '#2E2C2A', '#2C2B28', '#2A2926', '#32302C', '#2C2B28', '#262524'],
  mood: {
    happy: '#E8C48A',
    neutral: '#7EC9BE',
    sad: '#8A93A4',
    angry: '#E8A888',
  },
  climate: {
    happy: '#E8C48A',
    neutral: '#7EC9BE',
    stress: '#D49A88',
  },
};

/**
 * Purpose: light neumorph palette — warm gray-beige canvas, dual shadows, clay accent.
 * Design decisions: paper matches surfaces so extrusion reads as soft clay, not a card on white.
 */
export const lightColors: ThemeColors = {
  scheme: 'light',
  ink: '#3A342E',
  paper: '#E8E2D6',
  muted: '#7A7268',
  faint: '#888075',
  line: '#D4CEC2',
  glass: '#E8E2D6',
  glassBorder: 'rgba(255, 255, 255, 0.45)',
  surface: '#E8E2D6',
  well: '#DFD8CC',
  washTop: '#EDE6D8',
  washBottom: '#E3DDD0',
  shadowLight: '#FFFFFF',
  shadowDark: '#C9C0B2',
  raisedShadow: '7px 7px 16px #C9C0B2, -6px -6px 14px #FFFFFF',
  insetShadow: 'inset 5px 5px 10px #C9C0B2, inset -5px -5px 10px #F7F3EA',
  accentRaisedShadow: '6px 6px 14px rgba(150,80,40,0.32), -4px -4px 10px rgba(255,220,190,0.5)',
  /** Soft inner glow for selected chips / active filters. */
  accentGlow: 'inset 0 0 0 1.5px rgba(201,106,58,0.5), 0 0 8px rgba(201,106,58,0.16)',
  accent: '#C96A3A',
  accentInk: '#FFF8F2',
  accentSoft: 'rgba(201,106,58,0.14)',
  danger: '#B85A52',
  mesh: ['#EDE6D8', '#E8E2D6', '#E3DDD0', '#EAE3D6', '#E8E2D6', '#E4DED0', '#EFE8DA', '#E8E2D6', '#E2DCCE'],
  mood: {
    happy: '#C9892E',
    neutral: '#2F8F82',
    sad: '#5C6578',
    angry: '#D46532',
  },
  climate: {
    happy: '#C9892E',
    neutral: '#2F8F82',
    stress: '#B45C48',
  },
};

/**
 * Purpose: San Francisco on iPhone, Roboto on Android, system-ui on web.
 * Design decisions: omit a named family on native so Dynamic Type + the OS UI font apply;
 *   Outfit/Fraunces stay Halo identity in the wash, not in chrome.
 */
const systemUi = Platform.select({ ios: undefined, android: undefined, default: 'system-ui' });

export const fonts = {
  display: systemUi,
  displayRegular: systemUi,
  displayBold: systemUi,
  body: systemUi,
  bodyMedium: systemUi,
  bodySemi: systemUi,
};

/** iOS grouped-table corner — still Halo clay, tighter than a floating card. */
export const groupedRadius = 16;

/** Tab bar row (icons + labels), excluding the home-indicator inset. */
export const tabBarContentHeight = 49;

/**
 * Purpose: raised (extruded) surface — light highlight + dark shade, same hue as the canvas.
 * Inputs: theme colors and corner radius (20–28 for cards; smaller for chips).
 * Outputs: ViewStyle with matching fill, subtle glass hairline, dual boxShadow.
 * Side effects: none.
 * Design decisions: overflow stays visible so shadows are not clipped; glassBorder separates cards from charcoal/paper.
 */
export function raisedSurface(colors: ThemeColors, radius = 24): ClaySurfaceStyle {
  return {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    boxShadow: colors.raisedShadow,
  };
}

/**
 * Purpose: inset well for search, text fields, and mood orbs.
 * Inputs: theme colors and corner radius.
 * Outputs: ViewStyle with a slightly deeper fill and inset dual shadows.
 * Side effects: none.
 * Design decisions: well is the same hue as paper, just a step darker, so it reads pressed-in.
 */
export function insetSurface(colors: ThemeColors, radius = 22): ClaySurfaceStyle {
  return {
    backgroundColor: colors.well,
    borderRadius: radius,
    borderWidth: 0,
    borderColor: 'transparent',
    boxShadow: colors.insetShadow,
  };
}

/**
 * Purpose: softly raised primary / accent control.
 * Inputs: theme colors and corner radius.
 * Outputs: ViewStyle with clay fill and warmer dual shadows.
 * Side effects: none.
 * Design decisions: accent stays clay/peach; extrusion replaces flat fill or glass pills.
 */
export function raisedAccent(colors: ThemeColors, radius = 22): ClaySurfaceStyle {
  return {
    backgroundColor: colors.accent,
    borderRadius: radius,
    borderWidth: 0,
    borderColor: 'transparent',
    boxShadow: colors.accentRaisedShadow,
  };
}

/**
 * Purpose: chip / filter pill — raised + accent glow when selected, inset when idle.
 * Inputs: theme colors and selected flag.
 * Outputs: ViewStyle; selected chips use a crisp 1.5px accent border/glow for daylight glancibility.
 * Side effects: none.
 */
export function chipSurface(colors: ThemeColors, selected: boolean): ViewStyle {
  if (!selected) {
    return {
      ...insetSurface(colors, 16),
      backgroundColor: colors.well,
    };
  }
  return {
    ...raisedSurface(colors, 16),
    backgroundColor: colors.accentSoft,
    borderWidth: 1.5,
    borderColor: colors.accent,
    boxShadow: colors.accentGlow,
  };
}

/**
 * Purpose: resolve stored preference against the system scheme.
 * Inputs: writer preference and OS scheme.
 * Outputs: dark or light.
 * Side effects: none.
 */
export function resolveColorScheme(
  preference: ThemePreference,
  systemScheme: string | null | undefined,
): ColorScheme {
  if (preference === 'dark' || preference === 'light') {
    return preference;
  }
  return systemScheme === 'light' ? 'light' : 'dark';
}
