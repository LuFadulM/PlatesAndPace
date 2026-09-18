/**
 * The four-week microcycle, repeated to fill a block (PLAN.md §6.6).
 */

export type Phase = 'calibration' | 'build' | 'intensify' | 'deload'

export interface PhaseParameters {
  phase: Phase
  /** Target RPE for the working sets. */
  rpeTarget: number
  /** Applied to the week's set count. */
  volumeMultiplier: number
  /** Applied to the week's loads. */
  loadMultiplier: number
  /** Whether the session opens with a heavy top set before back-offs. */
  topSet: boolean
  /** Whether the final slot uses a drop set or rest-pause. */
  intensityTechnique: boolean
  /** Message key for the one-line coach intent. */
  messageKey: string
}

export const PARAMETERS: Record<Phase, Omit<PhaseParameters, 'phase'>> = {
  calibration: {
    rpeTarget: 7.5,
    volumeMultiplier: 1,
    loadMultiplier: 1,
    topSet: false,
    intensityTechnique: false,
    messageKey: 'coach.phase.calibration',
  },
  build: {
    rpeTarget: 8.5,
    volumeMultiplier: 1,
    loadMultiplier: 1,
    topSet: true,
    intensityTechnique: false,
    messageKey: 'coach.phase.build',
  },
  intensify: {
    rpeTarget: 9,
    volumeMultiplier: 1,
    loadMultiplier: 1,
    topSet: true,
    intensityTechnique: true,
    messageKey: 'coach.phase.intensify',
  },
  deload: {
    rpeTarget: 6,
    volumeMultiplier: 0.55,
    loadMultiplier: 0.9,
    topSet: false,
    intensityTechnique: false,
    messageKey: 'coach.phase.deload',
  },
}

/** Back-off sets sit at this fraction of the day's top set. */
export const BACK_OFF_FRACTION = 0.85

export const DELOAD_EVERY = 4

/**
 * Which phase a given week of a block falls in.
 *
 * Every fourth week deloads, and so does the final week whatever its position —
 * a block should never hand the athlete straight from its hardest week into the
 * next block's calibration.
 */
export function weekPhase(week: number, totalWeeks: number): Phase {
  if (week < 1 || week > totalWeeks) {
    throw new RangeError(`week ${week} is outside a ${totalWeeks}-week block`)
  }

  if (week % DELOAD_EVERY === 0 || week === totalWeeks) return 'deload'

  switch (((week - 1) % DELOAD_EVERY) + 1) {
    case 1:
      return 'calibration'
    case 2:
      return 'build'
    default:
      return 'intensify'
  }
}

export function phaseParameters(week: number, totalWeeks: number): PhaseParameters {
  const phase = weekPhase(week, totalWeeks)
  return { phase, ...PARAMETERS[phase] }
}

/** The deload weeks of a block, for the calendar to mark. */
export function deloadWeeks(totalWeeks: number): number[] {
  const weeks: number[] = []
  for (let week = 1; week <= totalWeeks; week += 1) {
    if (weekPhase(week, totalWeeks) === 'deload') weeks.push(week)
  }
  return weeks
}
