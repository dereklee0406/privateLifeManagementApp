import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../../controller/FinanceProvider';
import { useReminders } from '../../controller/ReminderProvider';
import { useSettings } from '../../controller/SettingsProvider';
import {
  applyCalcKey,
  evaluateAmountExpression,
  isCompleteAmountExpression,
  type CalcKey,
} from '../../model/finance/amountCalculator';
import {
  formatFriendlyMoney,
  resolveExpenseCategories,
  type ExpenseCategory,
} from '../../model/finance/Expense';
import {
  quickAddHint,
  quickAddTemplates,
  suggestQuickAdd,
  type QuickAddTemplate,
} from '../../model/finance/quickAdd';
import { recentSpendActions, type RecentSpendAction } from '../../model/finance/recentSpends';
import { parseVoiceSpend } from '../../model/finance/voiceSpendParser';
import { hapticLight, hapticSuccess } from '../../utils/haptics';
import { localizeQuickAddTemplateLabel, useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { useTypography } from '../theme/TypographyProvider';
import { fonts, insetSurface, raisedAccent, raisedSurface } from '../theme/tokens';
import { expenseCategoryLabel, iconForExpenseCategory, type TypeIconName } from '../icons/typeIcons';
import { Chip } from './Chip';
import { PrimaryButton } from './PrimaryButton';
import { TypeIcon } from './TypeIcon';

/** Compact 3×4 amount keypad: digits + decimal + backspace (clear lives on the amount well). */
const KEYPAD_ROWS: CalcKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'back'],
];

type QuickSpendMode = 'instant' | 'keypad';

interface QuickSpendSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Purpose: same-fingerprint helper so Recent chips do not repeat Smart Suggestion / templates.
 * Inputs: amount, currency, category from any quick-spend source.
 * Outputs: stable string key for Set lookups.
 * Side effects: none.
 */
function spendFingerprint(amount: number, currency: string, category: ExpenseCategory): string {
  return `${category}|${amount}|${currency}`;
}

/**
 * Purpose: drop Recent chips that already appear as Smart Suggestion or One-Tap Templates.
 * Inputs: recents list, optional smart suggestion fingerprint, template fingerprints.
 * Outputs: filtered recent actions (order preserved).
 * Side effects: none.
 */
function dedupeRecents(
  recents: RecentSpendAction[],
  occupied: Set<string>,
): RecentSpendAction[] {
  return recents.filter(
    (item) => !occupied.has(spendFingerprint(item.amount, item.currency, item.category)),
  );
}

/**
 * Purpose: bottom-sheet modal for ultra-fast spend logging, opened from Home FAB or Money.
 * Inputs: visible flag + onClose; Finance (expenses, createQuickExpense, createVoiceExpense),
 *   Reminders (creditCards), Settings (default currency, expense catalog).
 * Outputs: two-mode sheet — Instant (Smart Suggestion, Templates, Recents, Voice) and
 *   Custom Keypad (amount well, labeled categories, compact pad, sticky Log CTA).
 * Side effects: createQuickExpense / createVoiceExpense via FinanceProvider (JSON write),
 *   hapticLight / hapticSuccess, brief "Logged" toast then auto-close.
 * Design decisions: segmented modes kill vertical bloat so the Log CTA stays on-screen;
 *   amount well mirrors AmountCalculatorField (right-aligned display + category pill);
 *   category chips use leadingIcon + label (never icon-only); recents dedupe against
 *   suggestion/templates; keys use raised→inset + scale 0.96 for tactile depression.
 *   Voice transcription uses OS dictation into TextInput — zero new native deps.
 */
export function QuickSpendSheet({ visible, onClose }: QuickSpendSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { scaleFontSize, fontScale } = useTypography();
  const { settings } = useSettings();
  const { expenses, createQuickExpense, createVoiceExpense } = useFinance();
  const { creditCards } = useReminders();

  const [mode, setMode] = useState<QuickSpendMode>('instant');
  const [amountExpr, setAmountExpr] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('dining');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceError, setVoiceError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const justEvaluated = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const expenseCatalog = useMemo(() => resolveExpenseCategories(settings), [settings]);
  const now = useMemo(() => new Date(), [visible, expenses.length]);
  const suggestion = useMemo(
    () => suggestQuickAdd(expenses, now, expenseCatalog),
    [expenses, now, expenseCatalog],
  );
  const recents = useMemo(() => recentSpendActions(expenses), [expenses]);
  const templates = useMemo(() => quickAddTemplates(settings.defaultCurrency), [settings.defaultCurrency]);
  const cardNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const card of creditCards) {
      map.set(card.id, card.name);
    }
    return map;
  }, [creditCards]);

  const occupiedFingerprints = useMemo(() => {
    const set = new Set<string>();
    if (suggestion.suggestedAmount !== undefined) {
      set.add(
        spendFingerprint(
          suggestion.suggestedAmount,
          suggestion.suggestedCurrency ?? settings.defaultCurrency,
          suggestion.category,
        ),
      );
    }
    for (const template of templates) {
      set.add(spendFingerprint(template.amount, template.currency, template.category));
    }
    return set;
  }, [suggestion, templates, settings.defaultCurrency]);

  const visibleRecents = useMemo(
    () => dedupeRecents(recents, occupiedFingerprints),
    [recents, occupiedFingerprints],
  );

  const parsedVoice = useMemo(() => parseVoiceSpend(voiceText), [voiceText]);
  const keypadReady = isCompleteAmountExpression(amountExpr);
  const categoryLabel = expenseCategoryLabel(t, category, expenseCatalog);
  const categoryIcon = iconForExpenseCategory(category, expenseCatalog);
  const logCtaLabel = keypadReady
    ? t('spend.logAmount', {
        amount: formatFriendlyMoney(evaluateAmountExpression(amountExpr), settings.defaultCurrency),
      })
    : t('spend.log');

  /** Reset all transient state each time the sheet opens; cancel a pending auto-close. */
  useEffect(() => {
    if (visible) {
      setMode('instant');
      setAmountExpr('');
      setCategory(suggestion.category);
      setVoiceOpen(false);
      setVoiceText('');
      setVoiceError(false);
      setBusy(false);
      setToast(null);
      justEvaluated.current = false;
    }
    return () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const templateLabel = (template: QuickAddTemplate): string => localizeQuickAddTemplateLabel(t, template);

  /** Show the confirmation toast, then close — she sees "Logged. Nice." before the sheet leaves. */
  const announceAndClose = () => {
    setToast(t('home.stripLogged'));
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      onClose();
    }, 750);
  };

  /** 1-tap log through the Controller (templates, smart suggestion, recents, keypad). */
  const logTemplate = async (template: QuickAddTemplate) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await createQuickExpense(template);
      await hapticSuccess();
      announceAndClose();
    } finally {
      setBusy(false);
    }
  };

  const onSmartSuggestionTap = () => {
    void hapticLight();
    if (suggestion.suggestedAmount !== undefined) {
      const label = expenseCategoryLabel(t, suggestion.category, expenseCatalog);
      void logTemplate({
        id: 'smart-default',
        label,
        amount: suggestion.suggestedAmount,
        currency: suggestion.suggestedCurrency ?? settings.defaultCurrency,
        category: suggestion.category,
        note: suggestion.lastExpense?.note ?? label,
        cardId: suggestion.suggestedCardId,
        icon: iconForExpenseCategory(suggestion.category, expenseCatalog),
      });
      return;
    }
    // No amount history yet — switch to keypad with the suggested category primed.
    setCategory(suggestion.category);
    setMode('keypad');
  };

  const onSelectMode = (next: QuickSpendMode) => {
    if (next === mode) {
      return;
    }
    void hapticLight();
    setMode(next);
  };

  const onKeypadKey = (key: CalcKey) => {
    void hapticLight();
    const next = applyCalcKey(amountExpr, key, justEvaluated.current);
    justEvaluated.current = next.justEvaluated;
    setAmountExpr(next.expression);
  };

  const onKeypadLog = () => {
    if (!keypadReady) {
      return;
    }
    const amount = evaluateAmountExpression(amountExpr);
    void logTemplate({
      id: 'keypad-custom',
      label: categoryLabel,
      amount,
      currency: settings.defaultCurrency,
      category,
      note: categoryLabel,
      icon: categoryIcon,
    });
  };

  const onVoiceLog = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setVoiceError(false);
    try {
      await createVoiceExpense(parsedVoice);
      await hapticSuccess();
      announceAndClose();
    } catch {
      // Model refuses to invent money — ask her to say/type an amount.
      setVoiceError(true);
    } finally {
      setBusy(false);
    }
  };

  const labelSize = scaleFontSize(13);
  const bodySize = scaleFontSize(15);
  const titleSize = scaleFontSize(20);
  const amountSize = scaleFontSize(36);
  const keySize = scaleFontSize(20);
  const modeLabelSize = scaleFontSize(13);
  const keyMinHeight = Math.min(48, Math.max(38, Math.round(42 * Math.min(fontScale, 1.2))));
  const wellActionIconSize = Math.min(22, Math.max(18, Math.round(20 * Math.min(fontScale, 1.2))));
  const smartAmountLabel =
    suggestion.suggestedAmount !== undefined
      ? formatFriendlyMoney(suggestion.suggestedAmount, suggestion.suggestedCurrency ?? settings.defaultCurrency)
      : null;
  const smartCardName = suggestion.suggestedCardId ? cardNameById.get(suggestion.suggestedCardId) : undefined;
  const smartCategoryLabel = expenseCategoryLabel(t, suggestion.category, expenseCatalog);

  const renderModeSegment = (value: QuickSpendMode, icon: TypeIconName, label: string) => {
    const selected = mode === value;
    return (
      <Pressable
        key={value}
        onPress={() => onSelectMode(value)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        style={({ pressed }) => [
          selected ? raisedSurface(colors, 14) : null,
          styles.modeSegment,
          {
            backgroundColor: selected ? colors.accentSoft : 'transparent',
            borderWidth: selected ? 1.5 : 0,
            borderColor: selected ? colors.accent : 'transparent',
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={16}
          color={selected ? colors.accent : colors.muted}
          accessible={false}
          importantForAccessibility="no"
        />
        <Text
          style={[
            styles.modeSegmentLabel,
            {
              color: selected ? colors.accent : colors.muted,
              fontSize: modeLabelSize,
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const renderInstantMode = () => (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.sectionLabel, { color: colors.accent, fontSize: labelSize }]}>
        {t('spend.smartSuggestion')}
      </Text>
      <Pressable
        onPress={onSmartSuggestionTap}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`${t('spend.smartSuggestion')}, ${smartCategoryLabel}${smartAmountLabel ? `, ${smartAmountLabel}` : ''}`}
        style={({ pressed }) => [
          raisedSurface(colors, 18),
          styles.smartCard,
          {
            backgroundColor: colors.accentSoft,
            opacity: busy ? 0.55 : pressed ? 0.85 : 1,
            transform: [{ scale: pressed && !busy ? 0.96 : 1 }],
          },
        ]}
      >
        <TypeIcon
          typeId={suggestion.category}
          icon={iconForExpenseCategory(suggestion.category, expenseCatalog)}
          color={colors.accent}
          accessibilityLabel={smartCategoryLabel}
        />
        <View style={styles.smartCopy}>
          <Text
            style={[
              styles.smartTitle,
              { color: colors.ink, fontSize: bodySize + 1, lineHeight: Math.round((bodySize + 1) * 1.35) },
            ]}
            numberOfLines={1}
          >
            {smartCategoryLabel}
            {smartAmountLabel ? ` · ${smartAmountLabel}` : ''}
          </Text>
          <Text
            style={[
              styles.smartMeta,
              { color: colors.muted, fontSize: labelSize, lineHeight: Math.round(labelSize * 1.35) },
            ]}
            numberOfLines={2}
          >
            {quickAddHint(suggestion, expenseCatalog)}
            {smartCardName ? ` · ${t('spend.paidWith')} ${smartCardName}` : ''}
          </Text>
        </View>
        <View style={[raisedAccent(colors, 16), styles.smartFlash]}>
          <Ionicons name="flash" size={16} color={colors.accentInk} accessible={false} importantForAccessibility="no" />
        </View>
      </Pressable>

      <Text style={[styles.sectionLabel, { color: colors.accent, fontSize: labelSize }]}>
        {t('spend.oneTapTemplates')}
      </Text>
      <View style={styles.templateGrid}>
        {templates.map((template) => (
          <Pressable
            key={template.id}
            onPress={() => {
              void hapticLight();
              void logTemplate(template);
            }}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`${templateLabel(template)}, ${formatFriendlyMoney(template.amount, template.currency)}`}
            style={({ pressed }) => [
              raisedSurface(colors, 18),
              styles.templateCard,
              {
                opacity: busy ? 0.55 : pressed ? 0.85 : 1,
                transform: [{ scale: pressed && !busy ? 0.96 : 1 }],
              },
            ]}
          >
            <Ionicons
              name={template.icon as TypeIconName}
              size={22}
              color={colors.accent}
              accessible={false}
              importantForAccessibility="no"
            />
            <Text
              style={[styles.templateLabel, { color: colors.ink, fontSize: labelSize + 1 }]}
              numberOfLines={1}
            >
              {templateLabel(template)}
            </Text>
            <Text
              style={[styles.templateAmount, { color: colors.muted, fontSize: labelSize }]}
              numberOfLines={1}
            >
              {formatFriendlyMoney(template.amount, template.currency)}
            </Text>
          </Pressable>
        ))}
      </View>

      {visibleRecents.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, { color: colors.accent, fontSize: labelSize }]}>
            {t('spend.recentSpends')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentRow}
          >
            {visibleRecents.map((item) => {
              const title = item.note.trim() || expenseCategoryLabel(t, item.category, expenseCatalog);
              const money = formatFriendlyMoney(item.amount, item.currency);
              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    void hapticLight();
                    void logTemplate({
                      id: `recent-${item.key}`,
                      label: item.label,
                      amount: item.amount,
                      currency: item.currency,
                      category: item.category,
                      note: item.note || undefined,
                      cardId: item.cardId,
                      icon: iconForExpenseCategory(item.category, expenseCatalog),
                    });
                  }}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`${title}, ${money}`}
                  style={({ pressed }) => [
                    insetSurface(colors, 16),
                    styles.recentChip,
                    {
                      opacity: busy ? 0.55 : pressed ? 0.85 : 1,
                      transform: [{ scale: pressed && !busy ? 0.96 : 1 }],
                    },
                  ]}
                >
                  <TypeIcon
                    typeId={item.category}
                    icon={iconForExpenseCategory(item.category, expenseCatalog)}
                    size={18}
                  />
                  <View style={styles.recentCopy}>
                    <Text
                      style={[styles.recentLabel, { color: colors.ink, fontSize: labelSize + 1 }]}
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                    <Text
                      style={[styles.recentAmount, { color: colors.muted, fontSize: labelSize }]}
                      numberOfLines={1}
                    >
                      {money}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      <Text style={[styles.sectionLabel, { color: colors.accent, fontSize: labelSize }]}>
        {t('spend.voiceQuickAdd')}
      </Text>
      <View style={[insetSurface(colors, 18), styles.voiceBlock]}>
        <View style={styles.voiceRow}>
          <Pressable
            onPress={() => {
              void hapticLight();
              setVoiceOpen((value) => !value);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('spend.voiceQuickAdd')}
            accessibilityState={{ expanded: voiceOpen }}
            style={({ pressed }) => [
              raisedAccent(colors, 22),
              styles.micButton,
              {
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            <Ionicons
              name={voiceOpen ? 'mic' : 'mic-outline'}
              size={22}
              color={colors.accentInk}
              accessible={false}
              importantForAccessibility="no"
            />
          </Pressable>
          <Text
            style={[
              styles.voiceHint,
              { color: colors.muted, fontSize: labelSize, lineHeight: Math.round(labelSize * 1.4) },
            ]}
          >
            {t('spend.voiceQuickAddHint')}
          </Text>
        </View>
        {voiceOpen ? (
          <View style={styles.voiceInputBlock}>
            <TextInput
              value={voiceText}
              onChangeText={(text) => {
                setVoiceText(text);
                setVoiceError(false);
              }}
              placeholder={t('spend.voiceQuickAddHint')}
              placeholderTextColor={colors.faint}
              autoFocus
              accessibilityLabel={t('spend.voiceQuickAdd')}
              style={[
                insetSurface(colors, 14),
                styles.voiceInput,
                { color: colors.ink, fontSize: bodySize, lineHeight: Math.round(bodySize * 1.35) },
              ]}
              returnKeyType="done"
              blurOnSubmit
            />
            {parsedVoice.amount !== undefined ? (
              <View style={styles.voiceParsedRow}>
                <Text style={[styles.voiceParsed, { color: colors.ink, fontSize: labelSize + 1 }]}>
                  {formatFriendlyMoney(parsedVoice.amount, parsedVoice.currency ?? settings.defaultCurrency)}
                  {parsedVoice.category
                    ? ` · ${expenseCategoryLabel(t, parsedVoice.category, expenseCatalog)}`
                    : ''}
                  {parsedVoice.note ? ` · ${parsedVoice.note}` : ''}
                </Text>
                <Pressable
                  onPress={() => void onVoiceLog()}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={t('spend.log')}
                  style={({ pressed }) => [
                    raisedAccent(colors, 14),
                    styles.voiceLogHit,
                    {
                      opacity: busy ? 0.55 : pressed ? 0.85 : 1,
                      transform: [{ scale: pressed && !busy ? 0.96 : 1 }],
                    },
                  ]}
                >
                  <Text style={[styles.voiceLogLabel, { color: colors.accentInk, fontSize: labelSize + 1 }]}>
                    {t('spend.keep')}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {voiceError || (voiceText.trim().length > 0 && parsedVoice.amount === undefined) ? (
              <Text style={[styles.voiceError, { color: colors.danger, fontSize: labelSize }]}>
                {t('spend.voiceNeedAmount')}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );

  const renderKeypadMode = () => (
    <View style={styles.keypadMode}>
      <ScrollView
        style={styles.keypadScroll}
        contentContainerStyle={styles.keypadScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={[insetSurface(colors, 16), styles.amountWell]}>
          <View style={styles.amountWellTop}>
            <View style={styles.amountWellBadges}>
              <Text style={[styles.currencyBadge, { color: colors.muted, fontSize: labelSize }]}>
                {settings.defaultCurrency}
              </Text>
              <View
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: colors.accentSoft,
                    borderColor: colors.accent,
                  },
                ]}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                <Ionicons name={categoryIcon} size={14} color={colors.accent} />
                <Text
                  style={[styles.categoryPillLabel, { color: colors.accent, fontSize: labelSize }]}
                  numberOfLines={1}
                >
                  {categoryLabel}
                </Text>
              </View>
            </View>
            {amountExpr ? (
              <Pressable
                onPress={() => onKeypadKey('clear')}
                accessibilityRole="button"
                accessibilityLabel={t('spend.clear')}
                hitSlop={8}
                style={({ pressed }) => [styles.wellClear, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={wellActionIconSize}
                  color={colors.muted}
                  accessible={false}
                  importantForAccessibility="no"
                />
              </Pressable>
            ) : null}
          </View>
          <Text
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${t('spend.amount')}, ${settings.defaultCurrency}, ${amountExpr || '0'}`}
            style={[
              styles.amountValue,
              {
                color: amountExpr ? colors.ink : colors.faint,
                fontSize: amountSize,
                lineHeight: Math.round(amountSize * 1.15),
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
            selectable={false}
          >
            {amountExpr || '0'}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
          accessibilityRole="radiogroup"
        >
          {suggestion.chips.map((chip) => (
            <Chip
              key={chip.category}
              leadingIcon={iconForExpenseCategory(chip.category, expenseCatalog)}
              label={expenseCategoryLabel(t, chip.category, expenseCatalog)}
              selected={category === chip.category}
              onPress={() => setCategory(chip.category)}
              scalable={false}
            />
          ))}
        </ScrollView>

        <View style={styles.pad}>
          {KEYPAD_ROWS.map((row) => (
            <View key={row.join('-')} style={styles.padRow}>
              {row.map((key) => {
                const isBack = key === 'back';
                const a11y = isBack
                  ? t('spend.backspace')
                  : key === '.'
                    ? t('spend.decimal')
                    : key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => onKeypadKey(key)}
                    accessibilityRole="button"
                    accessibilityLabel={a11y}
                    style={({ pressed }) => [
                      pressed ? insetSurface(colors, 14) : raisedSurface(colors, 14),
                      styles.key,
                      {
                        minHeight: keyMinHeight,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      },
                    ]}
                  >
                    {isBack ? (
                      <Ionicons
                        name="backspace-outline"
                        size={Math.min(22, keySize)}
                        color={colors.ink}
                        accessible={false}
                        importantForAccessibility="no"
                      />
                    ) : (
                      <Text
                        style={[
                          styles.keyLabel,
                          {
                            color: colors.ink,
                            fontSize: keySize,
                            fontWeight: '600',
                          },
                        ]}
                        numberOfLines={1}
                        selectable={false}
                      >
                        {key}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.logBar, { paddingBottom: Math.max(insets.bottom, 4) }]}>
        <PrimaryButton
          icon="checkmark"
          label={logCtaLabel}
          busy={busy}
          disabled={!keypadReady}
          onPress={onKeypadLog}
          accessibilityLabel={logCtaLabel}
        />
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.paper,
                paddingBottom: mode === 'keypad' ? 8 : insets.bottom + 16,
                borderColor: colors.glassBorder,
              },
            ]}
            accessibilityViewIsModal
          >
            <View style={styles.grabberWrap} accessibilityElementsHidden importantForAccessibility="no">
              <View style={[styles.grabber, { backgroundColor: colors.faint }]} />
            </View>

            <View style={styles.headRow}>
              <View style={styles.headCopy}>
                <Text
                  style={[
                    styles.title,
                    { color: colors.ink, fontSize: titleSize, lineHeight: Math.round(titleSize * 1.25) },
                  ]}
                >
                  {t('spend.quickSpend')}
                </Text>
                <Text
                  style={[
                    styles.hint,
                    { color: colors.muted, fontSize: labelSize, lineHeight: Math.round(labelSize * 1.4) },
                  ]}
                  numberOfLines={2}
                >
                  {t('spend.quickSpendHint')}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
                style={({ pressed }) => [
                  insetSurface(colors, 16),
                  styles.closeHit,
                  {
                    opacity: pressed ? 0.75 : 1,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  },
                ]}
              >
                <Ionicons name="close" size={20} color={colors.muted} accessible={false} importantForAccessibility="no" />
              </Pressable>
            </View>

            <View style={[insetSurface(colors, 16), styles.modeTrack]}>
              {renderModeSegment('instant', 'flash', t('spend.quickModeInstant'))}
              {renderModeSegment('keypad', 'keypad-outline', t('spend.quickModeKeypad'))}
            </View>

            {mode === 'instant' ? renderInstantMode() : renderKeypadMode()}

            {toast ? (
              <View style={[raisedSurface(colors, 14), styles.toast, { backgroundColor: colors.accentSoft }]}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={colors.accent}
                  accessible={false}
                  importantForAccessibility="no"
                />
                <Text style={[styles.toastText, { color: colors.ink, fontSize: bodySize }]} numberOfLines={1}>
                  {toast}
                </Text>
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
  },
  sheetWrap: {
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  grabberWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.45,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  headCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontFamily: fonts.display,
    fontWeight: '700',
  },
  hint: {
    fontFamily: fonts.body,
  },
  closeHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    marginBottom: 8,
  },
  modeSegment: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
  },
  modeSegmentLabel: {
    fontFamily: fonts.bodySemi,
    flexShrink: 1,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: 8,
    paddingTop: 2,
    paddingBottom: 6,
  },
  sectionLabel: {
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  smartCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 56,
  },
  smartCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  smartTitle: {
    fontFamily: fonts.bodySemi,
  },
  smartMeta: {
    fontFamily: fonts.body,
  },
  smartFlash: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentRow: {
    gap: 8,
    paddingVertical: 2,
    paddingRight: 8,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 148,
    maxWidth: 260,
  },
  recentCopy: {
    flexShrink: 1,
    minWidth: 0,
    gap: 1,
  },
  recentLabel: {
    fontFamily: fonts.bodyMedium,
  },
  recentAmount: {
    fontFamily: fonts.body,
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  templateCard: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 10,
    minHeight: 76,
    justifyContent: 'center',
  },
  templateLabel: {
    fontFamily: fonts.bodySemi,
    textAlign: 'center',
  },
  templateAmount: {
    fontFamily: fonts.body,
    textAlign: 'center',
  },
  voiceBlock: {
    padding: 10,
    gap: 8,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceHint: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.body,
  },
  voiceInputBlock: {
    gap: 8,
  },
  voiceInput: {
    fontFamily: fonts.body,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  voiceParsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voiceParsed: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bodyMedium,
  },
  voiceLogHit: {
    minHeight: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceLogLabel: {
    fontFamily: fonts.bodySemi,
  },
  voiceError: {
    fontFamily: fonts.body,
  },
  keypadMode: {
    gap: 8,
    paddingBottom: 4,
  },
  keypadScroll: {
    flexGrow: 0,
  },
  keypadScrollContent: {
    gap: 8,
    paddingBottom: 4,
  },
  amountWell: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 72,
    justifyContent: 'center',
  },
  amountWellTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    gap: 8,
  },
  amountWellBadges: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '70%',
  },
  categoryPillLabel: {
    fontFamily: fonts.bodySemi,
    flexShrink: 1,
  },
  wellClear: {
    minWidth: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyBadge: {
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.6,
  },
  amountValue: {
    fontFamily: fonts.display,
    fontWeight: '700',
    textAlign: 'right',
    width: '100%',
  },
  categoryRow: {
    gap: 6,
    paddingVertical: 2,
    paddingRight: 4,
  },
  pad: {
    gap: 6,
  },
  padRow: {
    flexDirection: 'row',
    gap: 6,
  },
  key: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyLabel: {
    fontFamily: fonts.display,
  },
  logBar: {
    paddingTop: 4,
  },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toastText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bodyMedium,
  },
});
