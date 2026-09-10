import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { useThemeColors } from '../theme/ThemeProvider';
import { useTypography } from '../theme/TypographyProvider';
import { fonts, insetSurface, raisedSurface } from '../theme/tokens';
import { DayOfMonthStepper } from './DayOfMonthStepper';
import { GlassSurface } from './GlassSurface';

export interface CardBillingCycleCardProps {
  statementDay: number;
  dueDay: number;
  onStatementDayChange: (day: number) => void;
  onDueDayChange: (day: number) => void;
}

/**
 * Purpose: estimate interest-free grace days between statement cut-off and payment due.
 * Inputs: statementDay and dueDay (civil days 1–31).
 * Outputs: non-negative day count; wraps across month-end when due is earlier in the month.
 * Side effects: none.
 * Design decisions: uses a 30-day civil approximation (matches product copy) rather than
 *   calendar-accurate month lengths so steppers stay predictable for every month.
 */
export function calculateGracePeriodDays(statementDay: number, dueDay: number): number {
  const statement = clampDay(statementDay);
  const due = clampDay(dueDay);
  if (due >= statement) {
    return due - statement;
  }
  return 30 - statement + due;
}

/**
 * Purpose: neumorph card pairing statement & due day steppers with a live grace-period readout.
 * Inputs: current days (1–31) and change handlers.
 * Outputs: GlassSurface with header badges, cycle track, and two DayOfMonthSteppers.
 * Side effects: none (parents own draft state).
 * Design decisions: View-only presentation; grace math stays pure and exportable for tests;
 *   track visualizes statement→due span on a 31-day month line without owning navigation.
 */
export function CardBillingCycleCard({
  statementDay,
  dueDay,
  onStatementDayChange,
  onDueDayChange,
}: CardBillingCycleCardProps) {
  const colors = useThemeColors();
  const { t, intlLocale } = useI18n();
  const { type, scaleFontSize } = useTypography();

  const statement = clampDay(statementDay);
  const due = clampDay(dueDay);
  const graceDays = calculateGracePeriodDays(statement, due);
  const statementLabel = formatDayOfMonth(statement, intlLocale);
  const dueLabel = formatDayOfMonth(due, intlLocale);

  return (
    <GlassSurface style={styles.card} radius={22}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.iconWell, { backgroundColor: colors.accentSoft }]}>
            <Ionicons
              name="calendar-outline"
              size={18}
              color={colors.accent}
              accessible={false}
              importantForAccessibility="no"
            />
          </View>
          <Text style={[type.headline, styles.title, { color: colors.ink }]} numberOfLines={2}>
            {t('cardRewards.billingCycleTitle')}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
          <Text
            style={[styles.badgeText, { color: colors.accent, fontSize: scaleFontSize(12) }]}
            numberOfLines={2}
          >
            {t('cardRewards.gracePeriod', { days: graceDays })}
          </Text>
        </View>
      </View>

      <Text style={[type.footnote, { color: colors.muted }]} numberOfLines={2}>
        {t('cardRewards.statementToDue', {
          statement: statementLabel,
          due: dueLabel,
        })}
      </Text>

      <BillingCycleTrack statementDay={statement} dueDay={due} />

      <View style={styles.steppers}>
        <View style={styles.stepperCol}>
          <DayOfMonthStepper
            label={t('money.statementDate')}
            value={statement}
            onChange={onStatementDayChange}
          />
        </View>
        <View style={styles.stepperCol}>
          <DayOfMonthStepper
            label={t('money.dueDate')}
            value={due}
            onChange={onDueDayChange}
          />
        </View>
      </View>
    </GlassSurface>
  );
}

/**
 * Purpose: draw a month-line track with statement/due markers and a grace fill.
 * Inputs: clamped statement and due days.
 * Outputs: inset track with accent segment(s) and endpoint dots.
 * Side effects: none.
 * Design decisions: wrap-around cycles (due before statement) render two fill segments so
 *   the grace span is visible without a circular chart.
 */
function BillingCycleTrack({
  statementDay,
  dueDay,
}: {
  statementDay: number;
  dueDay: number;
}) {
  const colors = useThemeColors();
  const wraps = dueDay < statementDay;
  const statementPct = dayToPercent(statementDay);
  const duePct = dayToPercent(dueDay);

  return (
    <View style={styles.trackBlock} accessibilityRole="progressbar">
      <View style={[insetSurface(colors, 999), styles.track]}>
        {wraps ? (
          <>
            <View
              style={[
                styles.trackFill,
                {
                  left: `${statementPct}%`,
                  right: 0,
                  backgroundColor: colors.accent,
                },
              ]}
            />
            <View
              style={[
                styles.trackFill,
                {
                  left: 0,
                  width: `${duePct}%`,
                  backgroundColor: colors.accent,
                },
              ]}
            />
          </>
        ) : (
          <View
            style={[
              styles.trackFill,
              {
                left: `${statementPct}%`,
                width: `${Math.max(duePct - statementPct, 1)}%`,
                backgroundColor: colors.accent,
              },
            ]}
          />
        )}
        <View
          style={[
            raisedSurface(colors, 999),
            styles.marker,
            { left: `${statementPct}%`, backgroundColor: colors.accent },
          ]}
        />
        <View
          style={[
            raisedSurface(colors, 999),
            styles.marker,
            { left: `${duePct}%`, backgroundColor: colors.ink },
          ]}
        />
      </View>
      <View style={styles.trackLabels}>
        <Text style={[styles.trackLabel, { color: colors.faint }]} numberOfLines={1}>
          {statementDay}
        </Text>
        <Text style={[styles.trackLabel, { color: colors.faint, textAlign: 'right' }]} numberOfLines={1}>
          {dueDay}
        </Text>
      </View>
    </View>
  );
}

/**
 * Purpose: keep day-of-month in the valid monthly range.
 * Inputs: raw number.
 * Outputs: integer 1–31.
 * Side effects: none.
 */
function clampDay(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(31, Math.max(1, Math.round(value)));
}

/**
 * Purpose: map civil day 1–31 onto a 0–100% track position.
 * Inputs: day of month.
 * Outputs: percentage along the month line.
 * Side effects: none.
 */
function dayToPercent(day: number): number {
  return ((clampDay(day) - 1) / 30) * 100;
}

/**
 * Purpose: girlfriend-readable day label (15th in English; plain day otherwise).
 * Inputs: day 1–31, BCP-47 locale.
 * Outputs: display string for i18n interpolation.
 * Side effects: none.
 */
function formatDayOfMonth(day: number, locale: string): string {
  if (!locale.toLowerCase().startsWith('en')) {
    return String(day);
  }
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 14,
  },
  header: {
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    minWidth: 0,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontFamily: fonts.bodySemi,
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  trackBlock: {
    gap: 6,
  },
  track: {
    height: 12,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  trackFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 999,
    opacity: 0.72,
  },
  marker: {
    position: 'absolute',
    top: -2,
    width: 16,
    height: 16,
    marginLeft: -8,
    borderRadius: 999,
  },
  trackLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  trackLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.4,
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  steppers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  stepperCol: {
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 0,
  },
});
