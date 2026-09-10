import type { MoneyCurrency } from '../settings/AppSettings';
import { sortHistoryNewestFirst, type NetWorthHistoryRow } from './netWorthHistory';

/**
 * Purpose: one sparkline sample (oldest→newest) for Wallet Worth bars.
 * Inputs: netWorthSparkSeries.
 * Outputs: month stamp + net in home currency.
 * Side effects: none.
 */
export interface NetWorthSparkPoint {
  monthKey: string;
  net: number;
}

const SPARK_MONTHS = 12;
const BAR_FLOOR = 0.12;

/**
 * Purpose: last N monthly nets in home currency, oldest first, for View bars.
 * Inputs: history rows, reporting currency, optional cap (default 12).
 * Outputs: spark points; empty when there is no series for that currency.
 * Side effects: none.
 * Design decisions: math stays in Model. Newest-first storage is reversed so the chart
 *   reads left = older. Other currencies are omitted (Worth already filters the list).
 */
export function netWorthSparkSeries(
  history: NetWorthHistoryRow[],
  currency: MoneyCurrency,
  maxPoints: number = SPARK_MONTHS,
): NetWorthSparkPoint[] {
  const cap = Math.max(1, Math.floor(maxPoints));
  const scoped = sortHistoryNewestFirst(history).filter((row) => row.currency === currency);
  return scoped
    .slice(0, cap)
    .reverse()
    .map((row) => ({ monthKey: row.monthKey, net: row.net }));
}

/**
 * Purpose: map nets onto 0–1 bar heights (floor so a flat or tiny bar still reads).
 * Inputs: spark points from netWorthSparkSeries.
 * Outputs: parallel height ratios; empty when series is empty.
 * Side effects: none.
 * Design decisions: min–max of the window (not vs zero) so a high net still shows shape.
 *   All-equal nets → mid bars. View draws static Views (reduce-motion has nothing to skip).
 */
export function sparkBarRatios(points: NetWorthSparkPoint[]): number[] {
  if (points.length === 0) {
    return [];
  }
  const nets = points.map((point) => point.net);
  const min = Math.min(...nets);
  const max = Math.max(...nets);
  const span = max - min;
  if (span === 0) {
    return points.map(() => 0.5);
  }
  return nets.map((net) => BAR_FLOOR + (1 - BAR_FLOOR) * ((net - min) / span));
}
