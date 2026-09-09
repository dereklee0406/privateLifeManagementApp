import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { FinanceProvider } from '@/controller/FinanceProvider';
import { FxRateProvider } from '@/controller/FxRateProvider';
import { JournalProvider } from '@/controller/JournalProvider';
import { LockProvider, useLock } from '@/controller/LockProvider';
import { ReminderProvider } from '@/controller/ReminderProvider';
import { SettingsProvider, useSettings } from '@/controller/SettingsProvider';
import { I18nProvider } from '@/view/i18n';
import { TrashProvider } from '@/controller/TrashProvider';
import { NotificationObserver } from '@/view/components/NotificationObserver';
import { ThemeProvider, useThemeColors } from '@/view/theme/ThemeProvider';
import { TypographyProvider } from '@/view/theme/TypographyProvider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * Purpose: send first-run writers to onboarding and returning writers into tabs.
 * Inputs: settings readiness and current segment.
 * Outputs: none.
 * Side effects: router.replace when the gate changes.
 */
function AuthGate() {
  const { ready, settings } = useSettings();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) {
      return;
    }
    const atOnboarding = segments[0] === 'onboarding';
    if (!settings.onboardingComplete && !atOnboarding) {
      router.replace('/onboarding');
      return;
    }
    if (settings.onboardingComplete && atOnboarding) {
      router.replace('/(tabs)');
    }
  }, [ready, settings.onboardingComplete, segments, router]);

  return null;
}

/**
 * Purpose: apply status bar and system background once theme is known.
 */
function ThemedChrome() {
  const colors = useThemeColors();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.paper);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'halo-web-scrollbar-style';
      let styleTag = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
      }
      styleTag.textContent = `
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: ${colors.line};
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${colors.muted};
        }
        * {
          scrollbar-width: thin;
          scrollbar-color: ${colors.line} transparent;
        }
      `;
    }
  }, [colors.paper, colors.line, colors.muted]);

  return <StatusBar style={colors.scheme === 'dark' ? 'light' : 'dark'} />;
}

function RootNavigation() {
  const { ready, settings } = useSettings();
  const { authResolved } = useLock();
  const canReveal = ready && authResolved;

  useEffect(() => {
    if (canReveal) {
      void SplashScreen.hideAsync();
    }
  }, [canReveal]);

  if (!canReveal) {
    return <View style={{ flex: 1, backgroundColor: '#0A0B10' }} />;
  }

  return (
    <>
      <AuthGate />
      <ThemedChrome />
      <NotificationObserver />
      <Stack
        initialRouteName={settings.onboardingComplete ? '(tabs)' : 'onboarding'}
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="compose" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="entry/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="reminders" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="expense/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="expense/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="income/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="transfer/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="memories" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="privacy" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="reminder-types" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="trash" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="expense-categories" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="payment-cards" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}

/**
 * Purpose: application shell — fonts, MVC providers, and the root stack.
 * Inputs: Expo Router children via file routes.
 * Outputs: the Halo app tree.
 * Side effects: splash screen, system UI color.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider>
        <I18nProvider>
        <ThemeProvider>
          <TypographyProvider>
          <JournalProvider>
            <ReminderProvider>
              <FxRateProvider>
                <FinanceProvider>
                  <TrashProvider>
                    <LockProvider>
                      <RootNavigation />
                    </LockProvider>
                  </TrashProvider>
                </FinanceProvider>
              </FxRateProvider>
            </ReminderProvider>
          </JournalProvider>
          </TypographyProvider>
        </ThemeProvider>
        </I18nProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}
