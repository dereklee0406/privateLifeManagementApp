import { Platform, type TextProps, type TextStyle } from 'react-native';

/**
 * Purpose: shared Text props so reminder type / category labels shrink on native and wrap on web.
 * Inputs: max lines (default 2).
 * Outputs: numberOfLines; native also gets adjustsFontSizeToFit + minimumFontScale 0.7.
 * Side effects: none.
 * Design decisions: web ignores adjustsFontSizeToFit, so we never clip with overflow:hidden;
 *   native floors at 0.7 so “Monthly ETF purchase” still reads at 320px.
 */
export function reminderTypeTextProps(
  numberOfLines = 2,
): Pick<TextProps, 'numberOfLines' | 'adjustsFontSizeToFit' | 'minimumFontScale'> {
  if (Platform.OS === 'web') {
    return { numberOfLines };
  }
  return {
    numberOfLines,
    adjustsFontSizeToFit: true,
    minimumFontScale: 0.7,
  };
}

/**
 * Purpose: layout styles the Text node itself must carry so web flex items can wrap.
 * Inputs: none.
 * Outputs: flexShrink + minWidth 0 (no overflow hidden).
 * Side effects: none.
 * Design decisions: shrink the Text, not the parent pill, so a wrap row wraps to the next line
 *   instead of compressing every chip.
 */
export const reminderTypeTextStyle: TextStyle = {
  flexShrink: 1,
  minWidth: 0,
};
