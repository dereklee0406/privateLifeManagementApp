import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../controller/FinanceProvider';
import { useSettings } from '../../controller/SettingsProvider';
import {
  formatFriendlyMoney,
  resolveExpenseCategories,
  type ExpenseCategory,
} from '../../model/finance/Expense';
import {
  quickAddTemplates,
  suggestQuickAdd,
  type QuickAddTemplate,
} from '../../model/finance/quickAdd';
import { parseVoiceSpend } from '../../model/finance/voiceSpendParser';
import { hapticLight, hapticSuccess } from '../../utils/haptics';
import { localizeQuickAddTemplateLabel, useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { useTypography } from '../theme/TypographyProvider';
import { fonts, insetSurface, raisedAccent, raisedSurface } from '../theme/tokens';
import { expenseCategoryLabel, iconForExpenseCategory, type TypeIconName } from '../icons/typeIcons';
import { Chip } from './Chip';
import { GlassSurface } from './GlassSurface';

/**
 * Purpose: compact quick-add bar embedded on Today Home — log a spend without leaving the screen.
 * Inputs: Finance (expenses, createQuickExpense, createVoiceExpense), Settings (default currency,
 *   expense catalog).
 * Outputs: amount field with currency badge, category chips, 1-tap template buttons, and a voice
 *   quick-add toggle; a brief inline "Logged" confirmation after each save.
 * Side effects: createQuickExpense / createVoiceExpense via FinanceProvider (JSON write),
 *   hapticLight / hapticSuccess.
 * Design decisions: all logging converges on the Controller quick-spend methods (same as
 *   QuickSpendSheet) so FX locking and validation stay in one place; the View only collects
 *   (amount, category) or a parsed voice phrase. Voice uses OS keyboard dictation into a plain
 *   TextInput parsed on-device by Model parseVoiceSpend — zero new native dependencies.
 *   Category defaults to the Smart Default from suggestQuickAdd; font sizes scale via
 *   useTypography; every control carries an a11y label/role.
 */
export function InlineHomeQuickAdd() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const { scaleFontSize } = useTypography();
  const { settings } = useSettings();
  const { expenses, createQuickExpense, createVoiceExpense } = useFinance();

  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceError, setVoiceError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const expenseCatalog = useMemo(() => resolveExpenseCategories(settings), [settings]);
  const now = useMemo(() => new Date(), [expenses.length]);
  const suggestion = useMemo(
    () => suggestQuickAdd(expenses, now, expenseCatalog),
    [expenses, now, expenseCatalog],
  );
  const templates = useMemo(() => quickAddTemplates(settings.defaultCurrency), [settings.defaultCurrency]);
  const parsedVoice = useMemo(() => parseVoiceSpend(voiceText), [voiceText]);

  const activeCategory = category ?? suggestion.category;
  const parsedAmount = Number.parseFloat(amountText.replace(/,/g, ''));
  const amountReady = amountText.trim().length > 0 && Number.isFinite(parsedAmount) && parsedAmount > 0;

  const labelSize = scaleFontSize(13);
  const bodySize = scaleFontSize(15);

  const templateLabel = (template: QuickAddTemplate): string => localizeQuickAddTemplateLabel(t, template);

  /** Brief inline confirmation, mirroring TodayRecurringStrip's toast pattern. */
  const showToast = (message: string) => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    setToast(message);
    toastTimer.current = setTimeout(() => {
      toastTimer.current = null;
      setToast(null);
    }, 2800);
  };

  /** 1-tap log through the Controller (templates + custom amount share this path). */
  const logTemplate = async (template: QuickAddTemplate) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await createQuickExpense(template);
      await hapticSuccess();
      showToast(t('home.stripLogged'));
      setAmountText('');
      setCategory(null);
    } finally {
      setBusy(false);
    }
  };

  const onLogAmount = () => {
    if (!amountReady) {
      return;
    }
    const label = expenseCategoryLabel(t, activeCategory, expenseCatalog);
    void logTemplate({
      id: 'inline-custom',
      label,
      amount: parsedAmount,
      currency: settings.defaultCurrency,
      category: activeCategory,
      note: label,
      icon: iconForExpenseCategory(activeCategory, expenseCatalog),
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
      showToast(t('home.stripLogged'));
      setVoiceText('');
      setVoiceOpen(false);
    } catch {
      // Model refuses to invent money — ask her to say/type an amount.
      setVoiceError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassSurface style={styles.card} radius={18}>
      <Text style={[styles.kicker, { color: colors.accent, fontSize: labelSize }]}>
        {t('spend.quickSpend')}
      </Text>

      <View style={styles.amountRow}>
        <View style={[insetSurface(colors, 14), styles.amountWell]}>
          <Text style={[styles.currencyBadge, { color: colors.muted, fontSize: labelSize - 1 }]}>
            {settings.defaultCurrency}
          </Text>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0"
            placeholderTextColor={colors.faint}
            keyboardType="decimal-pad"
            accessibilityLabel={t('spend.amount')}
            style={[
              styles.amountInput,
              { color: colors.ink, fontSize: bodySize + 2, lineHeight: Math.round((bodySize + 2) * 1.3) },
            ]}
            returnKeyType="done"
            onSubmitEditing={onLogAmount}
            blurOnSubmit
          />
        </View>
        <Pressable
          onPress={() => {
            void hapticLight();
            setVoiceOpen((value) => !value);
            setVoiceError(false);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('spend.voiceQuickAdd')}
          accessibilityState={{ expanded: voiceOpen }}
          style={[insetSurface(colors, 14), styles.iconHit, voiceOpen ? { backgroundColor: colors.accentSoft } : null]}
        >
          <Ionicons
            name={voiceOpen ? 'mic' : 'mic-outline'}
            size={20}
            color={voiceOpen ? colors.accent : colors.ink}
            accessible={false}
            importantForAccessibility="no"
          />
        </Pressable>
        <Pressable
          onPress={onLogAmount}
          disabled={!amountReady || busy}
          accessibilityRole="button"
          accessibilityLabel={t('spend.log')}
          accessibilityState={{ disabled: !amountReady || busy }}
          style={[raisedAccent(colors, 14), styles.iconHit, { opacity: !amountReady || busy ? 0.45 : 1 }]}
        >
          <Ionicons name="checkmark" size={20} color={colors.accentInk} accessible={false} importantForAccessibility="no" />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {suggestion.chips.map((chip) => (
          <Chip
            key={chip.category}
            icon={iconForExpenseCategory(chip.category, expenseCatalog)}
            label={expenseCategoryLabel(t, chip.category, expenseCatalog)}
            selected={activeCategory === chip.category}
            onPress={() => setCategory(chip.category)}
          />
        ))}
      </ScrollView>

      <View style={styles.templateRow}>
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
            style={[raisedSurface(colors, 14), styles.templateHit, { opacity: busy ? 0.55 : 1 }]}
          >
            <Ionicons
              name={template.icon as TypeIconName}
              size={18}
              color={colors.accent}
              accessible={false}
              importantForAccessibility="no"
            />
            <Text
              style={[styles.templateLabel, { color: colors.ink, fontSize: labelSize }]}
              numberOfLines={1}
            >
              {templateLabel(template)}
            </Text>
          </Pressable>
        ))}
      </View>

      {voiceOpen ? (
        <View style={styles.voiceBlock}>
          <TextInput
            value={voiceText}
            onChangeText={(text) => {
              setVoiceText(text);
              setVoiceError(false);
            }}
            placeholder={t('spend.voiceQuickAddHint')}
            placeholderTextColor={colors.faint}
            accessibilityLabel={t('spend.voiceQuickAdd')}
            style={[
              insetSurface(colors, 14),
              styles.voiceInput,
              { color: colors.ink, fontSize: bodySize, lineHeight: Math.round(bodySize * 1.35) },
            ]}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (parsedVoice.amount !== undefined) {
                void onVoiceLog();
              } else {
                setVoiceError(true);
              }
            }}
            blurOnSubmit
          />
          <View style={styles.voiceActions}>
            {parsedVoice.amount !== undefined ? (
              <Text
                style={[styles.voiceParsed, { color: colors.muted, fontSize: labelSize }]}
                numberOfLines={1}
              >
                {formatFriendlyMoney(parsedVoice.amount, parsedVoice.currency ?? settings.defaultCurrency)}
                {parsedVoice.category ? ` · ${expenseCategoryLabel(t, parsedVoice.category, expenseCatalog)}` : ''}
                {parsedVoice.note ? ` · ${parsedVoice.note}` : ''}
              </Text>
            ) : (
              <Text style={[styles.voiceParsed, { color: colors.faint, fontSize: labelSize }]} numberOfLines={1}>
                {t('spend.voiceQuickAddHint')}
              </Text>
            )}
            <Pressable
              onPress={() => void onVoiceLog()}
              disabled={busy || parsedVoice.amount === undefined}
              accessibilityRole="button"
              accessibilityLabel={t('spend.keep')}
              accessibilityState={{ disabled: busy || parsedVoice.amount === undefined }}
              style={[
                raisedAccent(colors, 12),
                styles.voiceLogHit,
                { opacity: busy || parsedVoice.amount === undefined ? 0.45 : 1 },
              ]}
            >
              <Text style={[styles.voiceLogLabel, { color: colors.accentInk, fontSize: labelSize }]}>
                {t('spend.keep')}
              </Text>
            </Pressable>
          </View>
          {voiceError ? (
            <Text style={[styles.voiceError, { color: colors.danger, fontSize: labelSize }]}>
              {t('spend.voiceNeedAmount')}
            </Text>
          ) : null}
        </View>
      ) : null}

      {toast ? (
        <View style={[raisedSurface(colors, 12), styles.toast, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name="checkmark-circle" size={16} color={colors.accent} accessible={false} importantForAccessibility="no" />
          <Text style={[styles.toastText, { color: colors.ink, fontSize: labelSize + 1 }]} numberOfLines={1}>
            {toast}
          </Text>
        </View>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 10,
    marginBottom: 14,
  },
  kicker: {
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountWell: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  currencyBadge: {
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.6,
  },
  amountInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bodyMedium,
    paddingVertical: 8,
  },
  iconHit: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
    paddingRight: 8,
  },
  templateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  templateHit: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  templateLabel: {
    fontFamily: fonts.bodyMedium,
    flexShrink: 1,
  },
  voiceBlock: {
    gap: 8,
  },
  voiceInput: {
    fontFamily: fonts.body,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  voiceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voiceParsed: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.body,
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
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toastText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bodyMedium,
  },
});
