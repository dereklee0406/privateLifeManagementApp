import { formatFriendlyMoney } from '../../model/finance/Expense';
import type { InsightsGlanceTile } from '../../model/insights/boardFacts';
import type { MonthlyInsightsReport } from '../../model/insights/monthlyReport';
import type { InsightsPressure } from '../../model/insights/pressure';
import type { TodayPrediction } from '../../model/insights/predictions';
import type { WeeklyInsightsReport } from '../../model/insights/weeklyReport';
import type { SeasonRankId } from '../../model/season/seasonRank';
import type { Translate } from './I18nProvider';

const PRESSURE_KEY: Record<InsightsPressure, string> = {
  quiet: 'insights.pressureQuiet',
  overdue: 'insights.pressureOverdue',
  budget: 'insights.pressureBudget',
  writing: 'insights.pressureWriting',
  habits: 'insights.pressureHabits',
  spendUp: 'insights.pressureSpendUp',
  worth: 'insights.pressureWorth',
  steady: 'insights.pressureSteady',
};

/**
 * Purpose: localize a Season rank id.
 * Inputs: t(), rank id.
 * Outputs: catalog string (Spark…Steel).
 * Side effects: none.
 */
export function localizeSeasonRank(t: Translate, rank: SeasonRankId): string {
  return t(`season.${rank}`);
}

const TILE_LABEL: Record<InsightsGlanceTile['id'], string> = {
  pages: 'insights.tilePages',
  writingDays: 'insights.tileWritingDays',
  habits: 'insights.tileHabits',
  spend: 'insights.tileSpend',
  worth: 'insights.tileWorth',
};

const TILE_INVITE: Partial<Record<InsightsGlanceTile['id'], string>> = {
  habits: 'insights.inviteHabit',
  worth: 'insights.inviteWorth',
};

/**
 * Purpose: tile kicker (Pages / Habit hits / Spent).
 * Inputs: translator + tile id.
 * Outputs: catalog string.
 * Side effects: none.
 */
export function localizeGlanceLabel(t: Translate, id: InsightsGlanceTile['id']): string {
  return t(TILE_LABEL[id]);
}

/**
 * Purpose: format the glance number — counts, %, money; em dash when the domain is missing.
 * Inputs: translator + tile (Model stays language-free).
 * Outputs: display string with tabular-friendly digits (no unit suffix except %).
 * Side effects: none.
 * Design decisions: Worth is the snapshot delta, so a signed amount is the number. Missing
 *   habits / Worth stay “—” rather than a faked 0.
 */
export function localizeGlanceValue(t: Translate, tile: InsightsGlanceTile): string {
  if (tile.value === null) {
    return t('insights.emptyMark');
  }
  if (tile.unit === 'percent') {
    return `${Math.round(tile.value)}%`;
  }
  if (tile.unit === 'money' && tile.currency) {
    const amount = formatFriendlyMoney(Math.abs(tile.value), tile.currency);
    if (tile.id === 'worth') {
      if (tile.value > 0) {
        return `+${amount}`;
      }
      if (tile.value < 0) {
        return `−${amount}`;
      }
    }
    return amount;
  }
  return String(Math.round(tile.value));
}

/**
 * Purpose: vs-last line under a glance number (or invite when the domain is empty).
 * Inputs: translator + tile.
 * Outputs: catalog string.
 * Side effects: none.
 * Design decisions: relative % for spend when Model has it; habit deltas are points
 *   (“+12 vs last” under an already-% number). First stretch uses deltaNone, not +0.
 */
export function localizeGlanceDelta(t: Translate, tile: InsightsGlanceTile): string {
  if (tile.value === null) {
    const inviteKey = TILE_INVITE[tile.id];
    return inviteKey ? t(inviteKey) : t('insights.deltaNone');
  }
  if (tile.id === 'worth') {
    return t('insights.worthVsSnapshot');
  }
  const delta = tile.delta;
  if (!delta || !delta.hasPrevious) {
    return t('insights.deltaNone');
  }
  if (delta.delta === 0) {
    return t('insights.deltaFlat');
  }
  if (tile.unit === 'money' && delta.percent !== null) {
    return delta.delta > 0
      ? t('insights.deltaUpPct', { percent: Math.abs(delta.percent) })
      : t('insights.deltaDownPct', { percent: Math.abs(delta.percent) });
  }
  if (tile.unit === 'money' && tile.currency) {
    const amount = formatFriendlyMoney(Math.abs(delta.delta), tile.currency);
    return delta.delta > 0
      ? t('insights.deltaUpMoney', { amount })
      : t('insights.deltaDownMoney', { amount });
  }
  const value = Math.abs(delta.delta);
  return delta.delta > 0
    ? t('insights.deltaUpCount', { value })
    : t('insights.deltaDownCount', { value });
}

/**
 * Purpose: localize one Today prediction line (Model stays language-free).
 * Inputs: translator + TodayPrediction.
 * Outputs: interpolated catalog string.
 * Side effects: none.
 * Design decisions: envelope category ids go through `types.*` like week chips.
 */
export function localizeTodayPrediction(t: Translate, prediction: TodayPrediction): string {
  const params = { ...prediction.lineParams };
  if (typeof params.category === 'string') {
    params.category = t(`types.${params.category}`);
  }
  return t(prediction.lineKey, params);
}

/**
 * Purpose: rule-based This week sentences from Model facts.
 * Inputs: translator + weekly report.
 * Outputs: page / habit / spend / pressure lines (View only).
 * Side effects: none.
 * Design decisions: Model stays language-free; money uses formatFriendlyMoney like Today chips.
 */
export function localizeWeeklyInsights(t: Translate, report: WeeklyInsightsReport): {
  pagesLine: string;
  habitLine: string;
  spendLine: string;
  pressureLine: string;
} {
  const pagesLine =
    report.pageCount === 0
      ? t('insights.pagesNone')
      : report.daysWritten === 1
        ? t('insights.pagesLineOneDay', { count: report.pageCount })
        : t('insights.pagesLine', { days: report.daysWritten, count: report.pageCount });
  const habitLine =
    report.habitHitRate === null
      ? t('insights.habitNone')
      : t('insights.habitLine', { percent: Math.round(report.habitHitRate * 100) });
  const spendLine =
    report.spendTotal > 0
      ? t('insights.spendLine', { amount: formatFriendlyMoney(report.spendTotal, report.currency) })
      : t('insights.spendNone');
  return {
    pagesLine,
    habitLine,
    spendLine,
    pressureLine: t(PRESSURE_KEY[report.pressure]),
  };
}

/**
 * Purpose: rule-based This month board-pack sentences from Model facts.
 * Inputs: translator + monthly report.
 * Outputs: pages / habits / spend-compare / net-worth / pressure lines.
 * Side effects: none.
 */
export function localizeMonthlyInsights(t: Translate, report: MonthlyInsightsReport): {
  pagesLine: string;
  habitLine: string;
  spendCompareLine: string;
  netWorthLine: string;
  pressureLine: string;
} {
  const pagesLine =
    report.pageCount === 0
      ? t('insights.pagesNone')
      : report.writingDays === 1
        ? t('insights.pagesLineOneDay', { count: report.pageCount })
        : t('insights.pagesLine', { days: report.writingDays, count: report.pageCount });
  const habitLine =
    report.habitHitRate === null
      ? t('insights.habitNone')
      : t('insights.habitLine', { percent: Math.round(report.habitHitRate * 100) });
  let spendCompareLine = t('insights.spendNoCompare');
  if (report.hasPreviousSpend && report.spendPercentChange !== null) {
    const percent = Math.abs(report.spendPercentChange);
    if (report.spendPercentChange > 0) {
      spendCompareLine = t('insights.spendUp', { percent });
    } else if (report.spendPercentChange < 0) {
      spendCompareLine = t('insights.spendDown', { percent });
    } else {
      spendCompareLine = t('insights.spendSame');
    }
  } else if (report.spent > 0) {
    spendCompareLine = t('insights.spendLine', { amount: formatFriendlyMoney(report.spent, report.currency) });
  }
  let netWorthLine = t('insights.netWorthNone');
  if (report.hasNetWorthSnapshot) {
    if (report.netWorthDelta === undefined) {
      netWorthLine = t('insights.netWorthNone');
    } else if (report.netWorthDelta > 0) {
      netWorthLine = t('insights.netWorthUp', {
        amount: formatFriendlyMoney(report.netWorthDelta, report.currency),
      });
    } else if (report.netWorthDelta < 0) {
      netWorthLine = t('insights.netWorthDown', {
        amount: formatFriendlyMoney(Math.abs(report.netWorthDelta), report.currency),
      });
    } else {
      netWorthLine = t('insights.netWorthFlat');
    }
  }
  return {
    pagesLine,
    habitLine,
    spendCompareLine,
    netWorthLine,
    pressureLine: t(PRESSURE_KEY[report.pressure]),
  };
}
