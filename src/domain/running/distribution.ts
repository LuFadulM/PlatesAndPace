/**
 * 80/20 polarised training (CLAUDE.md, rule 6): about four fifths of the
 * week's running minutes stay easy. The hard fifth is the interval work and
 * the threshold block, not the jogs around them.
 */
export const EASY_SHARE_TARGET = 0.8

export interface RunMinutes {
  kind: 'easy' | 'long' | 'threshold' | 'interval' | 'run_walk' | 'none'
  minutes: number
  /** Minutes of the session actually at a hard pace; the rest is easy. */
  hardMinutes: number
}

export interface IntensityDistribution {
  easyMinutes: number
  hardMinutes: number
  totalMinutes: number
  easyShare: number
}

export function intensityDistribution(runs: readonly RunMinutes[]): IntensityDistribution {
  const totalMinutes = runs.reduce((sum, r) => sum + r.minutes, 0)
  const hardMinutes = runs.reduce((sum, r) => sum + Math.min(r.minutes, r.hardMinutes), 0)
  const easyMinutes = totalMinutes - hardMinutes
  return { easyMinutes, hardMinutes, totalMinutes, easyShare: totalMinutes === 0 ? 1 : easyMinutes / totalMinutes }
}

/** Easy minutes still needed for the hard minutes to be one fifth of the week. */
export function easyMinutesToAdd(distribution: IntensityDistribution, target = EASY_SHARE_TARGET): number {
  if (distribution.hardMinutes === 0) return 0
  const required = (distribution.hardMinutes * target) / (1 - target)
  return Math.max(0, Math.ceil(required - distribution.easyMinutes - 1e-9))
}

/** The most one week may grow over the last build week. */
export const MAX_WEEKLY_GROWTH = 0.1
