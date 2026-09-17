/**
 * The weekly coach review (PLAN.md §6.8).
 *
 * Runs on the athlete's Monday, compares what was planned against what
 * happened, and adjusts the week ahead. The bias is deliberate: a week that
 * went badly gets *less* work, not a lecture. Volume the athlete cannot
 * complete is not training, it is a reason to stop opening the app.
 */

export const LOW_COMPLETION = 0.6
export const HIGH_COMPLETION = 0.9
/** How far above target the week's RPE has to sit before volume comes down. */
export const GRINDING_RPE_MARGIN = 1.5
/** How far below before the week gets harder. */
export const EASY_RPE_MARGIN = 1

export interface RpeSample {
  logged: number
  target: number
}

export interface WeekSummary {
  plannedSessions: number
  completedSessions: number
  rpeSamples: readonly RpeSample[]
}

export type ReviewVerdict = 'struggling' | 'grinding' | 'thriving' | 'on_track'

export interface ReviewOutcome {
  verdict: ReviewVerdict
  /** Applied to next week's set counts. */
  volumeMultiplier: number
  /** Applied to next week's loads. */
  loadMultiplier: number
  /** Extra sets added to each focus muscle next week. */
  extraFocusSets: number
  completionRate: number
  /** Median of (logged − target); null when nothing was logged. */
  medianRpeDelta: number | null
  /** Message key for the "Coach's weekly review" card. */
  messageKey: string
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!
}

/**
 * Medians rather than means, because one mis-tapped RPE of 10 in a week of
 * sevens should not rewrite the next week.
 */
export function weeklyReview(summary: WeekSummary): ReviewOutcome {
  const completionRate =
    summary.plannedSessions === 0
      ? 1
      : summary.completedSessions / summary.plannedSessions

  const medianRpeDelta = median(summary.rpeSamples.map((sample) => sample.logged - sample.target))

  // Order matters. Missed sessions are the strongest signal there is: an
  // athlete who trained twice out of five does not need a verdict on how hard
  // those two felt, they need a week they can actually finish.
  if (completionRate < LOW_COMPLETION) {
    return {
      verdict: 'struggling',
      volumeMultiplier: 0.85,
      loadMultiplier: 1,
      extraFocusSets: 0,
      completionRate,
      medianRpeDelta,
      messageKey: 'coach.review.struggling',
    }
  }

  if (medianRpeDelta !== null && medianRpeDelta >= GRINDING_RPE_MARGIN) {
    return {
      verdict: 'grinding',
      volumeMultiplier: 0.9,
      loadMultiplier: 1,
      extraFocusSets: 0,
      completionRate,
      medianRpeDelta,
      messageKey: 'coach.review.grinding',
    }
  }

  if (
    completionRate >= HIGH_COMPLETION &&
    medianRpeDelta !== null &&
    medianRpeDelta <= -EASY_RPE_MARGIN
  ) {
    return {
      verdict: 'thriving',
      volumeMultiplier: 1,
      loadMultiplier: 1.025,
      extraFocusSets: 1,
      completionRate,
      medianRpeDelta,
      messageKey: 'coach.review.thriving',
    }
  }

  return {
    verdict: 'on_track',
    volumeMultiplier: 1,
    loadMultiplier: 1,
    extraFocusSets: 0,
    completionRate,
    medianRpeDelta,
    messageKey: 'coach.review.onTrack',
  }
}
