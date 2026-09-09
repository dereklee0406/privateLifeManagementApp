import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from '../../controller/SettingsProvider';
import { darkColors, lightColors, resolveColorScheme, type ThemeColors } from './tokens';

const ThemeContext = createContext<ThemeColors>(darkColors);

/**
 * Purpose: expose resolved neumorph color tokens to every view.
 * Inputs: settings preference plus system scheme.
 * Outputs: ThemeColors via context.
 * Side effects: none.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const { settings } = useSettings();
  const colors = useMemo(() => {
    const scheme = resolveColorScheme(settings.themePreference, systemScheme);
    return scheme === 'light' ? lightColors : darkColors;
  }, [settings.themePreference, systemScheme]);

  return createElement(ThemeContext.Provider, { value: colors }, children);
}

/**
 * Purpose: read the active theme from a view.
 */
export function useThemeColors(): ThemeColors {
  return useContext(ThemeContext);
}
