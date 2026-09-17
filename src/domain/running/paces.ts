import { RACE_DISTANCES_KM, type RaceDistanceKey } from '../profile/types'
import { fiveKEquivalentSeconds, riegelPredictSeconds } from './riegel'

/**
 * Training paces as multipliers of current 5K pace (PLAN.md §6.7).
 *
 * Easy and long sit well above race pace on purpose: the most common way an
 * athlete stalls is running easy days too hard, which leaves nothing for the
 * two sessions that are supposed to be hard.
 */
export const PACE_MULTIPLIERS = {
  interval: 0.97,
  threshold: 1.06,
  easy: 1.3,
  long: 1.35,
} as const

export type PaceKey = keyof typeof PACE_MULTIPLIERS

export interface RecentRun {
  km: number
  /** Total duration of the effort, in seconds. */
  seconds: number
}

export interface TrainingPaces {
  /** Current 5K-equivalent pace, seconds per kilometre. */
  fiveK: number
  interval: number
  threshold: number
  easy: number
  long: number
  /** Present only when the athlete named a target race. */
  goal?: number
}

/**
 * Derives every training pace from one recent run, plus goal pace when a target
 * race is set. All values are seconds per kilometre.
 */
export function trainingPaces(recent: RecentRun, targetRace?: RaceDistanceKey): TrainingPaces {
  const fiveKSeconds = fiveKEquivalentSeconds(recent.km, recent.seconds)
  const fiveK = fiveKSeconds / 5

  const paces: TrainingPaces = {
    fiveK,
    interval: fiveK * PACE_MULTIPLIERS.interval,
    threshold: fiveK * PACE_MULTIPLIERS.threshold,
    easy: fiveK * PACE_MULTIPLIERS.easy,
    long: fiveK * PACE_MULTIPLIERS.long,
  }

  if (targetRace) {
    const km = RACE_DISTANCES_KM[targetRace]
    paces.goal = riegelPredictSeconds(recent.km, recent.seconds, km) / km
  }

  return paces
}

/**
 * True when a newly logged run beats what the stored paces imply, which is the
 * trigger to recompute every remaining session (PLAN.md §6.7).
 */
export function isFasterThanCurrent(recent: RecentRun, current: TrainingPaces): boolean {
  return fiveKEquivalentSeconds(recent.km, recent.seconds) / 5 < current.fiveK
}
