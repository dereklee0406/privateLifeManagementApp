import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FinanceController } from './FinanceController';
import { FinanceLocalStore } from '../data/FinanceLocalStore';
import { TrashLocalStore } from '../data/TrashLocalStore';
import type { RecurringSpend, RecurringSpendDraft } from '../model/finance/recurringSpend';
import { dueRecurringSpends } from '../model/finance/recurringSpend';
import type { QuickAddTemplate } from '../model/finance/quickAdd';
import type { ParsedVoiceSpend } from '../model/finance/voiceSpendParser';
import type { Asset, AssetDraft } from '../model/finance/Asset';
import type { Budget, BudgetDraft } from '../model/finance/Budget';
import type { Expense, ExpenseDraft } from '../model/finance/Expense';
import type { ExpenseSplit, ExpenseSplitDraft } from '../model/finance/ExpenseSplit';
import type { IncomeDraft, IncomeEntry } from '../model/finance/Income';
import type { Loan, LoanDraft } from '../model/finance/Loan';
import type { CardDebtInput } from '../model/finance/netWorth';
import type { NetWorthHistoryRow } from '../model/finance/netWorthHistory';
import type { SavingsTarget, SavingsTargetDraft } from '../model/finance/savingsTarget';
import type { TransferDraft, TransferEntry } from '../model/finance/Transfer';
import { expenseNeedsFxSnapshot, type FxRateTable } from '../model/finance/fx';
import { resolveCardFxFeeRate, type MoneyCurrency } from '../model/settings/AppSettings';
import { useFxRates } from './FxRateProvider';
import { useSettings } from './SettingsProvider';

interface FinanceContextValue {
  ready: boolean;
  expenses: Expense[];
  incomes: IncomeEntry[];
  budgets: Budget[];
  assets: Asset[];
  loans: Loan[];
  savingsTarget: SavingsTarget | undefined;
  netWorthHistory: NetWorthHistoryRow[];
  recurringSpends: RecurringSpend[];
  transfers: TransferEntry[];
  splits: ExpenseSplit[];
  /** Lookup of the active split for each expense id. */
  splitsByExpenseId: Map<string, ExpenseSplit>;
  /** Rules due today that have not been logged yet. */
  dueRepeats: RecurringSpend[];
  createExpense: (draft: ExpenseDraft) => Promise<Expense>;
  updateExpense: (id: string, draft: ExpenseDraft) => Promise<Expense>;
  deleteExpense: (id: string) => Promise<void>;
  restoreExpense: (expense: Expense) => Promise<void>;
  createIncome: (draft: IncomeDraft) => Promise<IncomeEntry>;
  deleteIncome: (id: string) => Promise<void>;
  upsertBudget: (draft: BudgetDraft) => Promise<Budget>;
  deleteBudget: (id: string) => Promise<void>;
  createAsset: (draft: AssetDraft) => Promise<Asset>;
  updateAsset: (id: string, draft: AssetDraft) => Promise<Asset>;
  deleteAsset: (id: string) => Promise<void>;
  createLoan: (draft: LoanDraft) => Promise<Loan>;
  updateLoan: (id: string, draft: LoanDraft) => Promise<Loan>;
  deleteLoan: (id: string) => Promise<void>;
  upsertSavingsTarget: (draft: SavingsTargetDraft) => Promise<SavingsTarget>;
  clearSavingsTarget: () => Promise<void>;
  recordMonthlyNetWorthSnapshot: (
    cards: CardDebtInput[],
    currency: MoneyCurrency,
    now?: Date,
  ) => Promise<NetWorthHistoryRow[]>;
  transferFunds: (draft: TransferDraft) => Promise<TransferEntry>;
  deleteTransfer: (id: string) => Promise<void>;
  saveSplit: (draft: ExpenseSplitDraft) => Promise<ExpenseSplit>;
  deleteSplit: (splitId: string) => Promise<void>;
  toggleShareSettled: (splitId: string, shareId: string) => Promise<ExpenseSplit>;
  createRecurringSpend: (draft: RecurringSpendDraft) => Promise<RecurringSpend>;
  deleteRecurringSpend: (id: string) => Promise<void>;
  logRecurringSpendInstant: (
    ruleId: string,
    now?: Date,
    fxTable?: FxRateTable | null,
    cardFeeRate?: number,
  ) => Promise<Expense>;
  /** 1-tap log a quick-add template (Morning Coffee, Lunch, MTR). */
  createQuickExpense: (template: QuickAddTemplate) => Promise<Expense>;
  /** Log a spend from on-device parsed voice input. */
  createVoiceExpense: (parsed: ParsedVoiceSpend) => Promise<Expense>;
  refresh: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

/**
 * Purpose: bind FinanceController to React.
 * Inputs: children tree.
 * Outputs: expenses, incomes, budgets, assets, loans, savings target, history, transfers, splits, mutators.
 * Side effects: loads and writes finance JSON; one-time FX snapshot backfill for legacy foreign spends.
 */
export function FinanceProvider({ children }: { children: ReactNode }) {
  const controller = useMemo(() => new FinanceController(new FinanceLocalStore(), new TrashLocalStore()), []);
  const { refreshRates, table } = useFxRates();
  const { settings, ready: settingsReady } = useSettings();
  const [ready, setReady] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [savingsTarget, setSavingsTarget] = useState<SavingsTarget | undefined>(undefined);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthHistoryRow[]>([]);
  const [recurringSpends, setRecurringSpends] = useState<RecurringSpend[]>([]);
  const [transfers, setTransfers] = useState<TransferEntry[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);

  const refresh = async () => {
    const [
      nextExpenses,
      nextIncomes,
      nextBudgets,
      nextAssets,
      nextLoans,
      nextTarget,
      nextHistory,
      nextRecurring,
      nextTransfers,
      nextSplits,
    ] = await Promise.all([
        controller.listExpenses(),
        controller.listIncomes(),
        controller.listBudgets(),
        controller.listAssets(),
        controller.listLoans(),
        controller.getSavingsTarget(),
        controller.listNetWorthHistory(),
        controller.listRecurringSpends(),
        controller.listTransfers(),
        controller.listSplits(),
      ]);
    let expensesWithFx = nextExpenses;
    if (nextExpenses.some(expenseNeedsFxSnapshot)) {
      const rates = await refreshRates();
      expensesWithFx = await controller.backfillExpenseFxSnapshots(rates, resolveCardFxFeeRate(settings));
    }
    setExpenses(expensesWithFx);
    setIncomes(nextIncomes);
    setBudgets(nextBudgets);
    setAssets(nextAssets);
    setLoans(nextLoans);
    setSavingsTarget(nextTarget);
    setNetWorthHistory(nextHistory);
    setRecurringSpends(nextRecurring);
    setTransfers(nextTransfers);
    setSplits(nextSplits);
    setReady(true);
  };

  useEffect(() => {
    if (!settingsReady) {
      return;
    }
    void refresh();
  }, [controller, settingsReady]);

  const dueRepeats = useMemo(
    () => dueRecurringSpends(recurringSpends, expenses),
    [recurringSpends, expenses],
  );

  const splitsByExpenseId = useMemo(() => {
    const map = new Map<string, ExpenseSplit>();
    for (const split of splits) {
      map.set(split.expenseId, split);
    }
    return map;
  }, [splits]);

  const value = useMemo<FinanceContextValue>(
    () => ({
      ready,
      expenses,
      incomes,
      budgets,
      assets,
      loans,
      savingsTarget,
      netWorthHistory,
      recurringSpends,
      transfers,
      splits,
      splitsByExpenseId,
      dueRepeats,
      createExpense: async (draft) => {
        const created = await controller.createExpense(draft);
        await refresh();
        return created;
      },
      updateExpense: async (id, draft) => {
        const updated = await controller.updateExpense(id, draft);
        await refresh();
        return updated;
      },
      deleteExpense: async (id) => {
        await controller.deleteExpense(id);
        await refresh();
      },
      restoreExpense: async (expense) => {
        await controller.restoreExpense(expense);
        await refresh();
      },
      createIncome: async (draft) => {
        const created = await controller.createIncome(draft);
        await refresh();
        return created;
      },
      deleteIncome: async (id) => {
        await controller.deleteIncome(id);
        await refresh();
      },
      upsertBudget: async (draft) => {
        const saved = await controller.upsertBudget(draft);
        await refresh();
        return saved;
      },
      deleteBudget: async (id) => {
        await controller.deleteBudget(id);
        await refresh();
      },
      createAsset: async (draft) => {
        const created = await controller.createAsset(draft);
        await refresh();
        return created;
      },
      updateAsset: async (id, draft) => {
        const updated = await controller.updateAsset(id, draft);
        await refresh();
        return updated;
      },
      deleteAsset: async (id) => {
        await controller.deleteAsset(id);
        await refresh();
      },
      createLoan: async (draft) => {
        const created = await controller.createLoan(draft);
        await refresh();
        return created;
      },
      updateLoan: async (id, draft) => {
        const updated = await controller.updateLoan(id, draft);
        await refresh();
        return updated;
      },
      deleteLoan: async (id) => {
        await controller.deleteLoan(id);
        await refresh();
      },
      upsertSavingsTarget: async (draft) => {
        const saved = await controller.upsertSavingsTarget(draft);
        await refresh();
        return saved;
      },
      clearSavingsTarget: async () => {
        await controller.clearSavingsTarget();
        await refresh();
      },
      recordMonthlyNetWorthSnapshot: async (cards, currency, now) => {
        const history = await controller.recordMonthlyNetWorthSnapshot(cards, currency, now);
        await refresh();
        return history;
      },
      transferFunds: async (draft) => {
        const created = await controller.transferFunds(draft);
        await refresh();
        return created;
      },
      deleteTransfer: async (id) => {
        await controller.deleteTransfer(id);
        await refresh();
      },
      saveSplit: async (draft) => {
        const saved = await controller.saveSplit(draft);
        await refresh();
        return saved;
      },
      deleteSplit: async (splitId) => {
        await controller.deleteSplit(splitId);
        await refresh();
      },
      toggleShareSettled: async (splitId, shareId) => {
        const updated = await controller.toggleShareSettled(splitId, shareId);
        await refresh();
        return updated;
      },
      createRecurringSpend: async (draft) => {
        const created = await controller.createRecurringSpend(draft);
        await refresh();
        return created;
      },
      deleteRecurringSpend: async (id) => {
        await controller.deleteRecurringSpend(id);
        await refresh();
      },
      logRecurringSpendInstant: async (ruleId, now, fxTable, cardFeeRate) => {
        const rates = fxTable !== undefined ? fxTable : table ?? (await refreshRates());
        const fee = cardFeeRate ?? resolveCardFxFeeRate(settings);
        const created = await controller.logRecurringSpendInstant(ruleId, now, rates, fee);
        await refresh();
        return created;
      },
      createQuickExpense: async (template) => {
        // HKD templates skip the network entirely so 1-tap logging stays instant.
        const rates = template.currency === 'HKD' ? undefined : table ?? (await refreshRates());
        const created = await controller.createQuickExpense(template, new Date(), rates, resolveCardFxFeeRate(settings));
        await refresh();
        return created;
      },
      createVoiceExpense: async (parsed) => {
        const currency = parsed.currency ?? settings.defaultCurrency;
        const rates = currency === 'HKD' ? undefined : table ?? (await refreshRates());
        const created = await controller.createVoiceExpense(
          parsed,
          new Date(),
          rates,
          resolveCardFxFeeRate(settings),
          settings.defaultCurrency,
        );
        await refresh();
        return created;
      },
      refresh,
    }),
    [
      ready,
      expenses,
      incomes,
      budgets,
      assets,
      loans,
      savingsTarget,
      netWorthHistory,
      recurringSpends,
      transfers,
      splits,
      splitsByExpenseId,
      dueRepeats,
      controller,
      table,
      settings,
    ],
  );

  return createElement(FinanceContext.Provider, { value }, children);
}

/**
 * Purpose: access finance use cases from views.
 */
export function useFinance(): FinanceContextValue {
  const value = useContext(FinanceContext);
  if (!value) {
    throw new Error('useFinance must be used inside FinanceProvider.');
  }
  return value;
}
