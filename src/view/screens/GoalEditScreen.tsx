import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGoals } from '../../controller/GoalProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { dateFromDayKey, dayKeyFromDate } from '../../controller/dateFieldValue';
import {
  GOAL_STATUSES,
  blankGoalDraft,
  goalToDraft,
  isGoalDraftValid,
  type GoalDraft,
  type GoalStatus,
} from '../../model/goals/Goal';
import { hapticSuccess } from '../../utils/haptics';
import { leaveScreen } from '../../utils/navigation';
import { Chip } from '../components/Chip';
import { DateField } from '../components/DateField';
import { FormCard, FormCardGroup } from '../components/FormCardGroup';
import { TextButton } from '../components/TextButton';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { useTypography } from '../theme/TypographyProvider';
import { fonts, insetSurface } from '../theme/tokens';

/**
 * Purpose: create or edit a Goal — title, why, date, optional metric, optional linked habits.
 * Inputs: route id (`new` or Goal id); GoalProvider; ReminderProvider for link chips only.
 * Outputs: FormCardGroup; persist via thin GoalController.
 * Side effects: create/update/delete Goal JSON.
 * Design decisions: reminder schema is unchanged; links live on the Goal as ids.
 *   Progress math stays in Model; this screen only collects facts.
 */
export function GoalEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new' || !id;
  const { t } = useI18n();
  const colors = useThemeColors();
  const { type, scaleFontSize } = useTypography();
  const router = useRouter();
  const { goals, createGoal, updateGoal, deleteGoal } = useGoals();
  const { reminders } = useReminders();
  const existing = !isNew ? goals.find((item) => item.id === id) : undefined;
  const [draft, setDraft] = useState<GoalDraft>(() => (existing ? goalToDraft(existing) : blankGoalDraft()));
  const [trackMetric, setTrackMetric] = useState(() => Boolean(existing?.metric));
  const [targetText, setTargetText] = useState(() =>
    existing?.metric ? String(existing.metric.target) : '',
  );
  const [currentText, setCurrentText] = useState(() =>
    existing?.metric ? String(existing.metric.current) : '0',
  );
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(Boolean(existing));

  useEffect(() => {
    if (hydrated || !existing) {
      return;
    }
    setDraft(goalToDraft(existing));
    setTrackMetric(Boolean(existing.metric));
    setTargetText(existing.metric ? String(existing.metric.target) : '');
    setCurrentText(existing.metric ? String(existing.metric.current) : '0');
    setHydrated(true);
  }, [existing, hydrated]);

  const linkable = useMemo(
    () => reminders.filter((item) => !item.accountId),
    [reminders],
  );

  const prepared: GoalDraft = {
    ...draft,
    metric: trackMetric
      ? {
          target: parseMetricNumber(targetText),
          current: parseMetricNumber(currentText),
          unit: draft.metric?.unit ?? '',
        }
      : undefined,
  };
  const canSave = isGoalDraftValid(prepared) && !saving;
  const fieldFont = scaleFontSize(16);
  const sectionLabelStyle = [
    styles.sectionLabel,
    type.footnote,
    { color: colors.muted, fontSize: scaleFontSize(13) },
  ];

  const patch = (partial: Partial<GoalDraft>) => setDraft((prev) => ({ ...prev, ...partial }));

  const toggleLink = (reminderId: string) => {
    const has = draft.linkedReminderIds.includes(reminderId);
    patch({
      linkedReminderIds: has
        ? draft.linkedReminderIds.filter((item) => item !== reminderId)
        : [...draft.linkedReminderIds, reminderId],
    });
  };

  const save = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        await updateGoal(existing.id, prepared);
      } else {
        await createGoal(prepared);
      }
      await hapticSuccess();
      leaveScreen(router);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!existing) {
      return;
    }
    const run = async () => {
      await deleteGoal(existing.id);
      leaveScreen(router);
    };
    Alert.alert(t('goals.deleteTitle'), t('goals.deleteBody'), [
      { text: t('common.keep'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void run() },
    ]);
  };

  return (
    <FormCardGroup
      title={isNew || !existing ? t('goals.newTitle') : t('goals.editTitle')}
      headerTrailingIcon="checkmark"
      headerTrailingLabel={saving ? t('goals.saving') : t('goals.save')}
      onHeaderTrailing={() => void save()}
      headerTrailingDisabled={!canSave}
      stickyButtonLabel={saving ? t('goals.saving') : t('goals.save')}
      onStickyButtonPress={() => void save()}
      stickyButtonDisabled={!canSave}
      stickyButtonBusy={saving}
    >
      <FormCard>
        <Text style={sectionLabelStyle}>{t('goals.titleLabel')}</Text>
        <TextInput
          value={draft.title}
          onChangeText={(title) => patch({ title })}
          placeholder={t('goals.titlePlaceholder')}
          placeholderTextColor={colors.faint}
          style={[
            insetSurface(colors, 14),
            styles.field,
            { color: colors.ink, fontSize: fieldFont, lineHeight: Math.round(fieldFont * 1.35) },
          ]}
          returnKeyType="next"
        />
        <Text style={sectionLabelStyle}>{t('goals.whyLabel')}</Text>
        <TextInput
          value={draft.why}
          onChangeText={(why) => patch({ why })}
          placeholder={t('goals.whyPlaceholder')}
          placeholderTextColor={colors.faint}
          style={[
            insetSurface(colors, 14),
            styles.field,
            styles.why,
            { color: colors.ink, fontSize: fieldFont, lineHeight: Math.round(fieldFont * 1.35) },
          ]}
          multiline
        />
        <DateField
          label={t('goals.targetDate')}
          value={dateFromDayKey(draft.targetDate)}
          onChange={(next) => patch({ targetDate: dayKeyFromDate(next) })}
        />
      </FormCard>

      <FormCard>
        <Text style={sectionLabelStyle}>{t('goals.status')}</Text>
        <View style={styles.wrap}>
          {GOAL_STATUSES.map((status) => (
            <Chip
              key={status}
              label={statusLabel(t, status)}
              selected={draft.status === status}
              onPress={() => patch({ status })}
            />
          ))}
        </View>
      </FormCard>

      <FormCard>
        <Chip
          label={t('goals.trackNumber')}
          selected={trackMetric}
          onPress={() => setTrackMetric((prev) => !prev)}
        />
        {trackMetric ? (
          <View style={styles.metricBlock}>
            <View style={styles.metricRow}>
              <View style={styles.metricField}>
                <Text style={sectionLabelStyle}>{t('goals.metricCurrent')}</Text>
                <TextInput
                  value={currentText}
                  onChangeText={setCurrentText}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.faint}
                  style={[insetSurface(colors, 14), styles.field, { color: colors.ink, fontSize: fieldFont }]}
                />
              </View>
              <View style={styles.metricField}>
                <Text style={sectionLabelStyle}>{t('goals.metricTarget')}</Text>
                <TextInput
                  value={targetText}
                  onChangeText={setTargetText}
                  keyboardType="decimal-pad"
                  placeholder="10"
                  placeholderTextColor={colors.faint}
                  style={[insetSurface(colors, 14), styles.field, { color: colors.ink, fontSize: fieldFont }]}
                />
              </View>
            </View>
            <Text style={sectionLabelStyle}>{t('goals.metricUnit')}</Text>
            <TextInput
              value={draft.metric?.unit ?? ''}
              onChangeText={(unit) =>
                patch({
                  metric: {
                    target: parseMetricNumber(targetText),
                    current: parseMetricNumber(currentText),
                    unit,
                  },
                })
              }
              placeholder={t('goals.metricUnitPlaceholder')}
              placeholderTextColor={colors.faint}
              style={[insetSurface(colors, 14), styles.field, { color: colors.ink, fontSize: fieldFont }]}
            />
          </View>
        ) : null}
      </FormCard>

      <FormCard>
        <Text style={sectionLabelStyle}>{t('goals.linkHabits')}</Text>
        {linkable.length === 0 ? (
          <Text style={[type.footnote, { color: colors.muted }]}>{t('goals.linkHabitsEmpty')}</Text>
        ) : (
          <>
            <Text style={[type.footnote, { color: colors.muted }]}>{t('goals.linkHabitsHint')}</Text>
            <View style={styles.wrap}>
              {linkable.map((item) => (
                <Chip
                  key={item.id}
                  label={item.title}
                  selected={draft.linkedReminderIds.includes(item.id)}
                  onPress={() => toggleLink(item.id)}
                />
              ))}
            </View>
          </>
        )}
      </FormCard>

      {existing ? (
        <View style={styles.deleteWrap}>
          <TextButton label={t('goals.delete')} tone="danger" onPress={confirmDelete} />
        </View>
      ) : null}
    </FormCardGroup>
  );
}

function statusLabel(t: (key: string) => string, status: GoalStatus): string {
  if (status === 'paused') {
    return t('goals.statusPaused');
  }
  if (status === 'done') {
    return t('goals.statusDone');
  }
  return t('goals.statusActive');
}

function parseMetricNumber(raw: string): number {
  const parsed = Number(raw.replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  field: {
    fontFamily: fonts.body,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
  },
  why: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    alignItems: 'flex-start',
  },
  metricBlock: {
    gap: 10,
    marginTop: 8,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricField: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  deleteWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});
