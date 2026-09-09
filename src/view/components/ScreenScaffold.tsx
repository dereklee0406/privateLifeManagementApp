import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useThemeColors } from '../theme/ThemeProvider';
import { AmbientBackground } from './AmbientBackground';

interface ScreenScaffoldProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Purpose: wrap every screen in the neumorph wash without repeating layout.
 * Inputs: children and optional extra style.
 * Outputs: full-screen canvas.
 * Side effects: none.
 */
export function ScreenScaffold({ children, style }: ScreenScaffoldProps) {
  const colors = useThemeColors();
  return (
    <View style={[styles.root, { backgroundColor: colors.paper }, style]}>
      <AmbientBackground />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
