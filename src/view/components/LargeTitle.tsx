import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { useThemeColors } from '../theme/ThemeProvider';
import { useTypography } from '../theme/TypographyProvider';

/**
 * Purpose: iOS large title on root tabs (Today, Pages, Calendar, Money, Settings).
 * Inputs: title string; optional extra style.
 * Outputs: scaled largeTitle text from useTypography (Dynamic Type + user preference).
 * Side effects: none.
 * Design decisions: consumes TypographyProvider so Settings → Text size updates tab titles live.
 */
export function LargeTitle({ title, style }: { title: string; style?: StyleProp<TextStyle> }) {
  const colors = useThemeColors();
  const { type } = useTypography();
  return <Text style={[type.largeTitle, styles.title, { color: colors.ink }, style]}>{title}</Text>;
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 4,
  },
});
