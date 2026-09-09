import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useReduceMotion } from '../../utils/reduceMotion';
import { useThemeColors } from '../theme/ThemeProvider';

/**
 * Purpose: paint a flat neumorph wash behind every screen on web.
 * Inputs: none (reads theme wash + paper; Reduce Motion skips the gradient).
 * Outputs: full-screen tinted canvas, non-interactive.
 * Side effects: none.
 * Design decisions: LinearGradient only — expo-mesh-gradient cannot be imported on web.
 */
export function AmbientBackground() {
  const colors = useThemeColors();
  const reduceMotion = useReduceMotion();

  if (reduceMotion) {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.paper }]} />;
  }

  return (
    <LinearGradient
      pointerEvents="none"
      colors={[colors.washTop, colors.paper, colors.washBottom]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
