import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemeColors } from '../theme/ThemeProvider';
import { raisedSurface } from '../theme/tokens';

interface GlassSurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  radius?: number;
}

/**
 * Purpose: Liquid Glass is native-only; web always reports unavailable.
 * Inputs: none.
 * Outputs: false.
 * Side effects: none.
 */
export function canUseLiquidGlass(): boolean {
  return false;
}

/**
 * Purpose: raised neumorph panel on web without native view managers.
 * Inputs: children, optional style, unused intensity (API compat), corner radius.
 * Outputs: same-hue extruded surface with dual shadows.
 * Side effects: none.
 * Design decisions: plain View + token shadows only. No expo-blur / expo-glass-effect — those stay out of generic and web files.
 */
export function GlassSurface({ children, style, intensity: _intensity = 38, radius = 24 }: GlassSurfaceProps) {
  const colors = useThemeColors();
  return <View style={[raisedSurface(colors, radius), style]}>{children}</View>;
}
