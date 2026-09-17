/**
 * Adjusting work to the athlete in front of you, not the plan on paper
 * (PLAN.md §6.5).
 */

/** How far RPE may miss target before the remaining sets move. */
export const RPE_TOLERANCE = 1
export const SET_ADJUSTMENT_STEP = 0.05
/** Ceiling on cumulative within-session drift, so one bad set cannot spiral. */
export const MAX_SESSION_ADJUSTMENT = 0.15

export interface SetFeedback {
  loggedRpe: number
  targetRpe: number
}

/**
 * The multiplier for the remaining sets of an exercise, given how the last set
 * actually felt.
 *
 * Harder than target lowers the load, easier raises it, and the cumulative
 * adjustment is clamped: a single mis-entered RPE should not be able to halve
 * someone's working weight.
 */
export function nextSetMultiplier(
  feedback: SetFeedback,
  cumulativeAdjustment = 0,
): { multiplier: number; cumulativeAdjustment: number } {
  const miss = feedback.loggedRpe - feedback.targetRpe

  let delta = 0
  if (miss > RPE_TOLERANCE) delta = -SET_ADJUSTMENT_STEP
  else if (miss < -RPE_TOLERANCE) delta = SET_ADJUSTMENT_STEP

  const next = clamp(
    cumulativeAdjustment + delta,
    -MAX_SESSION_ADJUSTMENT,
    MAX_SESSION_ADJUSTMENT,
  )

  return { multiplier: 1 + next, cumulativeAdjustment: next }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Each answered 1 (worst) to 5 (best). */
export interface Readiness {
  sleep: number
  soreness: number
  energy: number
}

export interface ReadinessAdjustment {
  loadMultiplier: number
  /** True when the session should shed its last accessory slot. */
  dropLastAccessory: boolean
  /** Message key for the line shown above the session. */
  messageKey: string
}

export function readinessScore(readiness: Readiness): number {
  return readiness.sleep + readiness.soreness + readiness.energy
}

/**
 * Scales the session to how the athlete turned up.
 *
 * A bad-night session that still happens is worth far more than a perfect
 * session that gets skipped, so a low score trims the work rather than
 * cancelling it.
 */
export function readinessAdjustment(readiness: Readiness): ReadinessAdjustment {
  const score = readinessScore(readiness)

  if (score >= 12) {
    return {
      loadMultiplier: 1,
      dropLastAccessory: false,
      messageKey: 'coach.readiness.good',
    }
  }

  if (score >= 8) {
    return {
      loadMultiplier: 0.95,
      dropLastAccessory: false,
      messageKey: 'coach.readiness.moderate',
    }
  }

  return {
    loadMultiplier: 0.9,
    dropLastAccessory: true,
    messageKey: 'coach.readiness.low',
  }
}
