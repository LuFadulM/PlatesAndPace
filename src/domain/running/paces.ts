import { RACE_DISTANCES_KM, type RaceDistanceKey } from '../profile/types'
import { fiveKEquivalentSeconds, riegelPredictSeconds } from './riegel'
import { pacesFromVdot, vdotFromPerformance } from './vdot'

/**
 * Training paces from one recent effort (CLAUDE.md, rule 6): the effort
 * gives a VDOT, the VDOT gives every pace. Easy and long sit well above race
 * pace on purpose: the most common way an athlete stalls is running easy days
 * too hard, which leaves nothing for the two sessions that are meant to hurt.
 */
export interface RecentRun {
  km: number
  /** Total duration of the effort, in seconds. */
  seconds: number
}

/** Long runs sit at the slow end of the easy band. */
export const LONG_RUN_EASY_FACTOR = 1.03

/** Race predictions are shown as a band around the point estimate, never a promise. */
export const PREDICTION_BAND = 0.03

export interface TrainingPaces {
  vdot: number
  /** Current 5K-equivalent pace, seconds per kilometre, for continuity with logged runs. */
  fiveK: number
  interval: number
  repetition: number
  threshold: number
  marathon: number
  easy: number
  long: number
  /** Present only when the athlete named a target race: predicted race pace and its band. */
  goal?: number
  goalRange?: { fast: number; slow: number }
}

export function trainingPaces(recent: RecentRun, targetRace?: RaceDistanceKey): TrainingPaces {
  const vdot = vdotFromPerformance(recent.km * 1000, recent.seconds)
  const p = pacesFromVdot(vdot)
  const fiveK = fiveKEquivalentSeconds(recent.km, recent.seconds) / 5

  const paces: TrainingPaces = {
    vdot,
    fiveK,
    interval: p.interval,
    repetition: p.repetition,
    threshold: p.threshold,
    marathon: p.marathon,
    easy: p.easy,
    long: p.easy * LONG_RUN_EASY_FACTOR,
  }

  if (targetRace) {
    const km = RACE_DISTANCES_KM[targetRace]
    const goal = riegelPredictSeconds(recent.km, recent.seconds, km) / km
    paces.goal = goal
    paces.goalRange = { fast: goal * (1 - PREDICTION_BAND), slow: goal * (1 + PREDICTION_BAND) }
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
