import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppConfig } from '../../config/appConfig';
import { useSettings } from '../../controller/SettingsProvider';
import { hapticSuccess } from '../../utils/haptics';
import { useI18n } from '../i18n';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface } from '../theme/tokens';

/**
 * Purpose: short first-run — name, then a kind privacy line.
 * Inputs: local name field; settings.completeOnboarding.
 * Outputs: two small screens, then tabs.
 * Side effects: persists onboarding and routes into Today.
 */
export function OnboardingScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completeOnboarding } = useSettings();
  const { t } = useI18n();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');

  const onBegin = async () => {
    await completeOnboarding(name);
    await hapticSuccess();
    router.replace('/(tabs)');
  };

  return (
    <ScreenScaffold>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
          <Text style={[styles.brand, { color: colors.accent }]}>{AppConfig.productName}</Text>
          {step === 1 ? (
            <>
              <Text style={[styles.headline, { color: colors.ink }]}>{t('onboarding.callYou')}</Text>
              <Text style={[styles.body, { color: colors.muted }]}>{t('onboarding.callYouHint')}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('onboarding.yourName')}
                placeholderTextColor={colors.faint}
                autoCapitalize="words"
                autoFocus
                style={[insetSurface(colors, 22), styles.input, { color: colors.ink }]}
              />
              <PrimaryButton icon="arrow-forward" label={t('common.next')} onPress={() => setStep(2)} />
            </>
          ) : (
            <>
              <Text style={[styles.headline, { color: colors.ink }]}>{t('onboarding.staysOnPhone')}</Text>
              <Text style={[styles.body, { color: colors.muted }]}>
                {t('onboarding.staysBody')}
              </Text>
              <Text style={[styles.body, { color: colors.faint }]}>
                {t('onboarding.staysHint')}
              </Text>
              <PrimaryButton icon="checkmark-circle-outline" label={t('onboarding.letsGo')} onPress={() => void onBegin()} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 26,
    justifyContent: 'flex-end',
    gap: 18,
  },
  brand: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 46,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 18,
    lineHeight: 26,
  },
  input: {
    fontFamily: fonts.display,
    fontSize: 28,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
    marginTop: 8,
  },
});
