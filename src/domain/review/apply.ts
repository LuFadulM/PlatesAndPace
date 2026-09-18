import { getExercise } from '../exercises/library'
import { estimateSessionMinutes, type GymSession, type PlannedExercise, type SessionAdjustment } from '../plan/generator'
import { roundLoad, type PlateInventory } from '../strength/loads'
import { MAX_SESSION_SETS_PER_MUSCLE, type MuscleGroup } from '../strength/volume'
import { PARAMETERS } from '../strength/periodization'
import type { Units } from '../profile/types'
import type { ReviewOutcome } from '.'

/**
 * Turns last week's verdict into this week's session (PLAN.md §6.8).
 *
 * The review decides; this applies. A struggling week comes back smaller, a
 * grinding week keeps its weights but sheds sets, and a week the athlete
 * walked through gains a set on the muscles they care about and a little
 * weight on the bar. Every trim is recorded as an adjustment, because the
 * athlete should never find sets missing without being told why.
 */
export interface ApplyReviewOptions {
  /** Muscles the athlete asked to prioritise; they get the extra sets. */
  focus?: readonly MuscleGroup[]
  units: Units
  plates?: PlateInventory
}

/** Nothing to do: the identity outcome, so callers need no special case. */
function isNoop(outcome: ReviewOutcome): boolean {
  return outcome.volumeMultiplier === 1 && outcome.loadMultiplier === 1 && outcome.extraFocusSets === 0
}

/**
 * How many sets each exercise keeps.
 *
 * Scaling each exercise on its own and rounding does not work: four sets at
 * ×0.9 rounds back to four, so the coach promises less volume and delivers
 * exactly the same session. Instead the cut is taken against the session
 * total and then spent from the bottom up, one set at a time, the way the
 * generator trims for time (CLAUDE.md, rule 5). Accessories give way before
 * the opening compound, nothing falls below a single working set, and a
 * reduction always reduces something.
 */
function scaleSets(exercises: readonly PlannedExercise[], multiplier: number): number[] {
  const sets = exercises.map((e) => e.sets)
  if (multiplier >= 1) return sets

  const total = sets.reduce((a, b) => a + b, 0)
  const floor = exercises.length
  let target = Math.max(floor, Math.round(total * multiplier))
  if (target === total && total > floor) target = total - 1

  let remaining = total - target
  // Repeated passes from the bottom: the last exercise gives up a set, then
  // the one before it, round and round, so the cut lands evenly rather than
  // gutting the final movement.
  while (remaining > 0) {
    const before = remaining
    for (let i = sets.length - 1; i >= 0 && remaining > 0; i -= 1) {
      const current = sets[i]!
      if (current > 1) {
        sets[i] = current - 1
        remaining -= 1
      }
    }
    if (remaining === before) break // every exercise is down to its last set
  }
  return sets
}

export function applyReviewToSession(
  session: GymSession,
  outcome: ReviewOutcome,
  options: ApplyReviewOptions,
): GymSession {
  if (isNoop(outcome)) return session

  // With no focus areas chosen there is nothing for an extra set to land on,
  // so "stepping it up" would silently do nothing on most athletes. Fall back
  // to the muscle the session opens on: its main work.
  const chosen = options.focus ?? []
  const focus = new Set(chosen.length > 0 || session.exercises.length === 0
    ? chosen
    : [getExercise(session.exercises[0]!.exerciseId).primary])
  const adjustments: SessionAdjustment[] = []
  const scaled = scaleSets(session.exercises, outcome.volumeMultiplier)

  // Direct sets committed to each muscle after scaling, so an added set never
  // pushes a muscle past the per-session ceiling (CLAUDE.md, rule 2).
  const direct: Partial<Record<MuscleGroup, number>> = {}
  session.exercises.forEach((e, i) => {
    const primary = getExercise(e.exerciseId).primary
    direct[primary] = (direct[primary] ?? 0) + scaled[i]!
  })

  const exercises: PlannedExercise[] = session.exercises.map((e, i) => {
    const def = getExercise(e.exerciseId)
    let sets = scaled[i]!

    if (outcome.extraFocusSets > 0 && focus.has(def.primary)) {
      const room = Math.max(0, MAX_SESSION_SETS_PER_MUSCLE - (direct[def.primary] ?? 0))
      const added = Math.min(outcome.extraFocusSets, room)
      sets += added
      direct[def.primary] = (direct[def.primary] ?? 0) + added
    }

    if (sets < e.sets) {
      adjustments.push({ reason: 'review', exerciseId: e.exerciseId, setsRemoved: e.sets - sets, removed: false })
    }

    // The load nudge stacks on top of any double-progression bump the
    // resolver already applied. That is deliberate rather than double
    // counting: progression answers to one exercise clearing its rep range,
    // while a load multiplier only appears on a week that was both finished
    // and comfortable, which is evidence the whole programme is too light.
    const loadKg = e.loadKg > 0 && outcome.loadMultiplier !== 1
      ? roundLoad(e.loadKg * outcome.loadMultiplier, def.implement, options.units, options.plates)
      : e.loadKg

    return { ...e, sets, loadKg }
  })

  return {
    ...session,
    exercises,
    // The finisher is a one-off, not programmed volume, so it rides through
    // untouched; only the working sets answer to the review.
    estimatedMinutes: estimateSessionMinutes(exercises, Boolean(session.finisher)),
    adjustments: [...(session.adjustments ?? []), ...adjustments],
  }
}

/**
 * An easy week the athlete asked for, applied to one session.
 *
 * Volume and load are only half of a deload. The stored session also carries
 * the RPE target and the top-set technique the phase baked in at generation
 * time, so scaling sets alone leaves the athlete reading "light and easy on
 * purpose" above a primary lift still asking for RPE 9 and a top set. This
 * hands over the whole deload, the same numbers the calendar would have given
 * them in week four.
 */
export function applyDeloadToSession(session: GymSession, options: ApplyReviewOptions): GymSession {
  const deload = PARAMETERS.deload
  const scaled = applyReviewToSession(
    session,
    {
      verdict: 'struggling',
      volumeMultiplier: deload.volumeMultiplier,
      loadMultiplier: deload.loadMultiplier,
      extraFocusSets: 0,
      completionRate: 1,
      plannedSessions: 0,
      completedSessions: 0,
      medianRpeDelta: null,
      messageKey: deload.messageKey,
    },
    options,
  )

  const plain = (exercise: PlannedExercise): PlannedExercise => ({
    ...exercise,
    rpeTarget: Math.min(exercise.rpeTarget, deload.rpeTarget),
    // Top sets, drop sets and rest-pause are the opposite of a deload.
    technique: exercise.technique === 'tempo' ? 'tempo' : 'straight',
  })

  return {
    ...scaled,
    exercises: scaled.exercises.map(plain),
    finisher: scaled.finisher ? plain(scaled.finisher) : undefined,
  }
}
