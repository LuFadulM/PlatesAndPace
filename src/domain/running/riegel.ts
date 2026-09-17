/**
 * Riegel's endurance model: T2 = T1 × (D2 / D1)^1.06 (PLAN.md §6.7).
 *
 * The exponent is what makes it useful — a flat 1.0 would predict that a runner
 * holds 5K pace over a half marathon. 1.06 is the standard fatigue factor.
 */
export const RIEGEL_EXPONENT = 1.06

/**
 * Predicts the time for `targetKm` from a known performance.
 *
 * Accuracy falls away as the two distances diverge, so callers extrapolating
 * far past the known effort should treat the result as a starting estimate that
 * the athlete's own logged runs will correct.
 */
export function riegelPredictSeconds(
  knownKm: number,
  knownSeconds: number,
  targetKm: number,
): number {
  if (knownKm <= 0 || targetKm <= 0) {
    throw new RangeError('distances must be positive')
  }
  if (knownSeconds <= 0) {
    throw new RangeError('time must be positive')
  }
  return knownSeconds * Math.pow(targetKm / knownKm, RIEGEL_EXPONENT)
}

/**
 * Normalises any recent effort to a 5K-equivalent time, the single number every
 * training pace is derived from.
 */
export function fiveKEquivalentSeconds(knownKm: number, knownSeconds: number): number {
  return riegelPredictSeconds(knownKm, knownSeconds, 5)
}

export function paceSecPerKm(km: number, seconds: number): number {
  if (km <= 0) throw new RangeError('distance must be positive')
  return seconds / km
}
