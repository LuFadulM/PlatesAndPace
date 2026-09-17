import type { ExperienceTier, PrimaryGoal } from '../profile/types'

/**
 * What each goal changes about a session (CLAUDE.md, coaching rule 3).
 *
 * Eight goals, eight signatures. The numbers below are the defaults a coach
 * would reach for; where the evidence is mixed the comment says so. Nothing
 * here is read at runtime from copy or configuration: a goal's policy is code,
 * reviewed and tested like the rest of the engine.
 */
export interface GoalPolicy {
  /** Multiplies the set count of every slot. */
  volumeScale: number
  /** Ceilings on the working RPE by kind of slot; the phase supplies the target. */
  maxRpe: { compound: number; isolation: number; power: number }
  /** Whether isolation work may reach true failure in the intensify week. */
  isolationToFailure: boolean
  /** Strength blocks pull the primary rep band down in the intensify week. */
  primaryRepShiftOnIntensify: number
  finisher: boolean
  supersets: boolean
  /** An explosive slot before the primary lift. */
  powerSlot: boolean
  /** Where mobility work sits, if anywhere. */
  mobilitySlot: 'none' | 'start' | 'end'
  /** Weeks of slow-tempo work before normal sets: pattern re-education. */
  tempoWeeks: number
  /** Full-body sessions regardless of how many days are available. */
  fullBodyOnly: boolean
  /** Extra cardio outside the lifting plan, in minutes a week of easy work. */
  weeklyEasyCardioMinutes: number
  /** Daily step target the plan asks for, when the goal calls for movement. */
  dailyStepTarget?: number
}

const BASE: GoalPolicy = {
  volumeScale: 1,
  maxRpe: { compound: 9, isolation: 10, power: 7 },
  isolationToFailure: true,
  primaryRepShiftOnIntensify: 0,
  finisher: false,
  supersets: false,
  powerSlot: false,
  mobilitySlot: 'none',
  tempoWeeks: 0,
  fullBodyOnly: false,
  weeklyEasyCardioMinutes: 0,
}

export const GOAL_POLICIES: Record<PrimaryGoal, GoalPolicy> = {
  // Volume-driven; the isolation work is where the last reps get spent.
  hypertrophy: { ...BASE },
  // Intensity-driven; volume low to moderate, and the top set comes down a rep
  // band in the intensify week (block periodization in miniature).
  strength: { ...BASE, volumeScale: 0.85, maxRpe: { compound: 9, isolation: 9, power: 7 }, isolationToFailure: false, primaryRepShiftOnIntensify: -1 },
  // Keep the strength stimulus, trim volume about a fifth, add density and steps.
  fat_loss: { ...BASE, volumeScale: 0.8, finisher: true, supersets: true, weeklyEasyCardioMinutes: 90, dailyStepTarget: 9000 },
  // Hypertrophy training at maintenance calories; the patience is in the copy.
  recomposition: { ...BASE, dailyStepTarget: 8000 },
  // Lifting supports the running: fewer lower-body sets, and interference rules apply.
  endurance: { ...BASE, volumeScale: 0.8, maxRpe: { compound: 8.5, isolation: 9, power: 7 }, isolationToFailure: false },
  // Power first, heavy compounds second, nothing to failure; the nervous system is the limit.
  athletic_performance: { ...BASE, volumeScale: 0.75, maxRpe: { compound: 8, isolation: 8.5, power: 7 }, isolationToFailure: false, powerSlot: true },
  // WHO minimums: two full-body sessions, 150 to 300 minutes of moderate cardio, mobility.
  general_health: { ...BASE, volumeScale: 0.7, maxRpe: { compound: 8, isolation: 8.5, power: 7 }, isolationToFailure: false, mobilitySlot: 'end', fullBodyOnly: true, weeklyEasyCardioMinutes: 150, dailyStepTarget: 7500 },
  // Pattern re-education: mobility first, slow tempo for two weeks, RPE never past 7.
  mobility_rehab: { ...BASE, volumeScale: 0.6, maxRpe: { compound: 7, isolation: 7, power: 6 }, isolationToFailure: false, mobilitySlot: 'start', tempoWeeks: 2, fullBodyOnly: true, weeklyEasyCardioMinutes: 90 },
}

export function goalPolicy(goal: PrimaryGoal): GoalPolicy {
  return GOAL_POLICIES[goal]
}

/**
 * Where a lifter starts on the volume ramp, by training age: a beginner at the
 * minimum effective dose, an advanced lifter in the middle of the adaptive
 * range. Expressed as a fraction of the distance from MEV to MRV.
 */
export function startingVolumeFraction(tier: ExperienceTier): number {
  switch (tier) {
    case 'beginner':
      return 0
    case 'intermediate':
      return 0.2
    case 'advanced':
      return 0.4
  }
}
