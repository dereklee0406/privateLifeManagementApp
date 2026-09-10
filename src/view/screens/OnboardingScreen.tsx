import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import type { TypeIconName } from '../icons/typeIcons';

type OnboardingStep = 1 | 2 | 3;

const HUB_MAP: Array<{ icon: TypeIconName; titleKey: string; lineKey: string }> = [
  { icon: 'home-outline', titleKey: 'onboarding.hubToday', lineKey: 'onboarding.hubTodayLine' },
  { icon: 'book-outline', titleKey: 'onboarding.hubJournal', lineKey: 'onboarding.hubJournalLine' },
  { icon: 'checkbox-outline', titleKey: 'onboarding.hubRhythm', lineKey: 'onboarding.hubRhythmLine' },
  { icon: 'card-outline', titleKey: 'onboarding.hubWallet', lineKey: 'onboarding.hubWalletLine' },
  { icon: 'pie-chart-outline', titleKey: 'onboarding.hubInsights', lineKey: 'onboarding.hubInsightsLine' },
];

/**
 * Purpose: first-run — name, privacy, then a 15s map of the five hubs.
 * Inputs: local name field; settings.completeOnboarding.
 * Outputs: three small screens, then tabs.
 * Side effects: persists onboarding and routes into Today.
 * Design decisions: lock is a mention only (Settings later), not a PIN setup. Privacy-first copy.
 *   No sixth tab, no cloud. Close-the-day is not part of first-run.
 */
export function OnboardingScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completeOnboarding } = useSettings();
  const { t } = useI18n();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [name, setName] = useState('');

  const onBegin = async () => {
    await completeOnboarding(name);
    await hapticSuccess();
    router.replace('/(tabs)');
  };

  return (
    <ScreenScaffold>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {step === 3 ? (
          <ScrollView
            contentContainerStyle={[
              styles.mapContent,
              { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.brand, { color: colors.accent }]}>{AppConfig.productName}</Text>
            <Text style={[styles.headline, { color: colors.ink }]}>{t('onboarding.mapTitle')}</Text>
            <Text style={[styles.body, { color: colors.muted }]}>{t('onboarding.mapBody')}</Text>
            <View style={styles.hubList}>
              {HUB_MAP.map((hub) => (
                <View key={hub.titleKey} style={styles.hubRow}>
                  <Ionicons name={hub.icon} size={22} color={colors.accent} accessible={false} />
                  <View style={styles.hubCopy}>
                    <Text style={[styles.hubTitle, { color: colors.ink }]}>{t(hub.titleKey)}</Text>
                    <Text style={[styles.hubLine, { color: colors.muted }]}>{t(hub.lineKey)}</Text>
                  </View>
                </View>
              ))}
            </View>
            <Text style={[styles.lock, { color: colors.faint }]}>{t('onboarding.lockMention')}</Text>
            <PrimaryButton icon="checkmark-circle-outline" label={t('onboarding.letsGo')} onPress={() => void onBegin()} />
          </ScrollView>
        ) : (
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
                <Text style={[styles.body, { color: colors.muted }]}>{t('onboarding.staysBody')}</Text>
                <Text style={[styles.body, { color: colors.faint }]}>{t('onboarding.staysHint')}</Text>
                <PrimaryButton icon="arrow-forward" label={t('common.next')} onPress={() => setStep(3)} />
              </>
            )}
          </View>
        )}
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
  mapContent: {
    flexGrow: 1,
    paddingHorizontal: 26,
    justifyContent: 'flex-end',
    gap: 16,
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
  hubList: {
    gap: 14,
    marginTop: 4,
  },
  hubRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 44,
  },
  hubCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  hubTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 17,
    lineHeight: 22,
  },
  hubLine: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
  },
  lock: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
});
