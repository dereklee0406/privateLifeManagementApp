import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import {
  resolveClockHourFormat,
  resolveHapticsEnabled,
  resolveReminderSoundEnabled,
  resolveWeekStart,
  type ClockHourFormat,
  type WeekStart,
} from '../../model/settings/AppSettings';
import { useI18n } from '../i18n';
import { Chip } from './Chip';
import { GroupedRow, GroupedSection } from './GroupedList';
import { useThemeColors } from '../theme/ThemeProvider';
import { type } from '../theme/typography';

const CLOCKS: Array<{ id: ClockHourFormat; label: string }> = [
  { id: '12h', label: '12-hour' },
  { id: '24h', label: '24-hour' },
];

const WEEK_STARTS: Array<{ id: WeekStart; label: string }> = [
  { id: 'sunday', label: 'Sunday' },
  { id: 'monday', label: 'Monday' },
];

/**
 * Purpose: Settings → Preferences — sound, haptics, clock, week start. Look stays in Appearance.
 * Inputs: settings mutators; reminder sync after sound change.
 * Outputs: iOS inset-grouped Halo rows. Week starts on is the last row (do not add more).
 * Side effects: persists AppSettings; native reschedules enabled reminders when sound flips.
 */
export function CustomizePanel() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const { settings, setReminderSoundEnabled, setHapticsEnabled, setClockHourFormat, setWeekStart } = useSettings();
  const { syncSchedules } = useReminders();
  const soundOn = resolveReminderSoundEnabled(settings);
  const hapticsOn = resolveHapticsEnabled(settings);
  const clock = resolveClockHourFormat(settings);
  const weekStart = resolveWeekStart(settings);

  const switchColors = {
    false: colors.line,
    true: colors.accent,
  };
  const thumb = colors.scheme === 'dark' ? '#E4DDD4' : '#FFF8F2';

  return (
    <GroupedSection header={t('customize.title')} icon="options-outline">
      <GroupedRow
        title={t('customize.reminderSound')}
        subtitle={
          Platform.OS === 'web'
            ? t('customize.soundWeb')
            : soundOn
              ? t('customize.soundOn')
              : t('customize.soundOff')
        }
        accessory={
          <Switch
            value={soundOn}
            onValueChange={(value) => {
              void (async () => {
                await setReminderSoundEnabled(value);
                await syncSchedules();
              })();
            }}
            trackColor={switchColors}
            thumbColor={thumb}
            accessibilityLabel={t('customize.reminderSound')}
          />
        }
      />
      <GroupedRow
        title={t('customize.haptics')}
        subtitle={t('customize.hapticsHint')}
        accessory={
          <Switch
            value={hapticsOn}
            onValueChange={(value) => void setHapticsEnabled(value)}
            trackColor={switchColors}
            thumbColor={thumb}
            accessibilityLabel={t('customize.haptics')}
          />
        }
      />
      <View style={styles.choiceRow}>
        <Text style={[type.headline, styles.choiceTitle, { color: colors.ink, fontWeight: '400' }]}>{t('customize.clock')}</Text>
        <View style={styles.chips}>
          {CLOCKS.map((item) => (
            <Chip
              key={item.id}
              label={item.id === '12h' ? t('customize.clock12') : t('customize.clock24')}
              selected={clock === item.id}
              onPress={() => void setClockHourFormat(item.id)}
            />
          ))}
        </View>
        <Text style={[type.footnote, { color: colors.faint }]}>{t('customize.clockHint')}</Text>
      </View>
      <View style={styles.choiceRow}>
        <Text style={[type.headline, styles.choiceTitle, { color: colors.ink, fontWeight: '400' }]}>{t('customize.weekStarts')}</Text>
        <View style={styles.chips}>
          {WEEK_STARTS.map((item) => (
            <Chip
              key={item.id}
              label={item.id === 'sunday' ? t('customize.sunday') : t('customize.monday')}
              selected={weekStart === item.id}
              onPress={() => void setWeekStart(item.id)}
            />
          ))}
        </View>
        <Text style={[type.footnote, { color: colors.faint }]}>
          {t('customize.weekHint')}
        </Text>
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
  choiceTitle: {
    fontSize: 17,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
});
