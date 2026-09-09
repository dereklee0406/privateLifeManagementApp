import { Platform, type TextStyle } from 'react-native';
import { fonts } from './tokens';

/**
 * Purpose: build iOS HIG type roles (large title → caption) scaled by a font-size factor.
 * Inputs: scale — multiplier from resolveFontScale (typically 0.85–1.4).
 * Outputs: TextStyle fragments for each role. Callers add color.
 * Side effects: none.
 * Design decisions: no fixed lineHeight so Dynamic Type / user scale can grow; tabLabel is
 *   clamped to at most 12px so tab chrome does not overflow; fontWeight carries hierarchy
 *   now that named webfonts are gone. Factory keeps static `type` as createTypography(1)
 *   for backwards-compatible imports.
 */
export function createTypography(scale: number) {
  const s = (base: number) => Math.round(base * scale);

  return {
    largeTitle: {
      fontFamily: fonts.display,
      fontSize: s(34),
      fontWeight: '700',
      letterSpacing: 0.37,
    } satisfies TextStyle,
    title1: {
      fontFamily: fonts.display,
      fontSize: s(28),
      fontWeight: '700',
    } satisfies TextStyle,
    title2: {
      fontFamily: fonts.display,
      fontSize: s(22),
      fontWeight: '700',
    } satisfies TextStyle,
    title3: {
      fontFamily: fonts.bodySemi,
      fontSize: s(20),
      fontWeight: '600',
    } satisfies TextStyle,
    headline: {
      fontFamily: fonts.bodySemi,
      fontSize: s(17),
      fontWeight: '600',
    } satisfies TextStyle,
    body: {
      fontFamily: fonts.body,
      fontSize: s(17),
      fontWeight: '400',
    } satisfies TextStyle,
    callout: {
      fontFamily: fonts.body,
      fontSize: s(16),
      fontWeight: '400',
    } satisfies TextStyle,
    subhead: {
      fontFamily: fonts.body,
      fontSize: s(15),
      fontWeight: '400',
    } satisfies TextStyle,
    footnote: {
      fontFamily: fonts.body,
      fontSize: s(13),
      fontWeight: '400',
    } satisfies TextStyle,
    caption: {
      fontFamily: fonts.body,
      fontSize: s(12),
      fontWeight: '400',
    } satisfies TextStyle,
    tabLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: Math.min(12, s(10)),
      fontWeight: '500',
    } satisfies TextStyle,
    navTitle: {
      fontFamily: fonts.bodySemi,
      fontSize: s(17),
      fontWeight: '600',
    } satisfies TextStyle,
  };
}

/** Default static typography at 1.0× for backwards-compatible imports. */
export const type = createTypography(1);

/**
 * Purpose: extra bottom inset so tab-scene ScrollViews clear the iOS-style tab bar.
 * Inputs: safe-area bottom.
 * Outputs: paddingBottom for contentContainerStyle.
 */
export function tabScenePaddingBottom(insetsBottom: number): number {
  return insetsBottom + 88;
}

/** iOS grouped section label — small caps feel without locking Dynamic Type. */
export const groupedHeaderStyle: TextStyle = {
  ...type.footnote,
  fontWeight: '400',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  marginBottom: 8,
  marginLeft: 16,
};

export const groupedFooterStyle: TextStyle = {
  ...type.footnote,
  marginTop: 8,
  marginHorizontal: 16,
};

export const iosNavFont: TextStyle = {
  fontFamily: fonts.body,
  fontWeight: Platform.OS === 'ios' ? '400' : '500',
};
