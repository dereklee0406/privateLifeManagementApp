import type { ReactNode } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  type ScrollViewProps,
} from 'react-native';

type KeyboardDismissScrollViewProps = ScrollViewProps & {
  children: ReactNode;
};

/**
 * Purpose: form ScrollView that dismisses the soft keyboard on tap-outside and drag.
 * Inputs: standard ScrollView props + children.
 * Outputs: scrollable form content.
 * Side effects: Keyboard.dismiss on tap of non-input chrome and on scroll drag.
 * Design decisions: On Web, desktop keyboards do not have a soft keyboard and click-to-blur breaks
 *   HTML input typing. On native, TouchableWithoutFeedback allows inputs and buttons to capture
 *   first-responder status without parent click handlers stealing focus.
 */
export function KeyboardDismissScrollView({
  children,
  contentContainerStyle,
  keyboardShouldPersistTaps = 'handled',
  keyboardDismissMode = 'on-drag',
  showsVerticalScrollIndicator = false,
  ...rest
}: KeyboardDismissScrollViewProps) {
  if (Platform.OS === 'web') {
    return (
      <ScrollView
        {...rest}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        contentContainerStyle={contentContainerStyle}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      {...rest}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={keyboardDismissMode}
      contentContainerStyle={contentContainerStyle}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.fill}>{children}</View>
      </TouchableWithoutFeedback>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flexGrow: 1,
  },
});
