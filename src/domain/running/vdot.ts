/**
 * Daniels' VDOT: one number for aerobic fitness, read off a recent race, and
 * the training paces that follow from it (CLAUDE.md, rule 6).
 *
 * The two Daniels–Gilbert curves are public formulae:
 *   oxygen cost of running at v m/min:  VO2 = -4.60 + 0.182258·v + 0.000104·v²
 *   fraction of VO2max held for t min:  0.8 + 0.1894393·e^(-0.012778·t) + 0.2989558·e^(-0.1932605·t)
 * A race gives v and t; VDOT is VO2 divided by the fraction. Each training
 * pace is the speed at a fixed fraction of VDOT, inverted from the first curve.
 */
export const VDOT_FRACTIONS = {
  /** Conversational; the bulk of the mileage. Daniels: 59–74 percent, we sit mid-band. */
  easy: 0.66,
  marathon: 0.8,
  /** Comfortably hard, about an hour's race pace. */
  threshold: 0.86,
  /** Hard reps of 3 to 5 minutes at close to VO2max. */
  interval: 0.98,
  /** Short, fast, fully recovered: for economy and speed. */
  repetition: 1.06,
} as const

export type VdotPaceKey = keyof typeof VDOT_FRACTIONS

export function oxygenCost(metresPerMinute: number): number {
  return -4.6 + 0.182258 * metresPerMinute + 0.000104 * metresPerMinute ** 2
}

export function fractionOfMaxHeld(minutes: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes)
}

/** VDOT from a race or time trial. Short jogs give nonsense; expect at least ~1.5 km. */
export function vdotFromPerformance(metres: number, seconds: number): number {
  if (metres <= 0 || seconds <= 0) throw new RangeError('distance and time must be positive')
  const minutes = seconds / 60
  const velocity = metres / minutes
  return oxygenCost(velocity) / fractionOfMaxHeld(minutes)
}

/** Running speed, in metres per minute, that costs a given VO2. */
export function velocityForOxygenCost(vo2: number): number {
  const a = 0.000104
  const b = 0.182258
  const c = -4.6 - vo2
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
}

/** Seconds per kilometre at a fraction of VDOT. */
export function paceAtFraction(vdot: number, fraction: number): number {
  if (vdot <= 0) throw new RangeError('VDOT must be positive')
  const velocity = velocityForOxygenCost(vdot * fraction)
  return (1000 / velocity) * 60
}

export type VdotPaces = Record<VdotPaceKey, number>

export function pacesFromVdot(vdot: number): VdotPaces {
  return {
    easy: paceAtFraction(vdot, VDOT_FRACTIONS.easy),
    marathon: paceAtFraction(vdot, VDOT_FRACTIONS.marathon),
    threshold: paceAtFraction(vdot, VDOT_FRACTIONS.threshold),
    interval: paceAtFraction(vdot, VDOT_FRACTIONS.interval),
    repetition: paceAtFraction(vdot, VDOT_FRACTIONS.repetition),
  }
}

/**
 * The time a VDOT predicts for a distance: the race speed at which the oxygen
 * cost equals the fraction of VDOT that duration allows. Solved by bisection on
 * time, since the fraction depends on the answer.
 */
export function predictSecondsFromVdot(vdot: number, metres: number): number {
  let low = 60
  let high = 6 * 3600
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2
    const minutes = mid / 60
    const cost = oxygenCost(metres / minutes)
    const allowed = vdot * fractionOfMaxHeld(minutes)
    if (cost > allowed) low = mid
    else high = mid
  }
  return (low + high) / 2
}
