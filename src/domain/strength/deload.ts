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

/** Times a movement must be reported painful before the engine acts on it. */
export const PAIN_REPORTS = 2
/** At or above this, a report counts: a one-out-of-three twinge is information, not a signal. */
export const PAIN_THRESHOLD = 2

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

export type DeloadTrigger = 'stalled' | 'readiness' | 'mrv' | 'joint_pain'

/** A lift's best estimated 1RM per session, oldest first. */
export interface LiftHistory {
  exerciseId: string
  e1rms: readonly number[]
}

export interface DeloadSignals {
  /** Per lift, the recent session estimates. */
  lifts: readonly LiftHistory[]
  /**
   * One entry per calendar day ending today, oldest first, with null on a day
   * the athlete did not answer. Days must be consecutive, not just the answers
   * that exist, or "three days running" is not what gets measured.
   */
  readinessScores: readonly (number | null)[]
  /** Hard sets done this week per muscle. */
  weeklySets: Partial<Record<MuscleGroup, number>>
  /** Per exercise, the severities reported recently, oldest first. */
  painReports?: Readonly<Record<string, readonly number[]>>
}

export interface DeloadAdvice {
  recommended: boolean
  triggers: DeloadTrigger[]
  /** The lifts that stopped moving, for the message. */
  stalledLifts: string[]
  /** The muscles at or past what they can recover from. */
  overreachedMuscles: MuscleGroup[]
  /** Movements that have hurt often enough to come out of the plan. */
  painfulLifts: string[]
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

/**
 * Readiness counts once it has been poor on every one of the last few calendar
 * days. An unanswered day breaks the run rather than being skipped over: three
 * flat gym days spread across a week is not the same thing as three flat days,
 * and the card says "three days running".
 */
export function readinessIsLow(scores: readonly (number | null)[]): boolean {
  if (scores.length < LOW_READINESS_DAYS) return false
  return scores
    .slice(-LOW_READINESS_DAYS)
    .every((score) => score !== null && score <= LOW_READINESS_SCORE)
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

/**
 * Movements the athlete has said hurt, often enough to mean it.
 *
 * Pain is the one signal that is not really about fatigue. One report is a bad
 * day; twice on the same movement is a pattern. The engine flags it and points
 * the athlete at the swap control rather than removing the movement itself: a
 * lift vanishing from the session without being asked is worse than a lift the
 * athlete decides to replace.
 */
export function painfulMovements(reports: Readonly<Record<string, readonly number[]>> = {}): string[] {
  return Object.entries(reports)
    .filter(([, severities]) => severities.filter((s) => s >= PAIN_THRESHOLD).length >= PAIN_REPORTS)
    .map(([exerciseId]) => exerciseId)
}

export function deloadAdvice(signals: DeloadSignals): DeloadAdvice {
  const stalledLifts = signals.lifts.filter((l) => hasStalled(l.e1rms)).map((l) => l.exerciseId)
  const overreachedMuscles = musclesAtMrv(signals.weeklySets)
  const painfulLifts = painfulMovements(signals.painReports)

  const triggers: DeloadTrigger[] = []
  if (stalledLifts.length > 0) triggers.push('stalled')
  if (readinessIsLow(signals.readinessScores)) triggers.push('readiness')
  if (overreachedMuscles.length > 0) triggers.push('mrv')
  if (painfulLifts.length > 0) triggers.push('joint_pain')

  return { recommended: triggers.length > 0, triggers, stalledLifts, overreachedMuscles, painfulLifts }
}

