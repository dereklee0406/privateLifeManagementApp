import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useThemeColors } from '../theme/ThemeProvider';
import { raisedSurface } from '../theme/tokens';

interface GlassSurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  radius?: number;
}

/**
 * Purpose: detect iOS Liquid Glass without crashing older runtimes.
 * Inputs: none.
 * Outputs: true when GlassView can render natively.
 * Side effects: none.
 * Design decisions: kept for the native/web split; neumorph surfaces do not use glass.
 */
export function canUseLiquidGlass(): boolean {
  if (Platform.OS !== 'ios') {
    return false;
  }
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

/**
 * Purpose: raised neumorph panel shared by cards, islands, and settings blocks.
 * Inputs: children, optional style, unused intensity (API compat), corner radius.
 * Outputs: same-hue extruded surface with dual shadows.
 * Side effects: none.
 * Design decisions: no BlurView / GlassView — glass fights neumorphism. expo-glass-effect stays imported only here so web Metro cannot resolve it.
 */
export function GlassSurface({ children, style, intensity: _intensity = 38, radius = 24 }: GlassSurfaceProps) {
  const colors = useThemeColors();
  return <View style={[raisedSurface(colors, radius), style]}>{children}</View>;
}
