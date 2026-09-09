import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../theme/ThemeProvider';

/**
 * Purpose: iOS page-sheet feel — grabber + extra top inset for compose / spend / PIN modals.
 * Inputs: children; optional hideGrabber.
 * Outputs: a top grabber on iOS/Android (RN Modal has no system grabber on Android).
 * Side effects: none.
 * Design decisions: web still gets a subtle grabber so the sheet metaphor is shared.
 */
export function SheetChrome({ children, hideGrabber }: { children: ReactNode; hideGrabber?: boolean }) {
  const colors = useThemeColors();
  return (
    <View style={styles.wrap}>
      {hideGrabber ? null : (
        <View style={styles.grabberWrap} accessibilityElementsHidden>
          <View style={[styles.grabber, { backgroundColor: colors.faint }]} />
        </View>
      )}
      {children}
    </View>
  );
}

/**
 * Purpose: slightly round the top of a modal canvas (form-sheet corners).
 */
export function sheetTopRadius(): number {
  return Platform.OS === 'web' ? 16 : 12;
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  grabberWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.45,
  },
});
