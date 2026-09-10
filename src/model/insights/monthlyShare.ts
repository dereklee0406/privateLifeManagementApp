import type { MonthlyInsightsReport } from './monthlyReport';
import type { InsightsPressure } from './pressure';
import type { SeasonRankId } from '../season/seasonRank';
import type { MoneyCurrency } from '../settings/AppSettings';
import { monthKeyFromDate } from '../finance/netWorthHistory';

/**
 * Purpose: language-free facts for the shareable month card (image + web text).
 * Inputs: buildMonthlyShareFacts.
 * Outputs: board pack + Season rank. View writes sentences.
 * Side effects: none.
 */
export interface MonthlyShareFacts {
  monthKey: string;
  seasonRank: SeasonRankId;
  pageCount: number;
  writingDays: number;
  habitPercent: number | null;
  spendPercentChange: number | null;
  hasPreviousSpend: boolean;
  spent: number;
  currency: MoneyCurrency;
  netWorthDelta: number | undefined;
  hasNetWorthSnapshot: boolean;
  pressure: InsightsPressure;
}

/**
 * Purpose: flatten monthly report + Season into a share payload (no pixels, no upload).
 * Inputs: computeMonthlyInsightsReport result, Season rank id, now.
 * Outputs: MonthlyShareFacts.
 * Side effects: none.
 * Design decisions: View captures the card; Model stays serializable for tests.
 *   Habit rate becomes a percent so the image does not do math.
 */
export function buildMonthlyShareFacts(
  report: MonthlyInsightsReport,
  seasonRank: SeasonRankId,
  now: Date = new Date(),
): MonthlyShareFacts {
  return {
    monthKey: monthKeyFromDate(now),
    seasonRank,
    pageCount: report.pageCount,
    writingDays: report.writingDays,
    habitPercent: report.habitHitRate === null ? null : Math.round(report.habitHitRate * 100),
    spendPercentChange: report.spendPercentChange,
    hasPreviousSpend: report.hasPreviousSpend,
    spent: report.spent,
    currency: report.currency,
    netWorthDelta: report.netWorthDelta,
    hasNetWorthSnapshot: report.hasNetWorthSnapshot,
    pressure: report.pressure,
  };
}
