/**
 * Purpose: shop-style money calculator for spend/income amount (digits, one decimal, + − × ÷).
 * Inputs: expression string and a key press.
 * Outputs: next expression, evaluated number (2 dp), whether Save may persist it.
 * Side effects: none.
 * Design decisions: left-to-right (not scientific PEMDAS). At most two decimal digits per operand.
 *   Trailing operators are invalid until she finishes the sum. Save stores the evaluated number, not the formula.
 *   Currency lives on the form, not here.
 */

export type CalcOp = '+' | '-' | '×' | '÷';
export type CalcDigit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type CalcKey = CalcDigit | '.' | 'back' | 'clear' | '=' | CalcOp;

export const CALC_OPS: readonly CalcOp[] = ['+', '-', '×', '÷'];
export const CALC_MAX_LEN = 24;
const MONEY_SCALE = 100;

/**
 * Purpose: type-guard a single operator glyph.
 * Inputs: one character.
 * Outputs: true when it is + − × ÷ (minus stored as ASCII '-').
 * Side effects: none.
 */
export function isCalcOp(ch: string): ch is CalcOp {
  return ch === '+' || ch === '-' || ch === '×' || ch === '÷';
}

/**
 * Purpose: drop unfinished + − × ÷ so evaluate can read the last complete number.
 * Inputs: expression.
 * Outputs: expression without trailing operators.
 * Side effects: none.
 */
export function stripTrailingOperators(expression: string): string {
  return expression.replace(/[+\-×÷]+$/u, '');
}

/**
 * Purpose: true when the last glyph is an operator (Save must wait).
 * Inputs: expression.
 * Outputs: boolean.
 * Side effects: none.
 */
export function endsWithOperator(expression: string): boolean {
  if (!expression) {
    return false;
  }
  return isCalcOp(expression[expression.length - 1] ?? '');
}

/**
 * Purpose: the number currently being typed (after the last operator).
 * Inputs: expression.
 * Outputs: operand substring (may be empty or "0.").
 * Side effects: none.
 */
export function lastOperand(expression: string): string {
  let start = 0;
  for (let i = 0; i < expression.length; i += 1) {
    if (isCalcOp(expression[i] ?? '')) {
      start = i + 1;
    }
  }
  return expression.slice(start);
}

/**
 * Purpose: money display after equals — up to two decimals, no trailing zeros.
 * Inputs: finite number.
 * Outputs: string for the well (e.g. 15.5, 12).
 * Side effects: none.
 */
export function formatEvaluatedAmount(value: number): string {
  if (!Number.isFinite(value)) {
    return '';
  }
  const rounded = Math.round(value * MONEY_SCALE) / MONEY_SCALE;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }
  return normalized.toFixed(2).replace(/0$/u, '').replace(/\.0$/u, '');
}

/**
 * Purpose: seed the well from a saved or prefills amount.
 * Inputs: positive number from a row / query / reminder.
 * Outputs: expression string, or empty when not a usable amount.
 * Side effects: none.
 */
export function amountToExpression(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    return '';
  }
  return formatEvaluatedAmount(amount);
}

/**
 * Purpose: banker's-adjacent money round (half away via Math.round on cents).
 * Inputs: raw float.
 * Outputs: value with at most two decimal places.
 * Side effects: none.
 */
function roundMoney(value: number): number {
  return Math.round(value * MONEY_SCALE) / MONEY_SCALE;
}

/**
 * Purpose: one left-to-right shop step.
 * Inputs: accumulator, operator, right-hand number.
 * Outputs: unrounded next accumulator (caller rounds at the end).
 * Side effects: none.
 */
function applyOp(left: number, op: CalcOp, right: number): number {
  if (op === '+') {
    return left + right;
  }
  if (op === '-') {
    return left - right;
  }
  if (op === '×') {
    return left * right;
  }
  return left / right;
}

/**
 * Purpose: split "12+3.5" into numbers and operators.
 * Inputs: expression with no trailing operator.
 * Outputs: token list, or undefined if malformed.
 * Side effects: none.
 */
function tokenize(expression: string): Array<number | CalcOp> | undefined {
  const tokens: Array<number | CalcOp> = [];
  let buffer = '';
  const flush = (): boolean => {
    if (!buffer) {
      return true;
    }
    const n = Number(buffer);
    if (!Number.isFinite(n)) {
      return false;
    }
    tokens.push(n);
    buffer = '';
    return true;
  };
  for (const ch of expression) {
    if (isCalcOp(ch)) {
      if (!flush() || tokens.length === 0 || isCalcOp(String(tokens[tokens.length - 1]))) {
        return undefined;
      }
      tokens.push(ch);
    } else {
      buffer += ch;
    }
  }
  if (!flush() || tokens.length === 0) {
    return undefined;
  }
  return tokens;
}

/**
 * Purpose: evaluate a shop expression left-to-right, then round to two money decimals.
 * Inputs: expression (trailing operators ignored).
 * Outputs: finite number, or NaN when empty / divide-by-zero / malformed.
 * Side effects: none.
 */
export function evaluateAmountExpression(expression: string): number {
  const trimmed = stripTrailingOperators(expression.replace(/\.$/u, ''));
  if (!trimmed) {
    return Number.NaN;
  }
  const tokens = tokenize(trimmed);
  if (!tokens) {
    return Number.NaN;
  }
  let acc = tokens[0];
  if (typeof acc !== 'number') {
    return Number.NaN;
  }
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const rhs = tokens[i + 1];
    if (typeof op !== 'string' || !isCalcOp(op) || typeof rhs !== 'number') {
      return Number.NaN;
    }
    if (op === '÷' && rhs === 0) {
      return Number.NaN;
    }
    acc = applyOp(acc, op, rhs);
    if (!Number.isFinite(acc)) {
      return Number.NaN;
    }
  }
  return roundMoney(acc);
}

/**
 * Purpose: running total shown under the formula when she has typed a complete 12+3.5.
 * Inputs: expression.
 * Outputs: formatted result, or undefined when there is nothing extra to show.
 * Side effects: none.
 */
export function previewAmountExpression(expression: string): string | undefined {
  if (!/[+\-×÷]/u.test(expression) || endsWithOperator(expression)) {
    return undefined;
  }
  const value = evaluateAmountExpression(expression);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  const formatted = formatEvaluatedAmount(value);
  return formatted === expression ? undefined : formatted;
}

/**
 * Purpose: Save is allowed only for a finished, positive money amount.
 * Inputs: expression.
 * Outputs: true when Keep this spend may persist evaluateAmountExpression(expression).
 * Side effects: none.
 * Design decisions: trailing + − × ÷ or a lone '.' are not savable — she finishes the sum first.
 */
export function isCompleteAmountExpression(expression: string): boolean {
  if (!expression || endsWithOperator(expression) || expression.endsWith('.')) {
    return false;
  }
  const value = evaluateAmountExpression(expression);
  return Number.isFinite(value) && value > 0;
}

/**
 * Purpose: block a third digit after the decimal (money is cents).
 * Inputs: current operand string.
 * Outputs: whether another 0–9 may be appended.
 * Side effects: none.
 */
function canAddDigit(operand: string): boolean {
  const dot = operand.indexOf('.');
  if (dot === -1) {
    return true;
  }
  return operand.length - dot - 1 < 2;
}

export interface CalcApplyResult {
  expression: string;
  justEvaluated: boolean;
}

/**
 * Purpose: apply one keypad tap to the current formula.
 * Inputs: expression, key, whether the last tap was equals (so the next digit starts fresh).
 * Outputs: next expression + justEvaluated flag.
 * Side effects: none.
 */
export function applyCalcKey(expression: string, key: CalcKey, justEvaluated: boolean): CalcApplyResult {
  if (key === 'clear') {
    return { expression: '', justEvaluated: false };
  }
  if (key === 'back') {
    if (!expression) {
      return { expression: '', justEvaluated: false };
    }
    return { expression: expression.slice(0, -1), justEvaluated: false };
  }
  if (key === '=') {
    const value = evaluateAmountExpression(expression);
    if (!Number.isFinite(value)) {
      return { expression, justEvaluated: false };
    }
    return { expression: formatEvaluatedAmount(value), justEvaluated: true };
  }
  if (isCalcOp(key)) {
    if (!expression || expression === '0.') {
      return { expression, justEvaluated: false };
    }
    let next = expression;
    if (next.endsWith('.')) {
      next = next.slice(0, -1);
    }
    if (!next) {
      return { expression, justEvaluated: false };
    }
    if (endsWithOperator(next)) {
      return { expression: next.slice(0, -1) + key, justEvaluated: false };
    }
    if (next.length >= CALC_MAX_LEN) {
      return { expression: next, justEvaluated: false };
    }
    return { expression: next + key, justEvaluated: false };
  }
  if (key === '.') {
    if (justEvaluated) {
      return { expression: '0.', justEvaluated: false };
    }
    const operand = lastOperand(expression);
    if (operand.includes('.')) {
      return { expression, justEvaluated: false };
    }
    const insert = operand === '' ? '0.' : '.';
    if (expression.length + insert.length > CALC_MAX_LEN) {
      return { expression, justEvaluated: false };
    }
    return { expression: expression + insert, justEvaluated: false };
  }
  if (justEvaluated) {
    return { expression: key === '0' ? '0' : key, justEvaluated: false };
  }
  const operand = lastOperand(expression);
  if (!canAddDigit(operand)) {
    return { expression, justEvaluated: false };
  }
  if (expression.length >= CALC_MAX_LEN) {
    return { expression, justEvaluated: false };
  }
  if (operand === '0') {
    return { expression: expression.slice(0, -1) + key, justEvaluated: false };
  }
  return { expression: expression + key, justEvaluated: false };
}
