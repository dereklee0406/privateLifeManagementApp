import type { Expense } from '../finance/Expense';
import { spendAmountIn } from '../finance/fx';
import { formatMoney } from '../finance/Expense';
import type { JournalEntry } from '../journal/JournalEntry';
import { getMoodDefinition, type MoodId } from '../journal/Mood';
import { startOfLocalDay } from '../journal/journalStats';
import type { CreditCardAccount } from '../reminders/creditCards';
import { nextFireAt } from '../reminders/nextFire';
import type { Reminder } from '../reminders/Reminder';
import type { MoneyCurrency, WeekStart } from '../settings/AppSettings';
import { toDayKey } from '../../utils/dateUtils';
import { lastFullWeek, thisWeekSoFar } from '../life/weekBounds';
import { nextOrSameDayOfMonth } from '../finance/cardHealth';

export interface TodayMoodLine {
  mood: MoodId;
  emoji: string;
  label: string;
  line: string;
}

export interface WeekSpendLine {
  thisWeek: number;
  lastWeek: number;
  currency: MoneyCurrency;
  line: string;
}

export interface UpcomingBillGlance {
  title: string;
  fireAt: Date;
  href: string;
  line: string;
}

/**
 * Purpose: today’s written mood, if she already kept a page today.
 * Inputs: journal entries and now.
 * Outputs: latest today’s mood line, or null when she has not written yet.
 * Side effects: none.
 * Design decisions: last page of the day wins; Neutral still counts as “already wrote.”
 */
export function todaysMoodLine(entries: JournalEntry[], now: Date = new Date()): TodayMoodLine | null {
  const todayKey = toDayKey(now);
  const today = entries
    .filter((entry) => toDayKey(new Date(entry.createdAt)) === todayKey)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const latest = today[0];
  if (!latest) {
    return null;
  }
  const mood = getMoodDefinition(latest.mood);
  return {
    mood: mood.id,
    emoji: mood.emoji,
    label: mood.label,
    line: `Today’s mood · ${mood.emoji} ${mood.label}`,
  };
}

/**
 * Purpose: sum home-currency spends whose dayKey sits in an inclusive range.
 * Inputs: expenses, home currency, from/to YYYY-MM-DD.
 * Outputs: total in `currency`. Foreign rows use locked HKD; missing snapshots are skipped.
 * Side effects: none.
 * Design decisions: no live convertAmount on saved rows.
 */
export function spendInDayRange(
  expenses: Expense[],
  currency: MoneyCurrency,
  fromKey: string,
  toKey: string,
): number {
  return expenses
    .filter((item) => item.dayKey >= fromKey && item.dayKey <= toKey)
    .reduce((sum, item) => sum + (spendAmountIn(item, currency) ?? 0), 0);
}

/**
 * Purpose: one line comparing this week’s spend (week-start–today) with last full week.
 * Inputs: expenses, reporting currency, now, weekStartsOn (same as Calendar).
 * Outputs: totals plus girlfriend-facing copy. No chart.
 * Side effects: none.
 */
export function weekSpendLine(
  expenses: Expense[],
  currency: MoneyCurrency,
  now: Date = new Date(),
  weekStartsOn: WeekStart = 'monday',
): WeekSpendLine {
  const current = thisWeekSoFar(now, weekStartsOn);
  const previous = lastFullWeek(now, weekStartsOn);
  const thisWeek = spendInDayRange(expenses, currency, current.startKey, current.endKey);
  const lastWeek = spendInDayRange(expenses, currency, previous.startKey, previous.endKey);
  let line: string;
  if (thisWeek === 0 && lastWeek === 0) {
    line = 'This week’s spend · nothing yet';
  } else if (thisWeek === 0) {
    line = `This week’s spend · nothing yet (last week ${formatMoney(lastWeek, currency)})`;
  } else if (lastWeek === 0) {
    line = `This week ${formatMoney(thisWeek, currency)} · last week was quiet`;
  } else {
    line = `This week ${formatMoney(thisWeek, currency)} · last week ${formatMoney(lastWeek, currency)}`;
  }
  return { thisWeek, lastWeek, currency, line };
}

/**
 * Purpose: soonest card due or financial bill within the next N local days.
 * Inputs: reminders, credit cards, horizon (default 7), now.
 * Outputs: one glance row or null when nothing is due in that window.
 * Side effects: none.
 * Design decisions: card accounts win over their child pings so the strip does not repeat the same bill.
 */
export function upcomingBillInDays(
  reminders: Reminder[],
  creditCards: CreditCardAccount[],
  days = 7,
  now: Date = new Date(),
): UpcomingBillGlance | null {
  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 23, 59, 59, 999);
  const todayStart = startOfLocalDay(now);
  const candidates: UpcomingBillGlance[] = [];

  for (const card of creditCards) {
    const due = nextOrSameDayOfMonth(card.dueDayOfMonth, now);
    if (due.getTime() < todayStart || due.getTime() > horizon.getTime()) {
      continue;
    }
    candidates.push({
      title: card.name,
      fireAt: due,
      href: `/reminders/card/${card.id}`,
      line: billLine(card.name, due, now),
    });
  }

  for (const item of reminders) {
    if (!item.enabled || item.categoryPath.top !== 'financial') {
      continue;
    }
    if (item.accountId) {
      continue;
    }
    const fireAt = nextFireAt(item, now);
    if (!fireAt || fireAt.getTime() > horizon.getTime()) {
      continue;
    }
    candidates.push({
      title: item.title,
      fireAt,
      href: `/reminders/${item.id}`,
      line: billLine(item.title, fireAt, now),
    });
  }

  candidates.sort((left, right) => left.fireAt.getTime() - right.fireAt.getTime());
  return candidates[0] ?? null;
}

function billLine(title: string, when: Date, now: Date): string {
  const days = Math.round((startOfLocalDay(when) - startOfLocalDay(now)) / 86_400_000);
  if (days <= 0) {
    return `${title} · due today`;
  }
  if (days === 1) {
    return `${title} · due tomorrow`;
  }
  return `${title} · due in ${days} days`;
}
