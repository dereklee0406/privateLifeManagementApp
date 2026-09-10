import type { Asset, AssetDraft } from '../model/finance/Asset';
import type { Budget, BudgetDraft } from '../model/finance/Budget';
import type { Expense, ExpenseDraft, ExpenseFxSnapshot } from '../model/finance/Expense';
import type { ExpenseSplit, ExpenseSplitDraft } from '../model/finance/ExpenseSplit';
import { isSplitDraftValid, recalculateEqualShares } from '../model/finance/ExpenseSplit';
import type { IncomeDraft, IncomeEntry } from '../model/finance/Income';
import type { Loan, LoanDraft } from '../model/finance/Loan';
import type { CardDebtInput } from '../model/finance/netWorth';
import { computeNetWorth } from '../model/finance/netWorth';
import type { NetWorthHistoryRow } from '../model/finance/netWorthHistory';
import { upsertMonthlySnapshot } from '../model/finance/netWorthHistory';
import type { SavingsTarget, SavingsTargetDraft } from '../model/finance/savingsTarget';
import { isSavingsTargetDraftValid } from '../model/finance/savingsTarget';
import type { TransferDraft, TransferEntry } from '../model/finance/Transfer';
import type { FinanceRepository } from '../model/finance/FinanceRepository';
import { persistMediaFile, removeMediaFile } from '../data/mediaStore';
import { createId } from '../utils/idUtils';
import type { RecurringSpend, RecurringSpendDraft } from '../model/finance/recurringSpend';
import { WEEKDAY_REPEAT, buildExpenseDraftFromRecurring } from '../model/finance/recurringSpend';
import { buildExpenseDraftFromTemplate, suggestQuickAdd, type QuickAddTemplate } from '../model/finance/quickAdd';
import { buildExpenseDraftFromVoice, type ParsedVoiceSpend } from '../model/finance/voiceSpendParser';
import type { MoneyCurrency } from '../model/settings/AppSettings';
import type { TrashRepository } from '../model/trash/TrashRepository';
import { upsertTrashItem } from '../model/trash/TrashRepository';
import {
  buildExpenseFxSnapshot,
  expenseNeedsFxSnapshot,
  hasExpenseFxSnapshot,
  type FxRateTable,
} from '../model/finance/fx';

/**
 * Purpose: orchestrate on-device personal accounting without bank APIs or ledgers.
 * Inputs: FinanceRepository plus drafts from the spend / income / Money forms.
 * Outputs: Expense, Income, Budget, Asset, Loan, Transfer, ExpenseSplit, savings target, history.
 * Side effects: JSON persistence; receipt photo copy via mediaStore.
 * Design decisions: net worth and leftover are derived in Model; this class only stores facts.
 *   Savings target + monthly snapshots persist on the finance document (same store as assets).
 */
export class FinanceController {
  constructor(
    private readonly repository: FinanceRepository,
    private readonly trash?: TrashRepository,
  ) {}

  async listExpenses(): Promise<Expense[]> {
    const { expenses } = await this.repository.load();
    return [...expenses].sort(
      (left, right) => right.dayKey.localeCompare(left.dayKey) || right.createdAt.localeCompare(left.createdAt),
    );
  }

  async listIncomes(): Promise<IncomeEntry[]> {
    const { incomes } = await this.repository.load();
    return [...incomes].sort(
      (left, right) => right.dayKey.localeCompare(left.dayKey) || right.createdAt.localeCompare(left.createdAt),
    );
  }

  async listBudgets(): Promise<Budget[]> {
    const { budgets } = await this.repository.load();
    return budgets;
  }

  async listAssets(): Promise<Asset[]> {
    const { assets } = await this.repository.load();
    return assets;
  }

  async listLoans(): Promise<Loan[]> {
    const { loans } = await this.repository.load();
    return loans;
  }

  /**
   * Purpose: read the persisted savings goal (if any).
   * Inputs: none (loads finance document).
   * Outputs: SavingsTarget or undefined.
   * Side effects: repository load.
   */
  async getSavingsTarget(): Promise<SavingsTarget | undefined> {
    const { savingsTarget } = await this.repository.load();
    return savingsTarget;
  }

  /**
   * Purpose: read monthly net-worth history newest first.
   * Inputs: none (loads finance document).
   * Outputs: NetWorthHistoryRow[].
   * Side effects: repository load.
   */
  async listNetWorthHistory(): Promise<NetWorthHistoryRow[]> {
    const { netWorthHistory } = await this.repository.load();
    return netWorthHistory ?? [];
  }

  async listTransfers(): Promise<TransferEntry[]> {
    const { transfers } = await this.repository.load();
    return [...(transfers ?? [])].sort(
      (left, right) => right.dayKey.localeCompare(left.dayKey) || right.createdAt.localeCompare(left.createdAt),
    );
  }

  /**
   * Purpose: list persisted expense splits newest first.
   * Inputs: none (loads finance document).
   * Outputs: ExpenseSplit[].
   * Side effects: repository load.
   */
  async listSplits(): Promise<ExpenseSplit[]> {
    const { splits } = await this.repository.load();
    return [...(splits ?? [])].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  /**
   * Purpose: create a spend, copying receipt photos into durable storage.
   */
  async createExpense(draft: ExpenseDraft): Promise<Expense> {
    const document = await this.repository.load();
    const nowIso = new Date().toISOString();
    const photoUris = await this.persistPhotos(draft.photoUris ?? []);
    let recurringSpendId = draft.recurringSpendId;
    let recurringSpends = document.recurringSpends ?? [];
    if (draft.weekdayRepeat) {
      const rule = this.buildRecurringSpend(draft, nowIso);
      recurringSpends = [rule, ...recurringSpends.filter((item) => item.id !== rule.id)];
      recurringSpendId = rule.id;
    }
    const expense: Expense = {
      id: createId(),
      amount: Math.max(0, draft.amount),
      currency: draft.currency,
      category: draft.category,
      dayKey: draft.dayKey,
      note: draft.note?.trim() || undefined,
      photoUris,
      journalEntryId: draft.journalEntryId,
      reminderId: draft.reminderId,
      accountId: draft.accountId,
      cardId: draft.cardId,
      recurringSpendId,
      createdAt: nowIso,
      updatedAt: nowIso,
      ...fxFieldsFromDraft(draft),
    };
    await this.repository.save({ ...document, expenses: [expense, ...document.expenses], recurringSpends });
    return expense;
  }

  /**
   * Purpose: update an existing spend in place (same id). Keeps leftover journal/reminder joins.
   */
  async updateExpense(id: string, draft: ExpenseDraft): Promise<Expense> {
    const document = await this.repository.load();
    const current = document.expenses.find((item) => item.id === id);
    if (!current) {
      throw new Error('Expense not found.');
    }
    const photoUris = await this.persistPhotos(draft.photoUris ?? []);
    const dropped = current.photoUris.filter((uri) => !photoUris.includes(uri));
    await Promise.all(dropped.map((uri) => removeMediaFile(uri)));
    const nowIso = new Date().toISOString();
    let recurringSpendId = draft.recurringSpendId ?? current.recurringSpendId;
    let recurringSpends = document.recurringSpends ?? [];
    if (draft.weekdayRepeat) {
      const rule = this.buildRecurringSpend(draft, nowIso, current.recurringSpendId);
      recurringSpends = [rule, ...recurringSpends.filter((item) => item.id !== rule.id)];
      recurringSpendId = rule.id;
    }
    const { homeAmount: _h, quoteCurrency: _q, fxRate: _r, cardFeeRate: _f, convertedAt: _c, ...currentBase } = current;
    const expense: Expense = {
      ...currentBase,
      amount: Math.max(0, draft.amount),
      currency: draft.currency,
      category: draft.category,
      dayKey: draft.dayKey,
      note: draft.note?.trim() || undefined,
      photoUris,
      accountId: draft.accountId,
      cardId: draft.cardId,
      journalEntryId: draft.journalEntryId ?? current.journalEntryId,
      reminderId: draft.reminderId ?? current.reminderId,
      recurringSpendId,
      updatedAt: nowIso,
      ...fxFieldsForUpdate(current, draft),
    };
    await this.repository.save({
      ...document,
      expenses: document.expenses.map((item) => (item.id === id ? expense : item)),
      recurringSpends,
    });
    return expense;
  }

  /**
   * Purpose: one-time lock for foreign spends that were saved before per-row snapshots.
   * Inputs: cached (or just-fetched) FX table, current card-fee fraction.
   * Outputs: sorted expenses; rows that needed a snapshot are persisted with homeAmount and never float again.
   * Side effects: finance JSON write when at least one row was backfilled.
   * Design decisions: skip when the pair is missing; do not live-convert on later reads.
   */
  async backfillExpenseFxSnapshots(table: FxRateTable | null, feeRate: number): Promise<Expense[]> {
    const document = await this.repository.load();
    const nowIso = new Date().toISOString();
    let changed = false;
    const expenses = document.expenses.map((item) => {
      if (!expenseNeedsFxSnapshot(item)) {
        return item;
      }
      const snapshot = buildExpenseFxSnapshot(item.amount, item.currency, table, feeRate, nowIso);
      if (!snapshot) {
        return item;
      }
      changed = true;
      return { ...item, ...snapshot };
    });
    if (changed) {
      await this.repository.save({ ...document, expenses });
    }
    return [...expenses].sort(
      (left, right) => right.dayKey.localeCompare(left.dayKey) || right.createdAt.localeCompare(right.createdAt),
    );
  }

  /**
   * Purpose: list weekday repeats for Money chips.
   */
  async listRecurringSpends(): Promise<RecurringSpend[]> {
    const { recurringSpends } = await this.repository.load();
    return recurringSpends ?? [];
  }

  /**
   * Purpose: create a recurring spend rule without logging today’s expense.
   * Inputs: RecurringSpendDraft from the repeat picker / rules form.
   * Outputs: persisted RecurringSpend.
   * Side effects: finance JSON write.
   */
  async createRecurringSpend(draft: RecurringSpendDraft): Promise<RecurringSpend> {
    const document = await this.repository.load();
    const nowIso = new Date().toISOString();
    const rule = this.buildRecurringSpend(draft, nowIso);
    const recurringSpends = [rule, ...(document.recurringSpends ?? [])];
    await this.repository.save({ ...document, recurringSpends });
    return rule;
  }

  /**
   * Purpose: 1-tap log today’s copy of a recurring rule with locked FX.
   * Inputs: rule id, optional now / FX table / card fee (caller may pass live rates).
   * Outputs: persisted Expense linked via recurringSpendId.
   * Side effects: finance JSON write (expense row); does not mutate the rule.
   * Design decisions: builds draft in Model then reuses createExpense so photos/FX paths stay one place.
   */
  async logRecurringSpendInstant(
    ruleId: string,
    now: Date = new Date(),
    fxTable?: FxRateTable | null,
    cardFeeRate: number = 0,
  ): Promise<Expense> {
    const document = await this.repository.load();
    const rule = (document.recurringSpends ?? []).find((item) => item.id === ruleId);
    if (!rule) {
      throw new Error('Recurring spend not found.');
    }
    const draft = buildExpenseDraftFromRecurring(rule, now, fxTable, cardFeeRate);
    return this.createExpense(draft);
  }

  /**
   * Purpose: 1-tap log a pre-configured quick-add template (Morning Coffee, Lunch, MTR).
   * Inputs: QuickAddTemplate from the Quick Spend Sheet, optional now / FX table / card fee.
   * Outputs: persisted Expense for today.
   * Side effects: finance JSON write (via createExpense).
   * Design decisions: draft is built in Model (buildExpenseDraftFromTemplate) then reuses
   *   createExpense so photo / FX / validation paths stay in one place; Controller stays thin.
   */
  async createQuickExpense(
    template: QuickAddTemplate,
    now: Date = new Date(),
    fxTable?: FxRateTable | null,
    cardFeeRate: number = 0,
  ): Promise<Expense> {
    const draft = buildExpenseDraftFromTemplate(template, now, fxTable, cardFeeRate);
    return this.createExpense(draft);
  }

  /**
   * Purpose: log a spend from parsed voice input (voice quick add).
   * Inputs: ParsedVoiceSpend from the on-device parser, optional now / FX table / card fee,
   *   and her default currency for when speech did not name one.
   * Outputs: persisted Expense for today.
   * Side effects: finance JSON write (via createExpense).
   * Design decisions: missing category falls back to the Smart Default from suggestQuickAdd so
   *   "35 dollars" still lands somewhere sensible; missing amount throws — never invent money.
   */
  async createVoiceExpense(
    parsed: ParsedVoiceSpend,
    now: Date = new Date(),
    fxTable?: FxRateTable | null,
    cardFeeRate: number = 0,
    defaultCurrency: MoneyCurrency = 'HKD',
  ): Promise<Expense> {
    const document = await this.repository.load();
    const fallbackCategory = suggestQuickAdd(document.expenses, now).category;
    const draft = buildExpenseDraftFromVoice(parsed, now, defaultCurrency, fallbackCategory, fxTable, cardFeeRate);
    if (!draft) {
      throw new Error('Voice spend needs an amount — try “Coffee 35”.');
    }
    return this.createExpense(draft);
  }

  /**
   * Purpose: stop a weekday repeat without deleting past spends.
   */
  async deleteRecurringSpend(id: string): Promise<void> {
    const document = await this.repository.load();
    await this.repository.save({
      ...document,
      recurringSpends: (document.recurringSpends ?? []).filter((item) => item.id !== id),
    });
  }

  /**
   * Purpose: put a spend back from Recently deleted (same id).
   */
  async restoreExpense(expense: Expense): Promise<void> {
    const document = await this.repository.load();
    if (document.expenses.some((item) => item.id === expense.id)) {
      return;
    }
    await this.repository.save({ ...document, expenses: [expense, ...document.expenses] });
  }

  async deleteExpense(id: string): Promise<void> {
    const document = await this.repository.load();
    const target = document.expenses.find((item) => item.id === id);
    if (target && this.trash) {
      const trashDoc = await this.trash.load();
      await this.trash.save(
        upsertTrashItem(trashDoc, {
          id: target.id,
          kind: 'spend',
          deletedAt: new Date().toISOString(),
          spend: target,
        }),
      );
    } else if (target) {
      await Promise.all(target.photoUris.map((uri) => removeMediaFile(uri)));
    }
    await this.repository.save({
      ...document,
      expenses: document.expenses.filter((item) => item.id !== id),
    });
  }

  async createIncome(draft: IncomeDraft): Promise<IncomeEntry> {
    const document = await this.repository.load();
    const nowIso = new Date().toISOString();
    const income: IncomeEntry = {
      id: createId(),
      kind: draft.kind,
      amount: Math.max(0, draft.amount),
      currency: draft.currency,
      dayKey: draft.dayKey,
      note: draft.note?.trim() || undefined,
      journalEntryId: draft.journalEntryId,
      reminderId: draft.reminderId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await this.repository.save({ ...document, incomes: [income, ...document.incomes] });
    return income;
  }

  async deleteIncome(id: string): Promise<void> {
    const document = await this.repository.load();
    await this.repository.save({
      ...document,
      incomes: document.incomes.filter((item) => item.id !== id),
    });
  }

  /**
   * Purpose: upsert one monthly envelope per category and currency.
   */
  async upsertBudget(draft: BudgetDraft): Promise<Budget> {
    const document = await this.repository.load();
    const existing = document.budgets.find(
      (item) =>
        item.year === draft.year &&
        item.month === draft.month &&
        item.category === draft.category &&
        item.currency === draft.currency,
    );
    const budget: Budget = {
      id: existing?.id ?? createId(),
      year: draft.year,
      month: draft.month,
      category: draft.category,
      limit: Math.max(0, draft.limit),
      currency: draft.currency,
    };
    const budgets = existing
      ? document.budgets.map((item) => (item.id === existing.id ? budget : item))
      : [budget, ...document.budgets];
    await this.repository.save({ ...document, budgets });
    return budget;
  }

  async deleteBudget(id: string): Promise<void> {
    const document = await this.repository.load();
    await this.repository.save({
      ...document,
      budgets: document.budgets.filter((item) => item.id !== id),
    });
  }

  async createAsset(draft: AssetDraft): Promise<Asset> {
    const document = await this.repository.load();
    const nowIso = new Date().toISOString();
    const asset: Asset = {
      id: createId(),
      kind: draft.kind,
      name: draft.name.trim() || labelFallback(draft.kind),
      value: Math.max(0, draft.value),
      currency: draft.currency,
      note: draft.note?.trim() || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await this.repository.save({ ...document, assets: [asset, ...document.assets] });
    return asset;
  }

  async updateAsset(id: string, draft: AssetDraft): Promise<Asset> {
    const document = await this.repository.load();
    const current = document.assets.find((item) => item.id === id);
    if (!current) {
      throw new Error('Asset not found.');
    }
    const asset: Asset = {
      ...current,
      kind: draft.kind,
      name: draft.name.trim() || current.name,
      value: Math.max(0, draft.value),
      currency: draft.currency,
      note: draft.note?.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    await this.repository.save({
      ...document,
      assets: document.assets.map((item) => (item.id === id ? asset : item)),
    });
    return asset;
  }

  async deleteAsset(id: string): Promise<void> {
    const document = await this.repository.load();
    await this.repository.save({
      ...document,
      assets: document.assets.filter((item) => item.id !== id),
    });
  }

  async createLoan(draft: LoanDraft): Promise<Loan> {
    const document = await this.repository.load();
    const nowIso = new Date().toISOString();
    const loan: Loan = {
      id: createId(),
      kind: draft.kind,
      name: draft.name.trim() || labelFallback(draft.kind),
      balance: Math.max(0, draft.balance),
      currency: draft.currency,
      reminderId: draft.reminderId,
      note: draft.note?.trim() || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await this.repository.save({ ...document, loans: [loan, ...document.loans] });
    return loan;
  }

  async updateLoan(id: string, draft: LoanDraft): Promise<Loan> {
    const document = await this.repository.load();
    const current = document.loans.find((item) => item.id === id);
    if (!current) {
      throw new Error('Loan not found.');
    }
    const loan: Loan = {
      ...current,
      kind: draft.kind,
      name: draft.name.trim() || current.name,
      balance: Math.max(0, draft.balance),
      currency: draft.currency,
      reminderId: draft.reminderId,
      note: draft.note?.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    await this.repository.save({
      ...document,
      loans: document.loans.map((item) => (item.id === id ? loan : item)),
    });
    return loan;
  }

  async deleteLoan(id: string): Promise<void> {
    const document = await this.repository.load();
    await this.repository.save({
      ...document,
      loans: document.loans.filter((item) => item.id !== id),
    });
  }

  /**
   * Purpose: persist a typed savings goal on the finance document.
   * Inputs: SavingsTargetDraft from the Worth form.
   * Outputs: SavingsTarget snapshot.
   * Side effects: finance JSON write.
   * Design decisions: same store as assets so backup includes the goal without a settings key.
   */
  async upsertSavingsTarget(draft: SavingsTargetDraft): Promise<SavingsTarget> {
    if (!isSavingsTargetDraftValid(draft)) {
      throw new Error('Savings target needs an amount greater than zero.');
    }
    const document = await this.repository.load();
    const savingsTarget: SavingsTarget = {
      amount: Math.max(0, draft.amount),
      currency: draft.currency,
      updatedAt: new Date().toISOString(),
    };
    await this.repository.save({ ...document, savingsTarget });
    return savingsTarget;
  }

  /**
   * Purpose: remove the savings goal without touching assets.
   * Inputs: none.
   * Outputs: void.
   * Side effects: finance JSON write (clears savingsTarget).
   */
  async clearSavingsTarget(): Promise<void> {
    const document = await this.repository.load();
    const { savingsTarget: _removed, ...rest } = document;
    await this.repository.save({ ...rest, savingsTarget: undefined });
  }

  /**
   * Purpose: write this month’s live net-worth row (upsert).
   * Inputs: card debt rows, reporting currency, optional now (tests).
   * Outputs: newest-first history after persist.
   * Side effects: finance JSON write.
   * Design decisions: live math stays in computeNetWorth; this only stores the month’s facts.
   */
  async recordMonthlyNetWorthSnapshot(
    cards: CardDebtInput[],
    currency: MoneyCurrency,
    now: Date = new Date(),
  ): Promise<NetWorthHistoryRow[]> {
    const document = await this.repository.load();
    const live = computeNetWorth(document.assets, document.loans, cards, currency);
    const netWorthHistory = upsertMonthlySnapshot(document.netWorthHistory ?? [], live, now);
    await this.repository.save({ ...document, netWorthHistory });
    return netWorthHistory;
  }

  /**
   * Purpose: transfer money between accounts or pay a credit card.
   * Inputs: TransferDraft (fromAssetId, toAssetId, toCardId, amount, currency, fee, dayKey, note).
   * Outputs: TransferEntry snapshot.
   * Side effects: atomically adjusts source and destination asset values, appends TransferEntry.
   * Design decisions: deduction includes fee if specified. If toAsset is present, its value increases.
   */
  async transferFunds(draft: TransferDraft): Promise<TransferEntry> {
    const document = await this.repository.load();
    const fromAsset = document.assets.find((item) => item.id === draft.fromAssetId);
    if (!fromAsset) {
      throw new Error('Source asset not found.');
    }
    const toAsset = draft.toAssetId ? document.assets.find((item) => item.id === draft.toAssetId) : undefined;
    if (draft.toAssetId && !toAsset) {
      throw new Error('Destination asset not found.');
    }

    const nowIso = new Date().toISOString();
    const fee = typeof draft.fee === 'number' && Number.isFinite(draft.fee) ? Math.max(0, draft.fee) : 0;
    const totalDeduction = draft.amount + fee;

    const transfer: TransferEntry = {
      id: createId(),
      fromAssetId: draft.fromAssetId,
      toAssetId: draft.toAssetId,
      toCardId: draft.toCardId,
      amount: Math.max(0, draft.amount),
      currency: draft.currency,
      fee: fee > 0 ? fee : undefined,
      dayKey: draft.dayKey,
      note: draft.note?.trim() || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const updatedAssets = document.assets.map((asset) => {
      if (asset.id === draft.fromAssetId) {
        return {
          ...asset,
          value: Math.max(0, asset.value - totalDeduction),
          updatedAt: nowIso,
        };
      }
      if (toAsset && asset.id === draft.toAssetId) {
        return {
          ...asset,
          value: asset.value + draft.amount,
          updatedAt: nowIso,
        };
      }
      return asset;
    });

    const transfers = [transfer, ...(document.transfers ?? [])];
    await this.repository.save({
      ...document,
      assets: updatedAssets,
      transfers,
    });

    return transfer;
  }

  async deleteTransfer(id: string): Promise<void> {
    const document = await this.repository.load();
    await this.repository.save({
      ...document,
      transfers: (document.transfers ?? []).filter((item) => item.id !== id),
    });
  }

  /**
   * Purpose: create or update a split for one expense (upsert by id or expenseId).
   * Inputs: ExpenseSplitDraft from the split form.
   * Outputs: persisted ExpenseSplit.
   * Side effects: writes finance JSON.
   * Design decisions: equal mode recomputes cent-safe shares; one split per expenseId.
   */
  async saveSplit(draft: ExpenseSplitDraft): Promise<ExpenseSplit> {
    const sharesForMode =
      draft.splitMode === 'equal' ? recalculateEqualShares(draft.totalAmount, draft.shares) : draft.shares;
    const normalizedDraft: ExpenseSplitDraft = { ...draft, shares: sharesForMode };
    if (!isSplitDraftValid(normalizedDraft)) {
      throw new Error('Split draft is invalid.');
    }
    const document = await this.repository.load();
    const existingSplits = document.splits ?? [];
    const existing =
      (draft.id ? existingSplits.find((item) => item.id === draft.id) : undefined) ??
      existingSplits.find((item) => item.expenseId === draft.expenseId);
    const nowIso = new Date().toISOString();
    const split: ExpenseSplit = {
      id: existing?.id ?? createId(),
      expenseId: draft.expenseId,
      totalAmount: Math.max(0, Math.round(draft.totalAmount * 100) / 100),
      currency: draft.currency,
      splitMode: draft.splitMode,
      shares: sharesForMode.map((share) => ({
        id: share.id || createId(),
        name: share.name.trim(),
        amount: Math.max(0, Math.round(share.amount * 100) / 100),
        isSettled: share.isSettled === true,
        ...(share.isSettled
          ? { settledAt: share.settledAt && !Number.isNaN(Date.parse(share.settledAt)) ? share.settledAt : nowIso }
          : {}),
      })),
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };
    const splits = [
      split,
      ...existingSplits.filter((item) => item.id !== split.id && item.expenseId !== split.expenseId),
    ];
    await this.repository.save({ ...document, splits });
    return split;
  }

  /**
   * Purpose: remove a split by id.
   * Inputs: splitId.
   * Outputs: void.
   * Side effects: writes finance JSON.
   */
  async deleteSplit(splitId: string): Promise<void> {
    const document = await this.repository.load();
    await this.repository.save({
      ...document,
      splits: (document.splits ?? []).filter((item) => item.id !== splitId),
    });
  }

  /**
   * Purpose: flip one participant's settled flag and timestamp.
   * Inputs: splitId and shareId.
   * Outputs: updated ExpenseSplit.
   * Side effects: writes finance JSON.
   */
  async toggleShareSettled(splitId: string, shareId: string): Promise<ExpenseSplit> {
    const document = await this.repository.load();
    const current = (document.splits ?? []).find((item) => item.id === splitId);
    if (!current) {
      throw new Error('Split not found.');
    }
    const share = current.shares.find((item) => item.id === shareId);
    if (!share) {
      throw new Error('Share not found.');
    }
    const nowIso = new Date().toISOString();
    const nextSettled = !share.isSettled;
    const split: ExpenseSplit = {
      ...current,
      shares: current.shares.map((item) => {
        if (item.id !== shareId) {
          return item;
        }
        if (nextSettled) {
          return { ...item, isSettled: true, settledAt: nowIso };
        }
        const { settledAt: _settledAt, ...rest } = item;
        return { ...rest, isSettled: false };
      }),
      updatedAt: nowIso,
    };
    await this.repository.save({
      ...document,
      splits: (document.splits ?? []).map((item) => (item.id === splitId ? split : item)),
    });
    return split;
  }

  private buildRecurringSpend(draft: RecurringSpendDraft, nowIso: string, existingId?: string): RecurringSpend {
    const weekdays = draft.weekdays?.length
      ? draft.weekdays
      : draft.frequency === 'weekly' && typeof draft.dayOfWeek === 'number'
        ? [draft.dayOfWeek]
        : draft.frequency === 'daily'
          ? [0, 1, 2, 3, 4, 5, 6]
          : WEEKDAY_REPEAT;
    return {
      id: existingId || createId(),
      amount: Math.max(0, draft.amount),
      currency: draft.currency,
      category: draft.category,
      note: draft.note?.trim() || undefined,
      weekdays,
      frequency: draft.frequency,
      dayOfWeek: draft.dayOfWeek,
      dayOfMonth: draft.dayOfMonth,
      cardId: draft.cardId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  private async persistPhotos(uris: string[]): Promise<string[]> {
    const unique = [...new Set(uris.filter(Boolean))].slice(0, 4);
    return Promise.all(unique.map((uri) => persistMediaFile(uri, 'photo')));
  }
}

function labelFallback(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

/**
 * Purpose: copy a draft snapshot onto a new spend; HKD and missing convert stay unlocked.
 * Inputs: expense draft from Log a spend.
 * Outputs: snapshot fields or empty.
 * Side effects: none.
 */
function fxFieldsFromDraft(draft: ExpenseDraft): ExpenseFxSnapshot | Record<string, never> {
  if (draft.currency === 'HKD' || !draft.fx) {
    return {};
  }
  return draft.fx;
}

/**
 * Purpose: lock or keep conversion on update — re-convert only when amount/currency change.
 * Inputs: stored expense, incoming draft.
 * Outputs: snapshot fields or empty (HKD / still waiting for rates).
 * Side effects: none.
 * Design decisions: note/date edits keep convertedAt. Explicit draft.fx wins. HKD clears the lock.
 */
function fxFieldsForUpdate(current: Expense, draft: ExpenseDraft): ExpenseFxSnapshot | Record<string, never> {
  if (draft.currency === 'HKD' || draft.fx === null) {
    return {};
  }
  if (draft.fx) {
    return draft.fx;
  }
  const amountSame = current.amount === Math.max(0, draft.amount) && current.currency === draft.currency;
  if (amountSame && hasExpenseFxSnapshot(current)) {
    return {
      homeAmount: current.homeAmount as number,
      quoteCurrency: 'HKD',
      fxRate: current.fxRate ?? 0,
      cardFeeRate: current.cardFeeRate ?? 0,
      convertedAt: current.convertedAt as string,
    };
  }
  return {};
}
