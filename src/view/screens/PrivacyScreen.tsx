import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppConfig } from '../../config/appConfig';
import { useI18n } from '../i18n';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

/**
 * Purpose: one-screen privacy note — stays on this phone, nothing uploaded.
 * Inputs: none.
 * Outputs: You → Privacy copy.
 * Side effects: none.
 */
export function PrivacyScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  return (
    <ScreenScaffold>
      <ScreenHeader title={t('privacy.title')} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.headline, { color: colors.ink }]}>{t('onboarding.staysOnPhone')}</Text>
        <Text style={[styles.lede, { color: colors.muted }]}>
          {t('you.stays', { name: AppConfig.productName })}
        </Text>
        <Text style={[styles.lede, { color: colors.muted }]}>{t('privacy.lede')}</Text>
        <Text style={[styles.body, { color: colors.ink }]}>
          {t('privacy.body1', { name: AppConfig.productName })}
        </Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          {t('privacy.body2')}
        </Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          {t('privacy.body3')}
        </Text>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, gap: 16 },
  headline: { fontFamily: fonts.display, fontSize: 36, lineHeight: 42 },
  lede: { fontFamily: fonts.bodySemi, fontSize: 18, lineHeight: 26 },
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 26 },
});
