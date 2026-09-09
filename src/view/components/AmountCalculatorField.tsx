import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppConfig } from '../../config/appConfig';
import {
  applyCalcKey,
  endsWithOperator,
  previewAmountExpression,
  type CalcKey,
  type CalcOp,
} from '../../model/finance/amountCalculator';
import { convertAmountExpression, type FxRateTable } from '../../model/finance/fx';
import type { MoneyCurrency } from '../../model/settings/AppSettings';
import { hapticLight } from '../../utils/haptics';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { useTypography } from '../theme/TypographyProvider';
import { fonts, insetSurface, raisedAccent, raisedSurface } from '../theme/tokens';

const CURRENCIES = AppConfig.money.currencies;
const NUM_ROWS: CalcKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'back'],
];
const MATH_OPS: CalcKey[] = ['+', '-', '×', '÷', '='];

interface AmountCalculatorFieldProps {
  expression: string;
  onChange: (expression: string) => void;
  currency: MoneyCurrency;
  onCurrencyChange: (currency: MoneyCurrency) => void;
  /** Cached FX quotes for auto-convert when she taps another currency chip. */
  fxTable?: FxRateTable | null;
  /** When uncontrolled, keypad starts collapsed if true (default). */
  defaultCollapsed?: boolean;
  /** Optional controlled keypad collapse; omit for internal state. */
  isKeypadCollapsed?: boolean;
  onKeypadCollapsedChange?: (collapsed: boolean) => void;
}

/**
 * Purpose: caret-free money well + HKD|USD|CNY capsule + compact 3×4 keypad (no OS keyboard).
 * Inputs: expression string, currency, change handlers, optional FX table, optional keypad collapse control.
 * Outputs: horizontal currency row, tap-to-expand amount well, compact pad with Done + inline ±×÷ toggle.
 * Side effects: light haptic on key / currency / toolbar press (Customize haptics).
 * Design decisions: keypad starts collapsed so Card 1 stays glanceable; tapping the amount well expands
 *   a compact ~34–38pt pad. Math ops hide behind a compact ±×÷ chip beside the Done bar (no full-width
 *   math row). Keys use raised → inset + slight scale on press for a physical calculator feel.
 *   Clear (x) stays independent of expand/collapse. Currency switch still evaluates then
 *   mid-market converts via Model `convertAmountExpression`; arithmetic stays on `applyCalcKey`.
 */
export function AmountCalculatorField({
  expression,
  onChange,
  currency,
  onCurrencyChange,
  fxTable,
  defaultCollapsed,
  isKeypadCollapsed: controlledCollapsed,
  onKeypadCollapsedChange,
}: AmountCalculatorFieldProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const { scaleFontSize, fontScale } = useTypography();
  const lastEmitted = useRef(expression);
  const justEvaluated = useRef(false);
  const [mathOpen, setMathOpen] = useState(false);
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed ?? true);
  const keypadCollapsed = controlledCollapsed ?? internalCollapsed;

  if (expression !== lastEmitted.current) {
    justEvaluated.current = false;
    lastEmitted.current = expression;
  }
  const preview = previewAmountExpression(expression);
  const empty = expression.length === 0;
  const activeOp: CalcOp | null =
    endsWithOperator(expression) && expression.length > 0
      ? (expression[expression.length - 1] as CalcOp)
      : null;

  /** Compact key height (~34–38pt) so the expanded pad stays short. */
  const keyMinHeight = Math.min(38, Math.max(34, Math.round(36 * Math.min(fontScale, 1.15))));
  const amountSize =
    expression.length > 12
      ? scaleFontSize(26)
      : expression.length > 8
        ? scaleFontSize(32)
        : scaleFontSize(40);
  const currencyLabelSize = scaleFontSize(13);
  const keyLabelSize = scaleFontSize(20);
  const previewSize = scaleFontSize(15);
  const toolLabelSize = scaleFontSize(13);
  const editPillSize = scaleFontSize(12);
  const backspaceIconSize = Math.min(22, Math.max(18, scaleFontSize(20)));
  const wellActionIconSize = Math.min(20, Math.max(16, scaleFontSize(18)));
  const editChevronSize = Math.min(16, Math.max(14, scaleFontSize(14)));

  const setKeypadCollapsed = (collapsed: boolean) => {
    if (controlledCollapsed === undefined) {
      setInternalCollapsed(collapsed);
    }
    onKeypadCollapsedChange?.(collapsed);
  };

  const pressKey = (key: CalcKey) => {
    void hapticLight();
    const next = applyCalcKey(expression, key, justEvaluated.current);
    justEvaluated.current = next.justEvaluated;
    lastEmitted.current = next.expression;
    onChange(next.expression);
  };

  const pressCurrency = (nextCurrency: MoneyCurrency) => {
    if (nextCurrency === currency) {
      return;
    }
    void hapticLight();
    const nextExpression = convertAmountExpression(expression, currency, nextCurrency, fxTable);
    justEvaluated.current = nextExpression.length > 0;
    lastEmitted.current = nextExpression;
    // Always push the converted face amount so parent state cannot stay on the old currency's digits.
    onChange(nextExpression);
    onCurrencyChange(nextCurrency);
  };

  const toggleMath = () => {
    void hapticLight();
    setMathOpen((open) => !open);
  };

  const toggleKeypad = () => {
    void hapticLight();
    setKeypadCollapsed(!keypadCollapsed);
  };

  const collapseKeypad = () => {
    void hapticLight();
    setKeypadCollapsed(true);
    setMathOpen(false);
  };

  const clearAmount = () => {
    void hapticLight();
    justEvaluated.current = false;
    lastEmitted.current = '';
    onChange('');
  };

  const keyLabel = (key: CalcKey): string => {
    if (key === '-') {
      return '−';
    }
    return key;
  };

  const keyA11y = (key: CalcKey): string => {
    if (key === 'clear') {
      return t('spend.clear');
    }
    if (key === 'back') {
      return t('spend.backspace');
    }
    if (key === '=') {
      return t('spend.equals');
    }
    if (key === '+') {
      return t('spend.plus');
    }
    if (key === '-') {
      return t('spend.minus');
    }
    if (key === '×') {
      return t('spend.times');
    }
    if (key === '÷') {
      return t('spend.divide');
    }
    if (key === '.') {
      return t('spend.decimal');
    }
    return key;
  };

  const isOp = (key: CalcKey) => key === '+' || key === '-' || key === '×' || key === '÷';

  const amountA11yLabel = `${t('spend.amount')}, ${currency}, ${empty ? '0' : expression}${preview ? `, = ${preview}` : ''}`;
  const wellA11yLabel = keypadCollapsed
    ? `${amountA11yLabel}. ${t('spend.tapToEdit')}`
    : `${amountA11yLabel}. ${t('spend.done')}`;

  return (
    <View style={styles.block}>
      <View style={[insetSurface(colors, 16), styles.currencyCapsule]} accessibilityRole="radiogroup">
        {CURRENCIES.map((item) => {
          const selected = currency === item;
          return (
            <Pressable
              key={item}
              onPress={() => pressCurrency(item)}
              accessibilityRole="radio"
              accessibilityLabel={item}
              accessibilityState={{ selected }}
              style={[
                selected ? raisedAccent(colors, 12) : null,
                styles.currencyPill,
                {
                  minHeight: Math.max(36, Math.round(36 * Math.min(fontScale, 1.15))),
                  backgroundColor: selected ? colors.accentSoft : 'transparent',
                  borderWidth: selected ? 1.5 : 0,
                  borderColor: selected ? colors.accent : 'transparent',
                  boxShadow: selected ? colors.accentGlow : undefined,
                },
              ]}
            >
              <Text
                style={[
                  styles.currencyLabel,
                  {
                    color: selected ? colors.accent : colors.ink,
                    fontSize: currencyLabelSize,
                  },
                ]}
                numberOfLines={1}
                selectable={false}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[insetSurface(colors, 20), styles.well]}>
        <View style={styles.wellTop}>
          <Text
            style={[styles.currencyBadge, { color: colors.muted, fontSize: currencyLabelSize }]}
            selectable={false}
            importantForAccessibility="no"
          >
            {currency}
          </Text>
          <View style={styles.wellActions}>
            {!empty ? (
              <Pressable
                onPress={clearAmount}
                accessibilityRole="button"
                accessibilityLabel={t('spend.clear')}
                hitSlop={8}
                style={({ pressed }) => [styles.wellAction, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Ionicons name="close-circle-outline" size={wellActionIconSize} color={colors.muted} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={toggleKeypad}
              accessibilityRole="button"
              accessibilityLabel={keypadCollapsed ? t('spend.showKeypad') : t('spend.hideKeypad')}
              accessibilityState={{ expanded: !keypadCollapsed }}
              hitSlop={6}
              style={({ pressed }) => [
                styles.editPill,
                {
                  backgroundColor: keypadCollapsed ? colors.accentSoft : colors.surface,
                  borderColor: keypadCollapsed ? colors.accent : colors.glassBorder,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Ionicons
                name={keypadCollapsed ? 'chevron-down' : 'chevron-up'}
                size={editChevronSize}
                color={keypadCollapsed ? colors.accent : colors.muted}
              />
              <Text
                style={[
                  styles.editPillLabel,
                  {
                    color: keypadCollapsed ? colors.accent : colors.muted,
                    fontSize: editPillSize,
                  },
                ]}
                numberOfLines={1}
                selectable={false}
              >
                {keypadCollapsed ? t('spend.tapToEdit') : t('spend.done')}
              </Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={toggleKeypad}
          accessibilityRole="button"
          accessibilityLabel={wellA11yLabel}
          accessibilityState={{ expanded: !keypadCollapsed }}
          accessibilityHint={keypadCollapsed ? t('spend.showKeypad') : t('spend.hideKeypad')}
          style={({ pressed }) => [styles.amountHit, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text
            accessible={false}
            style={[
              styles.amount,
              {
                color: empty ? colors.faint : colors.ink,
                fontSize: amountSize,
                lineHeight: Math.round(amountSize * 1.15),
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
            selectable={false}
          >
            {empty ? '0' : expression}
          </Text>
          {preview ? (
            <Text
              style={[styles.preview, { color: colors.muted, fontSize: previewSize, lineHeight: Math.round(previewSize * 1.35) }]}
              selectable={false}
              importantForAccessibility="no"
            >
              = {preview}
            </Text>
          ) : null}
        </Pressable>
      </View>

      {!keypadCollapsed ? (
        <View style={styles.pad}>
          <View style={styles.padToolbar}>
            <Pressable
              onPress={toggleMath}
              accessibilityRole="switch"
              accessibilityLabel={t('spend.mathToggle')}
              accessibilityState={{ checked: mathOpen }}
              style={[
                mathOpen ? raisedAccent(colors, 12) : raisedSurface(colors, 12),
                styles.mathChip,
                {
                  minHeight: Math.max(32, Math.round(32 * Math.min(fontScale, 1.15))),
                  backgroundColor: mathOpen ? colors.accentSoft : colors.surface,
                  borderWidth: mathOpen ? 1.5 : 1,
                  borderColor: mathOpen ? colors.accent : colors.glassBorder,
                  boxShadow: mathOpen ? colors.accentGlow : undefined,
                },
              ]}
            >
              <Text
                style={[
                  styles.mathChipLabel,
                  {
                    color: mathOpen ? colors.accent : colors.ink,
                    fontSize: toolLabelSize,
                  },
                ]}
                selectable={false}
              >
                ±×÷
              </Text>
            </Pressable>

            <Pressable
              onPress={collapseKeypad}
              accessibilityRole="button"
              accessibilityLabel={t('spend.done')}
              style={[
                raisedSurface(colors, 12),
                styles.doneBar,
                {
                  minHeight: Math.max(32, Math.round(32 * Math.min(fontScale, 1.15))),
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.glassBorder,
                },
              ]}
            >
              <Ionicons name="chevron-up" size={editChevronSize} color={colors.ink} />
              <Text
                style={[styles.doneBarLabel, { color: colors.ink, fontSize: toolLabelSize }]}
                selectable={false}
              >
                {t('spend.done')}
              </Text>
            </Pressable>
          </View>

          {mathOpen ? (
            <View style={styles.opStrip}>
              {MATH_OPS.map((key) => {
                const opActive = isOp(key) && activeOp === key;
                const isEquals = key === '=';
                return (
                  <Pressable
                    key={key}
                    onPress={() => pressKey(key)}
                    accessibilityRole="button"
                    accessibilityLabel={keyA11y(key)}
                    style={({ pressed }) => [
                      isEquals
                        ? raisedAccent(colors, 14)
                        : pressed
                          ? insetSurface(colors, 14)
                          : raisedSurface(colors, 14),
                      styles.opKey,
                      {
                        minHeight: keyMinHeight,
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      },
                      isOp(key) && !pressed ? { backgroundColor: colors.accentSoft } : null,
                      opActive
                        ? {
                            borderWidth: 1.5,
                            borderColor: colors.accent,
                            boxShadow: colors.accentGlow,
                          }
                        : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.keyLabel,
                        {
                          color: isEquals ? colors.accentInk : opActive ? colors.accent : colors.ink,
                          fontSize: keyLabelSize,
                          fontWeight: opActive ? '700' : undefined,
                        },
                      ]}
                      numberOfLines={1}
                      selectable={false}
                    >
                      {keyLabel(key)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {NUM_ROWS.map((row) => (
            <View key={row.join('-')} style={styles.padRow}>
              {row.map((key) => (
                <Pressable
                  key={key}
                  onPress={() => pressKey(key)}
                  accessibilityRole="button"
                  accessibilityLabel={keyA11y(key)}
                  style={({ pressed }) => [
                    pressed ? insetSurface(colors, 14) : raisedSurface(colors, 14),
                    styles.key,
                    {
                      minHeight: keyMinHeight,
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                    },
                  ]}
                >
                  {key === 'back' ? (
                    <Ionicons name="backspace-outline" size={backspaceIconSize} color={colors.ink} />
                  ) : (
                    <Text
                      style={[styles.keyLabel, { color: colors.ink, fontSize: keyLabelSize }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                      selectable={false}
                    >
                      {keyLabel(key)}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10, width: '100%' },
  currencyCapsule: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    width: '100%',
    alignItems: 'center',
  },
  currencyPill: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyLabel: { fontFamily: fonts.bodySemi, letterSpacing: 0.4 },
  well: {
    width: '100%',
    minHeight: 88,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  wellTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  wellActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wellAction: {
    minWidth: 28,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  editPillLabel: { fontFamily: fonts.bodySemi, letterSpacing: 0.2 },
  currencyBadge: {
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.6,
  },
  amount: { fontFamily: fonts.display, fontWeight: '700', textAlign: 'right' },
  preview: { fontFamily: fonts.bodyMedium, marginTop: 2, textAlign: 'right' },
  amountHit: {
    width: '100%',
    paddingVertical: 2,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  pad: { gap: 6, width: '100%' },
  padToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  mathChip: {
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mathChipLabel: { fontFamily: fonts.bodySemi, letterSpacing: 0.3 },
  doneBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
  },
  doneBarLabel: { fontFamily: fonts.bodySemi, letterSpacing: 0.3 },
  opStrip: { flexDirection: 'row', gap: 6, width: '100%' },
  opKey: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padRow: { flexDirection: 'row', gap: 6, width: '100%' },
  key: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyLabel: { fontFamily: fonts.display, fontWeight: '600' },
});
