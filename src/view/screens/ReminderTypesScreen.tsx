import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../../controller/SettingsProvider';
import {
  addCustomReminderType,
  removeReminderType,
  resetReminderTypes,
  resolveReminderTypes,
  setReminderTypeActive,
  type ReminderTypeIconName,
  REMINDER_TYPE_ICON_PALETTE,
} from '../../model/reminders/reminderTypes';
import { GroupedRow, GroupedSection } from '../components/GroupedList';
import { KeyboardDismissScrollView } from '../components/KeyboardDismissScrollView';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SectionActionButton } from '../components/SectionActionButton';
import { iconForReminderType, reminderTypeLabel, TYPE_ICON_SIZE } from '../icons/typeIcons';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface } from '../theme/tokens';
import { type } from '../theme/typography';

/**
 * Purpose: You → More → Reminder types — list, toggle, add custom, delete custom.
 * Inputs: SettingsProvider reminderTypes.
 * Outputs: ScreenHeader + clay grouped list + primary Add / quiet Reset footer.
 * Side effects: persists AppSettings.reminderTypes on device (AsyncStorage).
 * Design decisions: builtins soft-hide with no status subtitle (switch is enough);
 *   customs show “Custom” + delete; Other always stays on; actions use full-width primary
 *   + centered muted reset so chips no longer clump bottom-left.
 */
export function ReminderTypesScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { settings, setReminderTypes } = useSettings();
  const types = useMemo(() => resolveReminderTypes(settings), [settings]);

  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState<ReminderTypeIconName>('star-outline');

  const persist = async (next: typeof types) => {
    await setReminderTypes(next);
  };

  const onToggle = (id: string, active: boolean) => {
    void persist(setReminderTypeActive(types, id, active));
  };

  const onDelete = (id: string, title: string) => {
    Alert.alert(t('reminderTypes.deleteTitle'), t('reminderTypes.deleteBody', { name: title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => void persist(removeReminderType(types, id, true)),
      },
    ]);
  };

  const onAdd = async () => {
    const next = addCustomReminderType(types, label, icon);
    if (next === types) {
      return;
    }
    await persist(next);
    setLabel('');
    setIcon('star-outline');
    setAdding(false);
  };

  const onReset = () => {
    Alert.alert(t('reminderTypes.resetTitle'), t('reminderTypes.resetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('reminderTypes.resetConfirm'),
        style: 'destructive',
        onPress: () => void persist(resetReminderTypes()),
      },
    ]);
  };

  const switchColors = {
    false: colors.line,
    true: colors.accent,
  };
  const thumb = colors.scheme === 'dark' ? '#E4DDD4' : '#FFF8F2';

  return (
    <ScreenScaffold>
      <ScreenHeader title={t('reminderTypes.title')} />
      <KeyboardDismissScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[type.subhead, { color: colors.muted }]}>{t('reminderTypes.lede')}</Text>

        <GroupedSection header={t('reminderTypes.listHeader')} footer={t('reminderTypes.listFooter')}>
          {types.map((row) => {
            const title = reminderTypeLabel(t, row.id, types);
            const isOther = row.id === 'other';
            return (
              <GroupedRow
                key={row.id}
                leading={
                  <Ionicons
                    name={iconForReminderType(row.id, types)}
                    size={TYPE_ICON_SIZE}
                    color={colors.ink}
                  />
                }
                title={title}
                subtitle={row.builtin ? undefined : t('reminderTypes.custom')}
                accessory={
                  <View style={styles.rowActions}>
                    {!row.builtin ? (
                      <Pressable
                        onPress={() => onDelete(row.id, title)}
                        accessibilityRole="button"
                        accessibilityLabel={t('reminderTypes.deleteA11y', { name: title })}
                        style={styles.iconHit}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.danger} />
                      </Pressable>
                    ) : null}
                    <Switch
                      value={row.active}
                      disabled={isOther}
                      onValueChange={(value) => onToggle(row.id, value)}
                      trackColor={switchColors}
                      thumbColor={thumb}
                      accessibilityLabel={title}
                    />
                  </View>
                }
              />
            );
          })}
        </GroupedSection>

        {adding ? (
          <GroupedSection header={t('reminderTypes.addHeader')}>
            <View style={styles.addBlock}>
              <Text style={[type.footnote, { color: colors.muted }]}>{t('reminderTypes.name')}</Text>
              <TextInput
                value={label}
                onChangeText={setLabel}
                placeholder={t('reminderTypes.namePlaceholder')}
                placeholderTextColor={colors.faint}
                style={[insetSurface(colors, 12), styles.input, { color: colors.ink }]}
                maxLength={40}
                autoFocus
              />
              <Text style={[type.footnote, { color: colors.muted }]}>{t('reminderTypes.icon')}</Text>
              <View style={styles.palette}>
                {REMINDER_TYPE_ICON_PALETTE.map((name) => {
                  const selected = icon === name;
                  return (
                    <Pressable
                      key={name}
                      onPress={() => setIcon(name)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={name}
                      style={[
                        styles.paletteHit,
                        insetSurface(colors, 12),
                        selected ? { borderColor: colors.accent, borderWidth: 2 } : null,
                      ]}
                    >
                      <Ionicons name={name} size={TYPE_ICON_SIZE} color={selected ? colors.accent : colors.ink} />
                    </Pressable>
                  );
                })}
              </View>
              <PrimaryButton
                label={t('reminderTypes.saveAdd')}
                icon="checkmark-circle-outline"
                onPress={() => void onAdd()}
                disabled={!label.trim()}
              />
              <SectionActionButton
                icon="close-outline"
                label={t('common.cancel')}
                tone="muted"
                onPress={() => {
                  setAdding(false);
                  setLabel('');
                  setIcon('star-outline');
                }}
                style={styles.cancelChip}
              />
            </View>
          </GroupedSection>
        ) : (
          <PrimaryButton
            label={t('reminderTypes.add')}
            icon="add"
            onPress={() => setAdding(true)}
          />
        )}

        <Pressable
          onPress={onReset}
          accessibilityRole="button"
          accessibilityLabel={t('reminderTypes.reset')}
          style={styles.resetHit}
        >
          <Ionicons name="refresh-outline" size={18} color={colors.muted} accessible={false} />
          <Text style={[type.subhead, { color: colors.muted }]}>{t('reminderTypes.reset')}</Text>
        </Pressable>
      </KeyboardDismissScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconHit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBlock: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 17,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paletteHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelChip: {
    alignSelf: 'center',
  },
  resetHit: {
    minHeight: 44,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
});
