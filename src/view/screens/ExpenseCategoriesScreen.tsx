import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../../controller/SettingsProvider';
import {
  activeExpenseCategories,
  addCustomExpenseCategory,
  EXPENSE_CATEGORY_ICON_CHOICES,
  moveExpenseCategory,
  removeExpenseCategory,
  resetExpenseCategories,
  resolveExpenseCategories,
  type ExpenseCategoryIconName,
} from '../../model/finance/expenseCategories';
import { Chip } from '../components/Chip';
import { GroupedRow, GroupedSection } from '../components/GroupedList';
import { KeyboardDismissScrollView } from '../components/KeyboardDismissScrollView';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { expenseCategoryLabel, TYPE_ICON_SIZE, type TypeIconName } from '../icons/typeIcons';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface } from '../theme/tokens';
import { type } from '../theme/typography';

/**
 * Purpose: You → Money → Expense categories — add, hide, reorder spend types on-device.
 * Inputs: settings.expenseCategories; mutator setExpenseCategories.
 * Outputs: ScreenHeader + neumorph GroupedRow list + primary Add / quiet Reset footer.
 * Side effects: persists AppSettings via SettingsController; soft-hides builtins so old spends stay safe.
 * Design decisions: matches Reminder types chrome (header, ≥52pt rows, full-width primary,
 *   centered muted reset); custom rows show “Custom”; builtins stay title-only.
 */
export function ExpenseCategoriesScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { settings, setExpenseCategories } = useSettings();
  const catalog = useMemo(() => resolveExpenseCategories(settings), [settings]);
  const active = useMemo(() => activeExpenseCategories(catalog), [catalog]);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<ExpenseCategoryIconName>('cafe-outline');
  const [saving, setSaving] = useState(false);

  const persist = async (next: typeof catalog) => {
    setSaving(true);
    try {
      await setExpenseCategories(next);
    } finally {
      setSaving(false);
    }
  };

  const onAdd = () => {
    if (!name.trim() || saving) {
      return;
    }
    void persist(addCustomExpenseCategory(catalog, name, icon));
    setName('');
    setIcon('cafe-outline');
  };

  const onDelete = (id: string, builtin?: boolean) => {
    if (id === 'other') {
      return;
    }
    const run = () => {
      void persist(removeExpenseCategory(catalog, id, !builtin));
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(t('money.categoriesRemoveBody'))) {
        run();
      }
      return;
    }
    Alert.alert(t('money.categoriesRemoveTitle'), t('money.categoriesRemoveBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('money.categoriesRemove'), style: 'destructive', onPress: run },
    ]);
  };

  const onReset = () => {
    const run = () => {
      void persist(resetExpenseCategories());
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(t('money.categoriesResetBody'))) {
        run();
      }
      return;
    }
    Alert.alert(t('money.categoriesResetTitle'), t('money.categoriesResetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('money.categoriesReset'), onPress: run },
    ]);
  };

  return (
    <ScreenScaffold>
      <ScreenHeader title={t('money.categoriesTitle')} />
      <KeyboardDismissScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[type.subhead, { color: colors.muted }]}>{t('money.categoriesLede')}</Text>

        <GroupedSection header={t('money.categoriesActive')} footer={t('money.categoriesActiveFooter')}>
          {active.map((row, index) => {
            const label = expenseCategoryLabel(t, row.id, catalog);
            return (
              <GroupedRow
                key={row.id}
                leading={
                  <Ionicons
                    name={row.icon as TypeIconName}
                    size={TYPE_ICON_SIZE}
                    color={colors.ink}
                    accessible={false}
                  />
                }
                title={label}
                subtitle={row.builtin ? undefined : t('money.categoriesCustom')}
                accessory={
                  <View style={styles.catActions}>
                    <Pressable
                      onPress={() => void persist(moveExpenseCategory(catalog, row.id, 'up'))}
                      disabled={index === 0 || saving}
                      style={styles.iconHit}
                      accessibilityRole="button"
                      accessibilityLabel={t('money.categoriesMoveUp')}
                    >
                      <Ionicons name="chevron-up" size={20} color={index === 0 ? colors.faint : colors.ink} />
                    </Pressable>
                    <Pressable
                      onPress={() => void persist(moveExpenseCategory(catalog, row.id, 'down'))}
                      disabled={index >= active.length - 1 || saving}
                      style={styles.iconHit}
                      accessibilityRole="button"
                      accessibilityLabel={t('money.categoriesMoveDown')}
                    >
                      <Ionicons
                        name="chevron-down"
                        size={20}
                        color={index >= active.length - 1 ? colors.faint : colors.ink}
                      />
                    </Pressable>
                    {row.id !== 'other' ? (
                      <Pressable
                        onPress={() => onDelete(row.id, row.builtin)}
                        disabled={saving}
                        style={styles.iconHit}
                        accessibilityRole="button"
                        accessibilityLabel={t('money.categoriesRemove')}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.danger} />
                      </Pressable>
                    ) : (
                      <View style={styles.iconHit} />
                    )}
                  </View>
                }
              />
            );
          })}
        </GroupedSection>

        <GroupedSection header={t('money.categoriesAdd')}>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>{t('money.categoriesName')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('money.categoriesNamePlaceholder')}
              placeholderTextColor={colors.faint}
              style={[insetSurface(colors, 12), styles.input, { color: colors.ink }]}
              maxLength={32}
              returnKeyType="done"
              onSubmitEditing={onAdd}
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>{t('money.categoriesIcon')}</Text>
            <View style={styles.iconWrap}>
              {EXPENSE_CATEGORY_ICON_CHOICES.map((choice) => (
                <Chip
                  key={choice}
                  icon={choice as TypeIconName}
                  label={choice.replace(/-outline$/, '')}
                  selected={icon === choice}
                  onPress={() => setIcon(choice)}
                />
              ))}
            </View>
          </View>
          <View style={styles.addPad}>
            <PrimaryButton
              icon="add"
              label={t('money.categoriesAddButton')}
              onPress={onAdd}
              disabled={!name.trim() || saving}
            />
          </View>
        </GroupedSection>

        <Pressable
          onPress={onReset}
          accessibilityRole="button"
          accessibilityLabel={t('money.categoriesReset')}
          style={styles.resetHit}
        >
          <Ionicons name="refresh-outline" size={18} color={colors.muted} accessible={false} />
          <Text style={[type.subhead, { color: colors.muted }]}>{t('money.categoriesReset')}</Text>
        </Pressable>

        <Text style={[styles.hint, { color: colors.faint }]}>{t('money.categoriesHint')}</Text>
      </KeyboardDismissScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 16 },
  hint: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, paddingHorizontal: 4, textAlign: 'center' },
  catActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  fieldLabel: { fontFamily: fonts.bodySemi, fontSize: 13 },
  input: {
    fontFamily: fonts.body,
    fontSize: 17,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  iconWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  addPad: { paddingHorizontal: 16, paddingBottom: 14 },
  resetHit: {
    minHeight: 44,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
