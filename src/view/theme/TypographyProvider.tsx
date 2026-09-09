import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSettings } from '@/controller/SettingsProvider';
import {
  resolveFontScale,
  type FontSizePreference,
} from '@/model/settings/AppSettings';
import { createTypography } from './typography';

type TypographyStyles = ReturnType<typeof createTypography>;

interface TypographyContextValue {
  /** Scaled HIG type roles for the current preference / system fontScale. */
  type: TypographyStyles;
  /** Effective numeric scale factor applied to base font sizes. */
  fontScale: number;
  /** Resolved preference (defaults to 'system' when unset). */
  preference: FontSizePreference;
  /**
   * Purpose: scale an arbitrary base font size by the current factor.
   * Inputs: base — unscaled pixel size.
   * Outputs: rounded scaled size.
   * Side effects: none.
   */
  scaleFontSize: (base: number) => number;
}

const TypographyContext = createContext<TypographyContextValue | null>(null);

/**
 * Purpose: bind AppSettings.fontSizePreference + OS fontScale to dynamic typography.
 * Inputs: children tree (must sit under SettingsProvider).
 * Outputs: TypographyContext with scaled `type`, fontScale, preference, scaleFontSize.
 * Side effects: none beyond React re-renders when preference or window fontScale changes.
 * Design decisions: resolveFontScale stays in Model; View only composes createTypography.
 *   Provider mounts inside SettingsProvider so useSettings() is available.
 */
export function TypographyProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { fontScale: systemFontScale } = useWindowDimensions();

  const preference: FontSizePreference = settings.fontSizePreference || 'system';
  const scale = resolveFontScale(settings.fontSizePreference, systemFontScale);

  const value = useMemo<TypographyContextValue>(
    () => ({
      type: createTypography(scale),
      fontScale: scale,
      preference,
      scaleFontSize: (base: number) => Math.round(base * scale),
    }),
    [scale, preference],
  );

  return (
    <TypographyContext.Provider value={value}>{children}</TypographyContext.Provider>
  );
}

/**
 * Purpose: access scaled typography from views.
 * Inputs: none (reads TypographyContext).
 * Outputs: TypographyContextValue.
 * Side effects: throws if used outside TypographyProvider.
 */
export function useTypography(): TypographyContextValue {
  const value = useContext(TypographyContext);
  if (!value) {
    throw new Error('useTypography must be used inside TypographyProvider.');
  }
  return value;
}
