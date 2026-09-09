import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import {
  categoryChildren,
  describeCategoryPath,
  isCreditCardPath,
  listTopCategories,
  makeCategoryPath,
} from '../../model/reminders/categories';
import { resolveReminderTypes } from '../../model/reminders/reminderTypes';
import { blankReminderDraft, reminderToDraft, recurrenceForType, defaultTitleForKind, monthlyForAnchor, monthAnchorFrom } from '../../model/reminders/defaults';
import { REMINDER_KINDS, REMINDER_PRIORITIES, RECURRENCE_TYPES, type ReminderDraft, type RecurrenceType, type Weekday, type MonthAnchor } from '../../model/reminders/Reminder';
import { resolveClockHourFormat } from '../../model/settings/AppSettings';
import { nextFireAt } from '../../model/reminders/nextFire';
import {
  dateFromDayKey,
  dateFromDayOfMonth,
  dateFromMonthDay,
  dayKeyFromDate,
  dayOfMonthFromDate,
  monthDayFromDate,
} from '../../controller/dateFieldValue';
import { formatNextDay, formatTimeOfDay } from '../../utils/dateUtils';
import { appHref, leaveScreen } from '../../utils/navigation';
import { hapticSuccess } from '../../utils/haptics';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '../components/Chip';
import { DateField } from '../components/DateField';
import { GlassSurface } from '../components/GlassSurface';
import { KeyboardDismissScrollView } from '../components/KeyboardDismissScrollView';
import { NumberStepper } from '../components/NumberStepper';
import { PrimaryButton } from '../components/PrimaryButton';
import { reminderTypeTextProps, reminderTypeTextStyle } from '../components/scalableLabel';
import { iconForReminderType, iconForType, reminderTypeLabel, typeA11yLabel } from '../icons/typeIcons';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SectionActionButton } from '../components/SectionActionButton';
import { TimeWheels } from '../components/TimeWheels';
import { formatReminderSchedule, weekdayShort, useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { fonts, insetSurface } from '../theme/tokens';

const SIMPLE_RECURRENCE: RecurrenceType[] = ['once', 'daily', 'weekly', 'monthly', 'yearly'];

const MONTHLY_ANCHORS: MonthAnchor[] = ['date', 'start', 'end'];

function recurrenceKey(type: RecurrenceType): string {
  if (type === 'every-n-days') {
    return 'reminder.everyNDays';
  }
  if (type === 'every-n-weeks') {
    return 'reminder.everyNWeeks';
  }
  if (type === 'every-n-months') {
    return 'reminder.everyNMonths';
  }
  return `reminder.${type}`;
}

function monthlyChipKey(id: MonthAnchor): string {
  if (id === 'start') {
    return 'reminder.monthlyStart';
  }
  if (id === 'end') {
    return 'reminder.monthlyEnd';
  }
  return 'reminder.monthlyThisDate';
}

function isEveryN(type: RecurrenceType): boolean {
  return type === 'every-n-days' || type === 'every-n-weeks' || type === 'every-n-months';
}

/**
 * Purpose: create/edit a reminder — templates first, then only the fields she needs.
 * Inputs: route id (`new` or reminder id); reminder context.
 * Outputs: Ionicons template cards (icon + short word), then a short form; Every-N / priority / category stay under More options.
 * Side effects: persist reminder. Optional “Log this as a spend” opens the spend form only.
 * Design decisions: template cells are 48% with minWidth 0 (no gap-on-percentage overflow);
 *   type/kind/category chips are 44pt icon-only Ionicons (a11y still says Car / 按揭); recurrence stays text.
 *   Time is two equal 3-row wheels (HOUR | MINUTE). Minutes persist on the draft. One preview
 *   line includes minutes. Next-fire is a footnote under the date, never stacked in the wheels.
 *   Monthly adds This date / Start of month / End of month chips (Yearly stays month+day).
 */
export function ReminderEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new' || !id;
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { reminders, listTemplates, applyTemplate, createReminder, updateReminder, deleteReminder } = useReminders();
  const { settings } = useSettings();
  const { t, intlLocale } = useI18n();
  const clock = resolveClockHourFormat(settings);
  const hour12 = clock === '12h';
  const existing = !isNew ? reminders.find((item) => item.id === id) : undefined;

  const [step, setStep] = useState<'template' | 'form'>(isNew ? 'template' : 'form');
  const [draft, setDraft] = useState<ReminderDraft>(() =>
    existing ? reminderToDraft(existing) : blankReminderDraft(),
  );
  const [saving, setSaving] = useState(false);
  const [moreOptions, setMoreOptions] = useState(() => Boolean(existing && isEveryN(existing.recurrence.type)));

  const preview = useMemo(
    () =>
      nextFireAt(
        { ...draft, id: 'preview', anchorAt: existing?.anchorAt ?? new Date().toISOString(), createdAt: '', updatedAt: '' },
        new Date(),
      ),
    [draft, existing],
  );

  const pickTemplate = (templateId: string) => {
    if (templateId === 'credit-card') {
      router.replace(appHref('/reminders/card/new'));
      return;
    }
    setDraft(applyTemplate(templateId));
    setMoreOptions(false);
    setStep('form');
  };

  const save = async () => {
    setSaving(true);
    if (isNew) {
      await createReminder(draft);
    } else if (id) {
      await updateReminder(id, draft);
    }
    await hapticSuccess();
    router.back();
  };

  const logPayment = async () => {
    if (!id || isNew) {
      return;
    }
    router.push(`/expense/new?reminderId=${id}`);
  };

  if (step === 'template') {
    const templates = listTemplates();
    return (
      <ScreenScaffold>
        <ScreenHeader title={t('reminder.whatRemind')} onBack={() => leaveScreen(router)} />
        <KeyboardDismissScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        >
          <Text style={[styles.lede, { color: colors.muted }]}>{t('reminder.pickCard')}</Text>
          <View style={styles.tplGrid}>
            {templates.map((template) => (
              <Pressable
                key={template.id}
                onPress={() => pickTemplate(template.id)}
                style={styles.tplCell}
                accessibilityRole="button"
                accessibilityLabel={typeA11yLabel(t, template.id, template.label)}
              >
                <GlassSurface style={styles.tpl} radius={22}>
                  <Ionicons name={iconForType(template.id)} size={28} color={colors.accent} />
                  <Text
                    style={[styles.tplTitle, reminderTypeTextStyle, { color: colors.ink }]}
                    {...reminderTypeTextProps(2)}
                  >
                    {typeA11yLabel(t, template.id, template.label)}
                  </Text>
                </GlassSurface>
              </Pressable>
            ))}
          </View>
        </KeyboardDismissScrollView>
      </ScreenScaffold>
    );
  }

  /**
   * Purpose: confirm and permanently remove an existing reminder.
   * Inputs: none (closes over route id).
   * Outputs: none.
   * Side effects: delete persistence + navigate back after confirm.
   */
  const onDelete = () => {
    const run = () => void deleteReminder(id!).then(() => router.back());
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(t('reminder.deleteTitle'))) {
        run();
      }
      return;
    }
    Alert.alert(t('reminder.deleteTitle'), t('reminder.deleteBody'), [
      { text: t('reminder.keep'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: run },
    ]);
  };

  const reminderTypes = resolveReminderTypes(settings);
  const topNodes = listTopCategories(reminderTypes);
  const subNodes = categoryChildren(draft.categoryPath.top);
  const typeNodes = draft.categoryPath.subcategory ? categoryChildren(draft.categoryPath.subcategory) : [];
  const visibleRecurrence = moreOptions ? RECURRENCE_TYPES : SIMPLE_RECURRENCE;
  const monthlyAnchor = monthAnchorFrom(draft.recurrence);
  const nextFootnote = preview ? (
    <Text style={[styles.footnote, { color: colors.muted }]}>
      {t('reminder.next', {
        when: formatNextDay(preview, new Date(), intlLocale, {
          today: t('date.today'),
          tomorrow: t('date.tomorrow'),
        }),
      })}
    </Text>
  ) : null;
  const nextUnderDate =
    draft.recurrence.type === 'once' ||
    draft.recurrence.type === 'weekly' ||
    draft.recurrence.type === 'monthly' ||
    draft.recurrence.type === 'yearly';

  return (
    <ScreenScaffold>
      <ScreenHeader
        title={isNew ? t('reminder.whatRemind') : draft.title || t('reminder.remindMe')}
        onBack={() => (isNew ? setStep('template') : leaveScreen(router))}
        trailingIcon={!isNew ? 'trash-outline' : undefined}
        trailingLabel={!isNew ? t('common.delete') : undefined}
        trailingTone="danger"
        onTrailing={!isNew ? onDelete : undefined}
      />
      <KeyboardDismissScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        <TextInput
          value={draft.title}
          onChangeText={(title) => setDraft({ ...draft, title })}
          placeholder={t('reminder.placeholderTitle')}
          placeholderTextColor={colors.faint}
          underlineColorAndroid="transparent"
          style={[styles.titleInput, { color: colors.ink }]}
        />
        <TextInput
          value={draft.note}
          onChangeText={(note) => setDraft({ ...draft, note })}
          placeholder={t('reminder.placeholderNote')}
          placeholderTextColor={colors.faint}
          underlineColorAndroid="transparent"
          style={[insetSurface(colors, 16), styles.note, { color: colors.ink }]}
          multiline
        />

        <Text style={[styles.label, { color: colors.faint }]}>{t('reminder.when')}</Text>
        <View style={styles.wrap}>
          {visibleRecurrence.map((type) => (
            <Chip
              key={type}
              label={t(recurrenceKey(type))}
              selected={draft.recurrence.type === type}
              onPress={() => setDraft({ ...draft, recurrence: recurrenceForType(type, draft.recurrence) })}
            />
          ))}
        </View>
        {draft.recurrence.type === 'once' ? (
          <>
            <DateField
              label={t('reminder.date')}
              value={dateFromDayKey(draft.recurrence.dayKey)}
              onChange={(next) => setDraft({ ...draft, recurrence: { type: 'once', dayKey: dayKeyFromDate(next) } })}
            />
            {nextFootnote}
          </>
        ) : null}
        {draft.recurrence.type === 'weekly' ? (
          <>
            <View style={styles.wrap}>
              {([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((day) => {
                const selected = draft.recurrence.type === 'weekly' && draft.recurrence.weekdays.includes(day);
                return (
                  <Chip
                    key={day}
                    label={weekdayShort(day, intlLocale)}
                    selected={selected}
                    onPress={() => {
                      if (draft.recurrence.type !== 'weekly') {
                        return;
                      }
                      const weekdays = selected
                        ? draft.recurrence.weekdays.filter((item) => item !== day)
                        : [...draft.recurrence.weekdays, day];
                      setDraft({ ...draft, recurrence: { type: 'weekly', weekdays } });
                    }}
                  />
                );
              })}
            </View>
            {nextFootnote}
          </>
        ) : null}
        {draft.recurrence.type === 'monthly' ? (
          <View style={styles.col}>
            <View style={styles.wrap}>
              {MONTHLY_ANCHORS.map((item) => (
                <Chip
                  key={item}
                  label={t(monthlyChipKey(item))}
                  selected={monthlyAnchor === item}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      recurrence: monthlyForAnchor(
                        item,
                        draft.recurrence.type === 'monthly' ? draft.recurrence.dayOfMonth : new Date().getDate(),
                      ),
                    })
                  }
                />
              ))}
            </View>
            <Text style={[styles.helper, { color: colors.muted }]}>{t('reminder.monthlyHelper')}</Text>
            {monthlyAnchor === 'date' ? (
              <DateField
                label={t('reminder.dayEachMonth')}
                display="dayOfMonth"
                value={dateFromDayOfMonth(draft.recurrence.dayOfMonth)}
                onChange={(next) =>
                  setDraft({ ...draft, recurrence: monthlyForAnchor('date', dayOfMonthFromDate(next)) })
                }
              />
            ) : null}
            {nextFootnote}
          </View>
        ) : null}
        {draft.recurrence.type === 'yearly' ? (
          <>
            <DateField
              label={t('reminder.monthAndDay')}
              display="monthDay"
              value={dateFromMonthDay(draft.recurrence.month, draft.recurrence.day)}
              onChange={(next) => {
                const { month, day } = monthDayFromDate(next);
                setDraft({ ...draft, recurrence: { type: 'yearly', month, day } });
              }}
            />
            {nextFootnote}
          </>
        ) : null}
        {moreOptions && draft.recurrence.type === 'every-n-days' ? (
          <NumberStepper
            label={t('reminder.everyNDays')}
            value={draft.recurrence.interval}
            min={1}
            max={60}
            onChange={(interval) => setDraft({ ...draft, recurrence: { type: 'every-n-days', interval } })}
          />
        ) : null}
        {moreOptions && draft.recurrence.type === 'every-n-weeks' ? (
          <View style={styles.col}>
            <NumberStepper
              label={t('reminder.everyNWeeks')}
              value={draft.recurrence.interval}
              min={1}
              max={12}
              onChange={(interval) =>
                setDraft({
                  ...draft,
                  recurrence:
                    draft.recurrence.type === 'every-n-weeks'
                      ? { type: 'every-n-weeks', interval, weekday: draft.recurrence.weekday }
                      : draft.recurrence,
                })
              }
            />
            <View style={styles.wrap}>
              {([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((day) => (
                <Chip
                  key={day}
                  label={weekdayShort(day, intlLocale)}
                  selected={draft.recurrence.type === 'every-n-weeks' && draft.recurrence.weekday === day}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      recurrence: {
                        type: 'every-n-weeks',
                        interval: draft.recurrence.type === 'every-n-weeks' ? draft.recurrence.interval : 2,
                        weekday: day,
                      },
                    })
                  }
                />
              ))}
            </View>
          </View>
        ) : null}
        {moreOptions && draft.recurrence.type === 'every-n-months' ? (
          <View style={styles.col}>
            <NumberStepper
              label={t('reminder.everyNMonths')}
              value={draft.recurrence.interval}
              min={1}
              max={24}
              onChange={(interval) =>
                setDraft({
                  ...draft,
                  recurrence:
                    draft.recurrence.type === 'every-n-months'
                      ? { type: 'every-n-months', interval, dayOfMonth: draft.recurrence.dayOfMonth }
                      : draft.recurrence,
                })
              }
            />
            <DateField
              label={t('reminder.dayEachMonth')}
              display="dayOfMonth"
              value={dateFromDayOfMonth(draft.recurrence.dayOfMonth)}
              onChange={(next) =>
                setDraft({
                  ...draft,
                  recurrence:
                    draft.recurrence.type === 'every-n-months'
                      ? { type: 'every-n-months', interval: draft.recurrence.interval, dayOfMonth: dayOfMonthFromDate(next) }
                      : draft.recurrence,
                })
              }
            />
          </View>
        ) : null}

        {!nextUnderDate ? nextFootnote : null}

        <View style={styles.timeBlock}>
          <TimeWheels
            hour={draft.hour}
            minute={draft.minute}
            onHourChange={(hour) => setDraft({ ...draft, hour })}
            onMinuteChange={(minute) => setDraft({ ...draft, minute })}
          />
          <Text style={[styles.preview, { color: colors.ink }]}>
            {formatReminderSchedule(
              draft.recurrence,
              formatTimeOfDay(draft.hour, draft.minute, hour12, intlLocale),
              t,
              intlLocale,
            )}
          </Text>
        </View>

        <GlassSurface style={styles.enabled} radius={20}>
          <Text style={[styles.enabledLabel, { color: colors.ink }]} numberOfLines={2}>
            {t('reminder.remindMe')}
          </Text>
          <Switch
            accessibilityLabel={t('reminder.remindMe')}
            value={draft.enabled}
            onValueChange={(enabled) => setDraft({ ...draft, enabled })}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor={colors.scheme === 'dark' ? '#E4DDD4' : '#FFF8F2'}
          />
        </GlassSurface>

        {moreOptions ? (
          <>
            <Text style={[styles.label, { color: colors.faint }]}>{t('reminder.reminderKindLabel')}</Text>
            <View style={styles.wrap}>
              {REMINDER_KINDS.map((kind) => (
                <Chip
                  key={kind}
                  icon={iconForType(kind)}
                  label={typeA11yLabel(t, kind)}
                  selected={draft.kind === kind}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      kind,
                      title: draft.title && draft.title !== defaultTitleForKind(draft.kind) ? draft.title : defaultTitleForKind(kind),
                    })
                  }
                />
              ))}
            </View>

            <Text style={[styles.label, { color: colors.faint }]}>{t('reminder.importanceLabel')}</Text>
            <View style={styles.wrap}>
              {REMINDER_PRIORITIES.map((priority) => (
                <Chip
                  key={priority}
                  label={t(`reminder.priority${priority.charAt(0).toUpperCase()}${priority.slice(1)}`)}
                  selected={draft.priority === priority}
                  onPress={() => setDraft({ ...draft, priority })}
                />
              ))}
            </View>

            <Text style={[styles.label, { color: colors.faint }]}>{t('reminder.groupLabel')}</Text>
            <View style={styles.wrap}>
              {topNodes.map((node) => (
                <Chip
                  key={node.id}
                  icon={iconForReminderType(node.id, reminderTypes)}
                  label={reminderTypeLabel(t, node.id, reminderTypes)}
                  selected={draft.categoryPath.top === node.id}
                  onPress={() => setDraft({ ...draft, categoryPath: makeCategoryPath(node.id) })}
                />
              ))}
            </View>
            {subNodes.length > 0 ? (
              <View style={styles.wrap}>
                {subNodes.map((node) => (
                  <Chip
                    key={node.id}
                    icon={iconForType(node.id)}
                    label={typeA11yLabel(t, node.id, node.label)}
                    selected={draft.categoryPath.subcategory === node.id}
                    onPress={() => {
                      if (node.id === 'credit-card' && isNew) {
                        router.replace(appHref('/reminders/card/new'));
                        return;
                      }
                      setDraft({ ...draft, categoryPath: makeCategoryPath(draft.categoryPath.top, node.id) });
                    }}
                  />
                ))}
              </View>
            ) : null}
            {typeNodes.length > 0 ? (
              <View style={styles.wrap}>
                {typeNodes.map((node) => (
                  <Chip
                    key={node.id}
                    icon={iconForType(node.id)}
                    label={typeA11yLabel(t, node.id, node.label)}
                    selected={draft.categoryPath.type === node.id}
                    onPress={() =>
                      setDraft({
                        ...draft,
                        categoryPath: makeCategoryPath(draft.categoryPath.top, draft.categoryPath.subcategory, node.id),
                      })
                    }
                  />
                ))}
              </View>
            ) : null}
            <Text style={[styles.kicker, reminderTypeTextStyle, { color: colors.faint }]} {...reminderTypeTextProps(2)}>
              {describeCategoryPath(draft.categoryPath, reminderTypes)}
            </Text>
          </>
        ) : (
          <SectionActionButton
            icon="options-outline"
            label={t('reminder.moreOptions')}
            tone="muted"
            onPress={() => setMoreOptions(true)}
            style={styles.blockAction}
          />
        )}

        {!isNew && isCreditCardPath(draft.categoryPath) && draft.accountId ? (
          <SectionActionButton
            icon="card-outline"
            label={t('reminder.editCard')}
            onPress={() => router.push(appHref(`/reminders/card/${draft.accountId}`))}
            style={styles.blockAction}
          />
        ) : null}
        {!isNew ? (
          <SectionActionButton
            icon="wallet-outline"
            label={t('reminder.logSpend')}
            onPress={() => void logPayment()}
            style={styles.blockAction}
          />
        ) : null}

        <PrimaryButton
          icon="checkmark-circle-outline"
          label={saving ? t('common.saving') : t('reminder.saveReminder')}
          onPress={() => void save()}
          disabled={saving}
        />
      </KeyboardDismissScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, gap: 18 },
  lede: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  kicker: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.6 },
  titleInput: { fontFamily: fonts.display, fontSize: 28, minHeight: 48, borderBottomWidth: 0 },
  note: { fontFamily: fonts.body, fontSize: 16, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0 },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, marginTop: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%', alignItems: 'flex-start' },
  col: { gap: 12 },
  footnote: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: -4 },
  helper: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: -4 },
  timeBlock: { gap: 12 },
  preview: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 22 },
  tplGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  tplCell: { width: '48%', minWidth: 0, maxWidth: '48%' },
  tpl: { padding: 16, gap: 8, minHeight: 112, justifyContent: 'center', width: '100%' },
  tplTitle: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 21, width: '100%' },
  enabled: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, gap: 12, marginTop: 4 },
  enabledLabel: { fontFamily: fonts.bodySemi, fontSize: 16, lineHeight: 22, flex: 1, minWidth: 0 },
  blockAction: { alignSelf: 'flex-start', maxWidth: '100%' },
});
