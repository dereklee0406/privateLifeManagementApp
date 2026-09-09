import { StyleSheet, View } from 'react-native';
import { useSettings } from '../../controller/SettingsProvider';
import { resolveLanguagePreference, type LanguagePreference } from '../../model/settings/language';
import { useI18n } from '../i18n';
import { Chip } from './Chip';
import { GroupedSection } from './GroupedList';

const CHOICES: LanguagePreference[] = ['system', 'en', 'zh-Hant', 'ja'];

/**
 * Purpose: Settings → Language chips — Follow phone · English · 中文 · 日本語.
 * Inputs: settings.language; setLanguage.
 * Outputs: iOS grouped chips. Language names stay in their own script.
 * Side effects: persists AppSettings.language.
 * Design decisions: Appearance section on SettingsScreen inlines Look + Language; this panel
 *   remains for reuse if Language is shown alone.
 */
export function LanguagePanel() {
  const { t } = useI18n();
  const { settings, setLanguage } = useSettings();
  const current = resolveLanguagePreference(settings);

  const labelFor = (id: LanguagePreference): string => {
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
  };

  return (
    <GroupedSection header={t('language.title')} footer={t('language.footer')}>
      <View style={styles.choiceRow}>
        <View style={styles.chips}>
          {CHOICES.map((id) => (
            <Chip
              key={id}
              label={labelFor(id)}
              selected={current === id}
              onPress={() => void setLanguage(id)}
            />
          ))}
        </View>
      </View>
    </GroupedSection>
  );
}

const styles = StyleSheet.create({
  choiceRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    minHeight: 44,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
});
