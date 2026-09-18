import { PARAMETERS } from './periodization'
import { VOLUME_LANDMARKS, type MuscleGroup } from './volume'

/**
 * When to stop pushing (CLAUDE.md, rule 2).
 *
 * A block deloads every fourth week whatever happens, but a body does not read
 * the calendar. These are the signals that say the athlete needs the easy week
 * now: the lift has stopped moving, they keep waking up wrecked, or the work
 * has piled up past what they can recover from. Any one of them is enough —
 * waiting for all three is how people get hurt.
 */

/** Sessions of no progress on a lift before it counts as stalled. */
export const STALL_SESSIONS = 2
/** Consecutive days of poor readiness before it counts. */
export const LOW_READINESS_DAYS = 3
/** Readiness at or below this, averaged over its three answers, is "low". */
export const LOW_READINESS_SCORE = 2.5
/**
 * How close to MRV counts as reaching it. Landmarks are estimates, so demanding
 * the exact number would mean the trigger almost never fires.
 */
export const MRV_MARGIN = 0.95

export type DeloadTrigger = 'stalled' | 'readiness' | 'mrv'

/** A lift's best estimated 1RM per session, oldest first. */
export interface LiftHistory {
  exerciseId: string
  e1rms: readonly number[]
}

export interface DeloadSignals {
  /** Per lift, the recent session estimates. */
  lifts: readonly LiftHistory[]
  /** Mean readiness per day the athlete answered, oldest first. */
  readinessScores: readonly number[]
  /** Hard sets done this week per muscle. */
  weeklySets: Partial<Record<MuscleGroup, number>>
}

export interface DeloadAdvice {
  recommended: boolean
  triggers: DeloadTrigger[]
  /** The lifts that stopped moving, for the message. */
  stalledLifts: string[]
  /** The muscles at or past what they can recover from. */
  overreachedMuscles: MuscleGroup[]
}

/**
 * A lift has stalled when its best set has not improved across the last
 * STALL_SESSIONS + 1 sessions. Equal counts as stalled: repeating a number is
 * not progress, and the estimate is noisy enough that demanding a strict
 * decline would let a genuine plateau run for months.
 */
export function hasStalled(e1rms: readonly number[]): boolean {
  const needed = STALL_SESSIONS + 1
  if (e1rms.length < needed) return false
  const window = e1rms.slice(-needed)
  const best = window[0]!
  return window.slice(1).every((value) => value <= best)
}

/** Readiness counts once it has been poor on every one of the last few days. */
export function readinessIsLow(scores: readonly number[]): boolean {
  if (scores.length < LOW_READINESS_DAYS) return false
  return scores.slice(-LOW_READINESS_DAYS).every((score) => score <= LOW_READINESS_SCORE)
}

/** Muscles whose weekly sets have reached what they can recover from. */
export function musclesAtMrv(weeklySets: Partial<Record<MuscleGroup, number>>): MuscleGroup[] {
  const reached: MuscleGroup[] = []
  for (const [muscle, sets] of Object.entries(weeklySets) as [MuscleGroup, number][]) {
    const landmarks = VOLUME_LANDMARKS[muscle]
    if (landmarks && sets >= landmarks.mrv * MRV_MARGIN) reached.push(muscle)
  }
  return reached
}

export function deloadAdvice(signals: DeloadSignals): DeloadAdvice {
  const stalledLifts = signals.lifts.filter((l) => hasStalled(l.e1rms)).map((l) => l.exerciseId)
  const overreachedMuscles = musclesAtMrv(signals.weeklySets)

  const triggers: DeloadTrigger[] = []
  if (stalledLifts.length > 0) triggers.push('stalled')
  if (readinessIsLow(signals.readinessScores)) triggers.push('readiness')
  if (overreachedMuscles.length > 0) triggers.push('mrv')

  return { recommended: triggers.length > 0, triggers, stalledLifts, overreachedMuscles }
}

/**
 * A taken deload expressed the way the session pipeline already understands
 * it, so an athlete who asks for an easy week gets exactly the week the
 * calendar would have given them in week four.
 */
export interface TakenDeload {
  volumeMultiplier: number
  loadMultiplier: number
}

export function takenDeload(): TakenDeload {
  return { volumeMultiplier: PARAMETERS.deload.volumeMultiplier, loadMultiplier: PARAMETERS.deload.loadMultiplier }
}
