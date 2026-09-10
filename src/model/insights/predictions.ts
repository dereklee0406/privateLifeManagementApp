import type { Budget } from '../finance/Budget';
import type { Expense } from '../finance/Expense';
import { budgetProgressFor } from '../finance/financeStats';
import type { RecurringSpend } from '../finance/recurringSpend';
import { resolveRecurringSpendFrequency } from '../finance/recurringSpend';
import { daysUntilRenewal } from '../finance/subscriptionCockpit';
import { previousDayOfMonth, nextOrSameDayOfMonth, civilDaysBetween } from '../finance/cardHealth';
import { startOfLocalDay } from '../journal/journalStats';
import type { CreditCardAccount } from '../reminders/creditCards';
import { isReminderCompletedToday, type Reminder } from '../reminders/Reminder';
import { onceFireAt, type NextUpCard } from '../today/nextUp';
import { nextFireAt } from '../reminders/nextFire';
import type { MoneyCurrency } from '../settings/AppSettings';

/**
 * Purpose: one predictive Today/Insights line (local rules, no LLM, no push).
 * Inputs: pickTodayPrediction.
 * Outputs: at most one TodayPrediction. View localizes `lineKey`.
 * Side effects: none.
 */
export type TodayPredictionKind = 'due' | 'renewal' | 'pace' | 'writing';

export interface TodayPrediction {
  kind: TodayPredictionKind;
  href: string;
  lineKey: string;
  lineParams?: Record<string, string | number>;
  /** Reminder, card, or subscription id — used to skip a Next Up duplicate. */
  sourceId?: string;
}

export interface TodayPredictionInput {
  reminders: Reminder[];
  creditCards: CreditCardAccount[];
  recurringSpends: RecurringSpend[];
  expenses: Expense[];
  budgets: Budget[];
  journalDaysWrittenThisWeek: number;
  currency: MoneyCurrency;
  now: Date;
  nextUp: NextUpCard | null;
}

const CARD_DUE_HORIZON_DAYS = 3;
const RENEWAL_HORIZON_DAYS = 7;
const PACE_LEAD = 0.15;

interface RankedCandidate {
  prediction: TodayPrediction;
  rank: number;
}

/**
 * Purpose: pick at most one on-device prediction for Today (and Insights week echo).
 * Inputs: reminders, cards, subs, envelopes, writing days this week, Next Up, now.
 * Outputs: TodayPrediction or null.
 * Side effects: none.
 * Design decisions: priority is overdue/card due → sub renewal ≤7d → envelope pace →
 *   writing quiet Thu–Sun. If the candidate is the same reminder/card as Next Up, demote
 *   to the next kind so Today does not repeat the hero. No notifications.
 */
export function pickTodayPrediction(input: TodayPredictionInput): TodayPrediction | null {
  const skipId = input.nextUp?.id;
  const due = firstNotSkipped(dueCandidates(input), skipId);
  if (due) {
    return due;
  }
  const renewal = firstNotSkipped(renewalCandidates(input), skipId);
  if (renewal) {
    return renewal;
  }
  const pace = envelopePacePrediction(input);
  if (pace) {
    return pace;
  }
  return writingQuietPrediction(input);
}

/**
 * Purpose: drop a candidate that is already the Next Up hero.
 * Inputs: ranked list (best first), Next Up id.
 * Outputs: first remaining prediction or null.
 * Side effects: none.
 */
function firstNotSkipped(candidates: RankedCandidate[], skipId: string | undefined): TodayPrediction | null {
  for (const row of candidates) {
    if (skipId && row.prediction.sourceId === skipId) {
      continue;
    }
    return row.prediction;
  }
  return null;
}

/**
 * Purpose: overdue reminders plus cards that are unpaid-overdue or due within 3 days.
 * Inputs: prediction input.
 * Outputs: ranked due candidates.
 * Side effects: none.
 * Design decisions: due-today habits stay on Next Up; this layer is the *other* bill
 *   or a second overdue item. Child card pings are skipped (parent card holds amount).
 */
function dueCandidates(input: TodayPredictionInput): RankedCandidate[] {
  const rows: RankedCandidate[] = [];
  const now = input.now;

  for (const card of input.creditCards) {
    const nextDue = nextOrSameDayOfMonth(card.dueDayOfMonth, now);
    const lastDue = previousDayOfMonth(card.dueDayOfMonth, now);
    const daysToDue = civilDaysBetween(nextDue, now);
    const unpaid = card.amountDue !== undefined && Number.isFinite(card.amountDue) && card.amountDue > 0;
    const lastDuePassed = civilDaysBetween(now, lastDue) > 0 && daysToDue > 0;
    const overdue = lastDuePassed && unpaid;
    const dueAt = overdue ? lastDue : nextDue;
    const days = civilDaysBetween(dueAt, now);
    const near = days >= 0 && days <= CARD_DUE_HORIZON_DAYS;
    if (!overdue && !near) {
      continue;
    }
    const href = `/reminders/card/${card.id}`;
    if (overdue) {
      rows.push({
        rank: days,
        prediction: {
          kind: 'due',
          href,
          sourceId: card.id,
          lineKey: 'predictions.cardOverdue',
          lineParams: { title: card.name },
        },
      });
      continue;
    }
    rows.push({
      rank: days,
      prediction: {
        kind: 'due',
        href,
        sourceId: card.id,
        lineKey: days === 0 ? 'predictions.cardDueToday' : 'predictions.cardDue',
        lineParams: { title: card.name, days },
      },
    });
  }

  for (const item of input.reminders) {
    if (!item.enabled || item.accountId) {
      continue;
    }
    if (isReminderCompletedToday(item, now)) {
      continue;
    }
    const dueAt = item.recurrence.type === 'once' ? onceFireAt(item) : nextFireAt(item, now);
    if (!dueAt) {
      continue;
    }
    const days = Math.round((startOfLocalDay(dueAt) - startOfLocalDay(now)) / 86_400_000);
    if (days >= 0) {
      continue;
    }
    rows.push({
      rank: days,
      prediction: {
        kind: 'due',
        href: `/reminders/${item.id}`,
        sourceId: item.id,
        lineKey: 'predictions.overdue',
        lineParams: { title: item.title },
      },
    });
  }

  rows.sort((left, right) => left.rank - right.rank);
  return rows;
}

/**
 * Purpose: soonest monthly/weekly/yearly sub renewing within 7 days.
 * Inputs: prediction input.
 * Outputs: ranked renewal candidates.
 * Side effects: none.
 * Design decisions: daily/weekday coffee rules are not “renewals”. Title prefers note.
 */
function renewalCandidates(input: TodayPredictionInput): RankedCandidate[] {
  const rows: RankedCandidate[] = [];
  for (const item of input.recurringSpends) {
    if (item.currency !== input.currency) {
      continue;
    }
    const cadence = resolveRecurringSpendFrequency(item);
    if (cadence === 'daily' || cadence === 'weekday') {
      continue;
    }
    const days = daysUntilRenewal(item, input.now);
    if (days > RENEWAL_HORIZON_DAYS) {
      continue;
    }
    const title = item.note?.trim() || item.category;
    rows.push({
      rank: days,
      prediction: {
        kind: 'renewal',
        href: '/(tabs)/money?segment=subscriptions',
        sourceId: item.id,
        lineKey: days === 0 ? 'predictions.renewalToday' : 'predictions.renewal',
        lineParams: { title, days },
      },
    });
  }
  rows.sort((left, right) => left.rank - right.rank);
  return rows;
}

/**
 * Purpose: envelope that is ahead of calendar pace but not yet over.
 * Inputs: prediction input.
 * Outputs: pace prediction or null.
 * Side effects: none.
 * Design decisions: spent/limit vs dayOfMonth/daysInMonth, lead 15 points. Overspent
 *   envelopes are pressure, not pace. Worst lead wins. Reuses budgetProgressFor.
 */
function envelopePacePrediction(input: TodayPredictionInput): TodayPrediction | null {
  const year = input.now.getFullYear();
  const monthIndex = input.now.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const dayOfMonth = input.now.getDate();
  const daysLeft = daysInMonth - dayOfMonth;
  if (daysLeft < 1) {
    return null;
  }
  const elapsed = dayOfMonth / daysInMonth;
  const rows = budgetProgressFor(input.budgets, input.expenses, year, monthIndex, input.currency);
  let best: { category: string; percent: number; lead: number } | null = null;
  for (const row of rows) {
    if (row.budget.limit <= 0 || row.over || row.spent <= 0) {
      continue;
    }
    const ratio = row.spent / row.budget.limit;
    const lead = ratio - elapsed;
    if (lead < PACE_LEAD) {
      continue;
    }
    if (!best || lead > best.lead) {
      best = {
        category: row.budget.category,
        percent: Math.round(ratio * 100),
        lead,
      };
    }
  }
  if (!best) {
    return null;
  }
  return {
    kind: 'pace',
    href: '/(tabs)/money?segment=cashflow',
    lineKey: 'predictions.pace',
    lineParams: { percent: best.percent, category: best.category, days: daysLeft },
  };
}

/**
 * Purpose: blank journal week, only Thu–Sun (Mon–Wed silence is normal).
 * Inputs: prediction input.
 * Outputs: writing prediction or null.
 * Side effects: none.
 * Design decisions: same late-week window as the quiet reflection cue; no push.
 */
function writingQuietPrediction(input: TodayPredictionInput): TodayPrediction | null {
  const weekday = input.now.getDay();
  const lateWeek = weekday === 0 || weekday >= 4;
  if (!lateWeek || input.journalDaysWrittenThisWeek > 0) {
    return null;
  }
  return {
    kind: 'writing',
    href: '/compose?mode=text',
    lineKey: 'predictions.writing',
  };
}
