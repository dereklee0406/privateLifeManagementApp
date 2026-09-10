import type { Asset, AssetKind } from './Asset';
import type { Budget } from './Budget';
import type { Expense, ExpenseCategory, ExpenseFxSnapshot } from './Expense';
import type { ExpenseSplit, ExpenseSplitMode, ExpenseSplitShare } from './ExpenseSplit';
import type { RecurringSpend } from './recurringSpend';
import { WEEKDAY_REPEAT } from './recurringSpend';
import type { IncomeEntry, IncomeKind } from './Income';
import type { Loan, LoanKind } from './Loan';
import type { TransferEntry } from './Transfer';
import { emptyFinanceDocument, type FinanceDocument } from './Account';
import { normalizeNetWorthHistory } from './netWorthHistory';
import { normalizeSavingsTarget } from './savingsTarget';
import type { MoneyCurrency } from '../settings/AppSettings';

const CURRENCIES: MoneyCurrency[] = ['HKD', 'USD', 'CNY'];
const INCOME_KINDS: IncomeKind[] = ['salary', 'bonus', 'other'];
const ASSET_KINDS: AssetKind[] = ['cash', 'bank', 'investment', 'property'];
const LOAN_KINDS: LoanKind[] = ['mortgage', 'personal', 'car'];
const LEGACY_ACCOUNT_KINDS = ['cash', 'bank', 'credit-card'] as const;

/**
 * Purpose: hydrate the finance JSON document, including older monthly-income and account shapes.
 * Inputs: parsed unknown.
 * Outputs: expenses, incomes, budgets, assets, loans, transfers, splits, savings target, history.
 * Side effects: none.
 */
export function normalizeFinanceDocument(raw: unknown): FinanceDocument {
  if (!raw || typeof raw !== 'object') {
    return emptyFinanceDocument();
  }
  const value = raw as Record<string, unknown>;
  const assetsFromLegacy = Array.isArray(value.accounts) ? migrateLegacyAccounts(value.accounts) : [];
  const assets = [
    ...(Array.isArray(value.assets)
      ? value.assets.map(normalizeAsset).filter((item): item is Asset => item !== null)
      : []),
    ...assetsFromLegacy,
  ];
  return {
    expenses: Array.isArray(value.expenses)
      ? value.expenses.map(normalizeExpense).filter((item): item is Expense => item !== null)
      : [],
    incomes: Array.isArray(value.incomes)
      ? value.incomes.map(normalizeIncome).filter((item): item is IncomeEntry => item !== null)
      : [],
    budgets: Array.isArray(value.budgets)
      ? value.budgets.map(normalizeBudget).filter((item): item is Budget => item !== null)
      : [],
    assets,
    loans: Array.isArray(value.loans)
      ? value.loans.map(normalizeLoan).filter((item): item is Loan => item !== null)
      : [],
    recurringSpends: Array.isArray(value.recurringSpends)
      ? value.recurringSpends.map(normalizeRecurringSpend).filter((item): item is RecurringSpend => item !== null)
      : [],
    transfers: Array.isArray(value.transfers)
      ? value.transfers.map(normalizeTransfer).filter((item): item is TransferEntry => item !== null)
      : [],
    splits: Array.isArray(value.splits)
      ? value.splits.map(normalizeExpenseSplit).filter((item): item is ExpenseSplit => item !== null)
      : [],
    savingsTarget: normalizeSavingsTarget(value.savingsTarget),
    netWorthHistory: normalizeNetWorthHistory(value.netWorthHistory),
  };
}

function asCurrency(raw: unknown): MoneyCurrency {
  return CURRENCIES.includes(raw as MoneyCurrency) ? (raw as MoneyCurrency) : 'HKD';
}

function normalizeExpense(raw: unknown): Expense | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const amount = Number(value.amount);
  if (typeof value.id !== 'string' || !Number.isFinite(amount) || typeof value.dayKey !== 'string') {
    return null;
  }
  const category = normalizeExpenseCategoryId(value.category);
  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString();
  const currency = asCurrency(value.currency);
  const expense: Expense = {
    id: value.id,
    amount: Math.max(0, amount),
    currency,
    category,
    dayKey: value.dayKey,
    note: optionalText(value.note),
    photoUris: Array.isArray(value.photoUris)
      ? value.photoUris.filter((uri): uri is string => typeof uri === 'string')
      : [],
    journalEntryId: optionalId(value.journalEntryId),
    reminderId: optionalId(value.reminderId),
    accountId: optionalId(value.accountId),
    cardId: optionalId(value.cardId),
    recurringSpendId: optionalId(value.recurringSpendId),
    createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : createdAt,
  };
  const snapshot = normalizeExpenseFxSnapshot(value, currency, createdAt);
  return snapshot ? { ...expense, ...snapshot } : expense;
}

/**
 * Purpose: keep a locked HKD snapshot when hydrating finance JSON; drop junk.
 * Inputs: raw expense object, resolved currency, createdAt fallback for convertedAt.
 * Outputs: snapshot fields or undefined (HKD / incomplete legacy rows).
 * Side effects: none.
 * Design decisions: require a finite homeAmount and quote HKD; do not invent a live conversion here.
 */
function normalizeExpenseFxSnapshot(
  value: Record<string, unknown>,
  currency: MoneyCurrency,
  createdAt: string,
): ExpenseFxSnapshot | undefined {
  if (currency === 'HKD') {
    return undefined;
  }
  const homeAmount = Number(value.homeAmount);
  if (!Number.isFinite(homeAmount) || homeAmount < 0) {
    return undefined;
  }
  const quote = value.quoteCurrency === 'HKD' || value.quoteCurrency === undefined ? 'HKD' : null;
  if (quote !== 'HKD') {
    return undefined;
  }
  const fxRate = Number(value.fxRate);
  const cardFeeRate = Number(value.cardFeeRate);
  const convertedAt =
    typeof value.convertedAt === 'string' && !Number.isNaN(Date.parse(value.convertedAt))
      ? value.convertedAt
      : createdAt;
  return {
    homeAmount: Math.round(homeAmount * 100) / 100,
    quoteCurrency: 'HKD',
    fxRate: typeof value.fxRate === 'number' && Number.isFinite(fxRate) && fxRate > 0 ? fxRate : 0,
    cardFeeRate: Number.isFinite(cardFeeRate) && cardFeeRate >= 0 ? cardFeeRate : 0,
    convertedAt,
  };
}

function normalizeRecurringSpend(raw: unknown): RecurringSpend | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const amount = Number(value.amount);
  if (typeof value.id !== 'string' || !Number.isFinite(amount)) {
    return null;
  }
  const category = normalizeExpenseCategoryId(value.category);
  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString();
  const weekdays = Array.isArray(value.weekdays)
    ? value.weekdays.filter((day): day is number => typeof day === 'number' && day >= 0 && day <= 6)
    : WEEKDAY_REPEAT;
  const frequency = normalizeRecurringFrequency(value.frequency);
  const dayOfWeek = Number(value.dayOfWeek);
  const dayOfMonth = normalizeRecurringDayOfMonth(value.dayOfMonth);
  return {
    id: value.id,
    amount: Math.max(0, amount),
    currency: asCurrency(value.currency),
    category,
    note: optionalText(value.note),
    weekdays: weekdays.length ? weekdays : WEEKDAY_REPEAT,
    ...(frequency ? { frequency } : {}),
    ...(Number.isFinite(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6
      ? { dayOfWeek: Math.floor(dayOfWeek) }
      : {}),
    ...(dayOfMonth !== undefined ? { dayOfMonth } : {}),
    cardId: optionalId(value.cardId),
    createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : createdAt,
  };
}

function normalizeRecurringFrequency(raw: unknown): RecurringSpend['frequency'] | undefined {
  if (raw === 'daily' || raw === 'weekday' || raw === 'weekly' || raw === 'monthly') {
    return raw;
  }
  return undefined;
}

function normalizeRecurringDayOfMonth(raw: unknown): RecurringSpend['dayOfMonth'] | undefined {
  if (raw === 'start' || raw === 'end') {
    return raw;
  }
  const day = Number(raw);
  if (Number.isFinite(day) && day >= 1 && day <= 31) {
    return Math.floor(day);
  }
  return undefined;
}

function normalizeIncome(raw: unknown): IncomeEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const amount = Number(value.amount);
  if (!Number.isFinite(amount)) {
    return null;
  }
  const currency = asCurrency(value.currency);
  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString();
  if (typeof value.dayKey === 'string') {
    const kind = INCOME_KINDS.includes(value.kind as IncomeKind) ? (value.kind as IncomeKind) : 'other';
    return {
      id: typeof value.id === 'string' ? value.id : `legacy-income-${value.dayKey}-${currency}`,
      kind,
      amount: Math.max(0, amount),
      currency,
      dayKey: value.dayKey,
      note: optionalText(value.note),
      journalEntryId: optionalId(value.journalEntryId),
      reminderId: optionalId(value.reminderId),
      createdAt,
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : createdAt,
    };
  }
  const year = Number(value.year);
  const month = Number(value.month);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }
  const dayKey = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return {
    id: `legacy-month-${year}-${month}-${currency}`,
    kind: 'other',
    amount: Math.max(0, amount),
    currency,
    dayKey,
    note: 'Imported monthly income',
    createdAt,
    updatedAt: createdAt,
  };
}

function normalizeBudget(raw: unknown): Budget | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const year = Number(value.year);
  const month = Number(value.month);
  const limit = Number(value.limit);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(limit)) {
    return null;
  }
  const category = normalizeExpenseCategoryId(value.category);
  return {
    id: typeof value.id === 'string' ? value.id : `budget-${year}-${month}-${category}-${asCurrency(value.currency)}`,
    year,
    month,
    category,
    limit: Math.max(0, limit),
    currency: asCurrency(value.currency),
  };
}

function normalizeAsset(raw: unknown): Asset | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') {
    return null;
  }
  const kind = ASSET_KINDS.includes(value.kind as AssetKind) ? (value.kind as AssetKind) : 'cash';
  const amount = Number(value.value);
  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString();
  return {
    id: value.id,
    kind,
    name: value.name,
    value: Number.isFinite(amount) ? Math.max(0, amount) : 0,
    currency: asCurrency(value.currency),
    note: optionalText(value.note),
    createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : createdAt,
  };
}

function normalizeLoan(raw: unknown): Loan | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') {
    return null;
  }
  const kind = LOAN_KINDS.includes(value.kind as LoanKind) ? (value.kind as LoanKind) : 'personal';
  const balance = Number(value.balance);
  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString();
  return {
    id: value.id,
    kind,
    name: value.name,
    balance: Number.isFinite(balance) ? Math.max(0, balance) : 0,
    currency: asCurrency(value.currency),
    reminderId: optionalId(value.reminderId),
    note: optionalText(value.note),
    createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : createdAt,
  };
}

function normalizeTransfer(raw: unknown): TransferEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const amount = Number(value.amount);
  if (
    typeof value.id !== 'string' ||
    typeof value.fromAssetId !== 'string' ||
    !Number.isFinite(amount) ||
    typeof value.dayKey !== 'string'
  ) {
    return null;
  }
  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString();
  return {
    id: value.id,
    fromAssetId: value.fromAssetId,
    toAssetId: optionalId(value.toAssetId),
    toCardId: optionalId(value.toCardId),
    amount: Math.max(0, amount),
    currency: asCurrency(value.currency),
    fee: typeof value.fee === 'number' && Number.isFinite(value.fee) ? Math.max(0, value.fee) : undefined,
    dayKey: value.dayKey,
    note: optionalText(value.note),
    createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : createdAt,
  };
}

/**
 * Purpose: hydrate one split-expense row; drop junk from local JSON.
 * Inputs: unknown split record.
 * Outputs: ExpenseSplit or null when required fields are missing/invalid.
 * Side effects: none.
 * Design decisions: require id, expenseId, finite total, and ≥1 valid share; default mode to equal.
 */
export function normalizeExpenseSplit(raw: unknown): ExpenseSplit | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const totalAmount = Number(value.totalAmount);
  if (
    typeof value.id !== 'string' ||
    typeof value.expenseId !== 'string' ||
    !Number.isFinite(totalAmount)
  ) {
    return null;
  }
  const shares = Array.isArray(value.shares)
    ? value.shares.map(normalizeExpenseSplitShare).filter((item): item is ExpenseSplitShare => item !== null)
    : [];
  if (shares.length === 0) {
    return null;
  }
  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString();
  const splitMode: ExpenseSplitMode = value.splitMode === 'custom' ? 'custom' : 'equal';
  return {
    id: value.id,
    expenseId: value.expenseId,
    totalAmount: Math.max(0, Math.round(totalAmount * 100) / 100),
    currency: asCurrency(value.currency),
    splitMode,
    shares,
    createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : createdAt,
  };
}

function normalizeExpenseSplitShare(raw: unknown): ExpenseSplitShare | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const amount = Number(value.amount);
  if (typeof value.id !== 'string' || typeof value.name !== 'string' || !Number.isFinite(amount)) {
    return null;
  }
  const name = value.name.trim();
  if (!name) {
    return null;
  }
  const isSettled = value.isSettled === true;
  const settledAt =
    typeof value.settledAt === 'string' && !Number.isNaN(Date.parse(value.settledAt))
      ? value.settledAt
      : undefined;
  return {
    id: value.id,
    name,
    amount: Math.max(0, Math.round(amount * 100) / 100),
    isSettled,
    ...(isSettled && settledAt ? { settledAt } : isSettled ? { settledAt: new Date().toISOString() } : {}),
  };
}

/**
 * Purpose: lift legacy cash/bank wallet rows into assets (credit-card rows were debt, not assets).
 */
function migrateLegacyAccounts(raw: unknown[]): Asset[] {
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const value = item as Record<string, unknown>;
      if (typeof value.id !== 'string' || typeof value.name !== 'string') {
        return null;
      }
      const kindRaw = value.kind as (typeof LEGACY_ACCOUNT_KINDS)[number];
      if (kindRaw === 'credit-card') {
        return null;
      }
      const kind: AssetKind = kindRaw === 'bank' ? 'bank' : 'cash';
      const balance = Number(value.balance);
      const createdAt = typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString();
      const asset: Asset = {
        id: value.id,
        kind,
        name: value.name,
        value: Number.isFinite(balance) ? Math.max(0, balance) : 0,
        currency: asCurrency(value.currency),
        createdAt,
        updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : createdAt,
      };
      return asset;
    })
    .filter((item): item is Asset => item !== null);
}

function optionalText(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

/**
 * Purpose: keep any non-empty category id (builtin or custom); junk → other.
 * Inputs: raw expense/budget/recurring category field.
 * Outputs: ExpenseCategory string.
 * Side effects: none.
 * Design decisions: do not remap unknown customs to other — soft-hidden settings rows still resolve.
 */
function normalizeExpenseCategoryId(raw: unknown): ExpenseCategory {
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  return 'other';
}

function optionalId(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw ? raw : undefined;
}
