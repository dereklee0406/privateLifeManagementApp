import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppConfig } from '../../config/appConfig';
import { useFinance } from '../../controller/FinanceProvider';
import { useFxRates } from '../../controller/FxRateProvider';
import { useSettings } from '../../controller/SettingsProvider';
import { formatRatesClock } from '../../model/finance/fx';
import {
  resolveShowAdvancedFinance,
  resolveCardFxFeeRate,
  CARD_FX_FEE_PRESETS,
  type MoneyCurrency,
  type ThemePreference,
} from '../../model/settings/AppSettings';
import { resolveLanguagePreference, type LanguagePreference } from '../../model/settings/language';
import { appHref } from '../../utils/navigation';
import { BackupPanel } from '../components/BackupPanel';
import { Chip } from '../components/Chip';
import { CustomizePanel } from '../components/CustomizePanel';
import { GroupedRow, GroupedSection } from '../components/GroupedList';
import { KeyboardDismissScrollView } from '../components/KeyboardDismissScrollView';
import { LargeTitle } from '../components/LargeTitle';
import { LockSettingsPanel } from '../components/LockSettingsPanel';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { TextSizeSelector } from '../components/TextSizeSelector';
import { useI18n } from '../i18n';
import type { TypeIconName } from '../icons/typeIcons';
import { useThemeColors } from '../theme/ThemeProvider';
import { insetSurface } from '../theme/tokens';
import { tabScenePaddingBottom, type } from '../theme/typography';

function cardFeeChipLabel(rate: 0 | 0.015 | 0.02 | 0.03, t: (key: string) => string): string {
  if (rate === 0) {
    return t('money.feeNone');
  }
  if (rate === 0.015) {
    return t('money.feeTypical15');
  }
  if (rate === 0.02) {
    return t('money.feeTypical2');
  }
  return t('money.fee3');
}

const THEME_KEYS: Array<{ id: ThemePreference; key: string; icon: TypeIconName }> = [
  { id: 'system', key: 'you.lookSystem', icon: 'desktop-outline' },
  { id: 'dark', key: 'you.lookMidnight', icon: 'moon-outline' },
  { id: 'light', key: 'you.lookPaper', icon: 'sunny-outline' },
];

const LANGUAGE_CHOICES: LanguagePreference[] = ['system', 'en', 'zh-Hant', 'ja'];

function appVersionLabel(): string {
  return (
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    '1.0.0'
  );
}

function languageLabel(id: LanguagePreference, t: (key: string) => string): string {
  if (id === 'system') {
    return t('language.followPhone');
  }
  if (id === 'en') {
    return t('language.english');
  }
  if (id === 'zh-Hant') {
    return t('language.chinese');
  }
  return t('language.japanese');
}

/**
 * Purpose: profile, look, language, preferences, catalogs, money, lock, backup, and privacy.
 * Inputs: settings and finance (to resolve the extra-tools default).
 * Outputs: iOS inset-grouped Settings form (Halo clay cards).
 * Side effects: persists preference changes; rename confirm on blur.
 * Design decisions: no “This week” dump (lives on Today). Profile avatar card leads; manage rows
 *   use disclosure chevrons; privacy + version close the page.
 */
export function SettingsScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, intlLocale } = useI18n();
  const { settings, setThemePreference, renameWriter, setDefaultCurrency, setCardFxFeeRate, setShowAdvancedFinance, setLanguage } =
    useSettings();
  const { assets, loans } = useFinance();
  const { table: fx } = useFxRates();
  const extrasOn = resolveShowAdvancedFinance(settings, assets.length > 0 || loans.length > 0);
  const cardFeeRate = resolveCardFxFeeRate(settings);
  const language = resolveLanguagePreference(settings);
  const [name, setName] = useState(settings.writerName);
  useEffect(() => {
    setName(settings.writerName);
  }, [settings.writerName]);

  return (
    <ScreenScaffold>
      <KeyboardDismissScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: tabScenePaddingBottom(insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <LargeTitle title={t('you.title')} />
        <Text style={[type.subhead, { color: colors.muted }]}>
          {t('you.stays', { name: AppConfig.productName })}
        </Text>

        <GroupedSection>
          <View style={styles.profileRow}>
            <View
              style={[styles.avatar, insetSurface(colors, 28)]}
              accessibilityLabel={t('you.profile')}
            >
              <Ionicons name="person-circle" size={40} color={colors.accent} />
            </View>
            <View style={styles.profileCopy}>
              <Text style={[type.footnote, { color: colors.muted }]}>{t('you.profile')}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                onEndEditing={() => {
                  void renameWriter(name);
                }}
                placeholder={t('you.yourName')}
                placeholderTextColor={colors.faint}
                style={[styles.nameInput, { color: colors.ink }]}
                accessibilityLabel={t('you.yourName')}
              />
            </View>
          </View>
        </GroupedSection>

        <GroupedSection header={t('you.appearance')} icon="color-palette-outline" footer={t('language.footer')}>
          <View style={styles.fieldRow}>
            <Text style={[type.footnote, styles.fieldLabel, { color: colors.muted }]}>{t('you.look')}</Text>
            <View style={styles.chips}>
              {THEME_KEYS.map((theme) => {
                const selected = settings.themePreference === theme.id;
                return (
                  <Chip
                    key={theme.id}
                    leadingIcon={theme.icon}
                    label={t(theme.key)}
                    selected={selected}
                    onPress={() => void setThemePreference(theme.id)}
                  />
                );
              })}
            </View>
          </View>
          <View style={styles.fieldRow}>
            <Text style={[type.footnote, styles.fieldLabel, { color: colors.muted }]}>{t('language.title')}</Text>
            <View style={styles.chips}>
              {LANGUAGE_CHOICES.map((id) => (
                <Chip
                  key={id}
                  label={languageLabel(id, t)}
                  selected={language === id}
                  onPress={() => void setLanguage(id)}
                />
              ))}
            </View>
          </View>
          <TextSizeSelector />
        </GroupedSection>

        <CustomizePanel />

        <GroupedSection header={t('you.manage')} icon="folder-outline">
          <GroupedRow
            title={t('money.categories')}
            subtitle={t('money.categoriesHintShort')}
            onPress={() => router.push(appHref('/expense-categories'))}
            chevron
          />
          <GroupedRow
            title={t('you.reminderTypes')}
            subtitle={t('you.reminderTypesHint')}
            onPress={() => router.push(appHref('/reminder-types'))}
            chevron
          />
          <GroupedRow
            title={t('money.paymentCards')}
            subtitle={t('money.paymentCardsHint')}
            onPress={() => router.push(appHref('/payment-cards'))}
            chevron
          />
        </GroupedSection>

        <GroupedSection
          header={t('money.section')}
          icon="card-outline"
          footer={fx ? t('money.ratesUpdated', { time: formatRatesClock(fx.fetchedAt, new Date(), intlLocale) }) : undefined}
        >
          <GroupedRow
            title={t('money.extraTools')}
            subtitle={t('money.extraToolsHint')}
            accessory={
              <Switch
                value={extrasOn}
                onValueChange={(value) => void setShowAdvancedFinance(value)}
                trackColor={{ false: colors.line, true: colors.accent }}
                thumbColor={colors.scheme === 'dark' ? '#E4DDD4' : '#FFF8F2'}
              />
            }
          />
          <View style={styles.fieldRow}>
            <Text style={[type.headline, { color: colors.ink, fontWeight: '400', fontSize: 17 }]}>{t('money.currency')}</Text>
            <View style={styles.chips}>
              {AppConfig.money.currencies.map((item: MoneyCurrency) => (
                <Chip
                  key={item}
                  label={item}
                  selected={settings.defaultCurrency === item}
                  onPress={() => void setDefaultCurrency(item)}
                />
              ))}
            </View>
          </View>
          <View style={styles.fieldRow}>
            <Text style={[type.headline, { color: colors.ink, fontWeight: '400', fontSize: 17 }]}>
              {t('money.cardFee')}
            </Text>
            <View style={styles.chips}>
              {CARD_FX_FEE_PRESETS.map((item) => (
                <Chip
                  key={String(item.rate)}
                  label={cardFeeChipLabel(item.rate, t)}
                  selected={cardFeeRate === item.rate}
                  onPress={() => void setCardFxFeeRate(item.rate)}
                />
              ))}
            </View>
            <Text style={[type.footnote, { color: colors.muted }]}>
              {t('money.estimateHint')}
            </Text>
          </View>
        </GroupedSection>

        <LockSettingsPanel />

        <BackupPanel />

        <GroupedSection header={t('you.more')} icon="shield-checkmark-outline">
          <GroupedRow
            title={t('you.privacy')}
            subtitle={t('you.privacyHint')}
            onPress={() => router.push(appHref('/privacy'))}
            chevron
          />
          <GroupedRow
            title={t('you.recentlyDeleted')}
            onPress={() => router.push(appHref('/trash'))}
            chevron
          />
        </GroupedSection>

        <View style={styles.footnote}>
          <Text style={[type.footnote, { color: colors.faint, textAlign: 'center' }]}>
            {t('you.version', { name: AppConfig.productName, version: appVersionLabel() })}
          </Text>
          <Text style={[type.caption, { color: colors.faint, textAlign: 'center' }]}>
            {t('you.companion')}
          </Text>
        </View>
      </KeyboardDismissScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 18,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 72,
  },
  avatar: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameInput: {
    fontSize: 22,
    fontWeight: '600',
    paddingVertical: 2,
    minHeight: 36,
  },
  fieldRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    minHeight: 44,
  },
  fieldLabel: {
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  footnote: {
    gap: 4,
    paddingTop: 4,
    paddingBottom: 8,
  },
});
