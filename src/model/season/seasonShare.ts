import {
  pillarStatus,
  pointsToNextRank,
  presentSeasonPillars,
  type PillarStatus,
  type SeasonPillarId,
  type SeasonRank,
  type SeasonRankId,
  type SeasonRankNudge,
  type SeasonTrend,
} from './seasonRank';

/**
 * Purpose: one present pillar on the Season share card (language-free).
 * Inputs: buildSeasonShareFacts.
 * Outputs: id + 0–1 rate + traffic-light status. View localizes.
 * Side effects: none.
 */
export interface SeasonSharePillar {
  id: SeasonPillarId;
  rate: number;
  status: PillarStatus;
}

/**
 * Purpose: language-free facts for the shareable Season card (image + web text).
 * Inputs: buildSeasonShareFacts.
 * Outputs: rank, 0–100 score, present pillars, optional week trend, optional next-rank nudge.
 * Side effects: none.
 */
export interface SeasonShareFacts {
  rank: SeasonRankId;
  score: number;
  pillars: SeasonSharePillar[];
  trend: SeasonTrend | null;
  nudge: SeasonRankNudge | null;
}

/**
 * Purpose: flatten a derived Season snapshot into a share payload (no pixels, no upload).
 * Inputs: computeSeasonRank result, optional week trend from computeSeasonTrend.
 * Outputs: SeasonShareFacts.
 * Side effects: none.
 * Design decisions: View captures the card via the same view-shot path as the month card.
 *   Missing habit/budget pillars stay omitted. Nudge is null at Steel.
 */
export function buildSeasonShareFacts(
  season: SeasonRank,
  trend: SeasonTrend | null,
): SeasonShareFacts {
  return {
    rank: season.rank,
    score: Math.round(season.score * 100),
    pillars: presentSeasonPillars(season).map((pillar) => ({
      id: pillar.id,
      rate: pillar.rate,
      status: pillarStatus(pillar.rate),
    })),
    trend,
    nudge: pointsToNextRank(season.score),
  };
}
