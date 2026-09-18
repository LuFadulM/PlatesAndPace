import { describe, expect, it } from 'vitest'
import { applyDeloadToSession, applyReviewToSession, weeklyReview, type ReviewOutcome } from '..'
import type { GymSession, PlannedExercise } from '../../plan/generator'

const exercise = (over: Partial<PlannedExercise> & { exerciseId: string }): PlannedExercise => ({
  label: 'A', role: 'primary', sets: 4, repMin: 6, repMax: 10, rpeTarget: 8, loadKg: 60, restSec: 120, technique: 'straight', ...over,
})

const session = (over: Partial<GymSession> = {}): GymSession => ({
  kind: 'upper',
  titleKey: 'session.upper',
  intentKey: 'intent.build',
  warmupKey: 'warmup.upper',
  exercises: [
    exercise({ exerciseId: 'bench_press', sets: 4, loadKg: 60 }),
    exercise({ exerciseId: 'barbell_row', label: 'B', role: 'secondary', sets: 4, loadKg: 50 }),
    exercise({ exerciseId: 'lateral_raise', label: 'C', role: 'isolation', sets: 3, loadKg: 8 }),
  ],
  estimatedMinutes: 55,
  ...over,
})

const outcome = (over: Partial<ReviewOutcome> = {}): ReviewOutcome => ({
  verdict: 'on_track', volumeMultiplier: 1, loadMultiplier: 1, extraFocusSets: 0,
  completionRate: 1, plannedSessions: 4, completedSessions: 4, medianRpeDelta: 0, messageKey: 'coach.review.onTrack', ...over,
})

const opts = { units: 'metric' as const }

describe('applyReviewToSession', () => {
  it('returns the session untouched when the week was on track', () => {
    const s = session()
    expect(applyReviewToSession(s, outcome(), opts)).toBe(s)
  })

  it('trims a struggling week and says what it trimmed', () => {
    const result = applyReviewToSession(session(), outcome({ verdict: 'struggling', volumeMultiplier: 0.85 }), opts)
    // 11 sets planned, 15% off is 9; the cut comes from the bottom up.
    expect(result.exercises.map((e) => e.sets)).toEqual([4, 3, 2])
    // Loads are untouched: a missed week is a scheduling problem, not a strength one.
    expect(result.exercises.map((e) => e.loadKg)).toEqual([60, 50, 8])
    const trims = result.adjustments?.filter((a) => a.reason === 'review') ?? []
    expect(trims.map((a) => a.exerciseId)).toEqual(['barbell_row', 'lateral_raise'])
    expect(trims.every((a) => a.setsRemoved === 1 && !a.removed)).toBe(true)
  })

  it('keeps every exercise alive even at a brutal multiplier', () => {
    const result = applyReviewToSession(session(), outcome({ volumeMultiplier: 0.05 }), opts)
    expect(result.exercises.map((e) => e.sets)).toEqual([1, 1, 1])
    expect(result.exercises).toHaveLength(3)
    expect(result.adjustments?.every((a) => !a.removed)).toBe(true)
  })

  it('holds the weights but sheds sets after a grinding week', () => {
    const result = applyReviewToSession(session(), weeklyReview({
      plannedSessions: 4,
      completedSessions: 4,
      rpeSamples: [{ logged: 9.5, target: 8 }, { logged: 10, target: 8 }, { logged: 9.5, target: 8 }],
    }), opts)
    expect(result.exercises.map((e) => e.loadKg)).toEqual([60, 50, 8])
    const before = session().exercises.reduce((n, e) => n + e.sets, 0)
    const after = result.exercises.reduce((n, e) => n + e.sets, 0)
    expect(after).toBeLessThan(before)
    // The opening compound is the last thing to lose a set.
    expect(result.exercises[0]!.sets).toBe(4)
  })

  it('adds weight and a focus set after an easy week', () => {
    const result = applyReviewToSession(
      session(),
      outcome({ verdict: 'thriving', loadMultiplier: 1.025, extraFocusSets: 1 }),
      { ...opts, focus: ['chest'] },
    )
    const [bench, row, raise] = result.exercises
    expect(bench!.sets).toBe(5)
    expect(row!.sets).toBe(4)
    expect(raise!.sets).toBe(3)
    // 60 × 1.025 = 61.5, rounded to what a barbell can hold.
    expect(bench!.loadKg).toBeGreaterThan(60)
    expect(bench!.loadKg % 2.5).toBeCloseTo(0, 5)
  })

  it("steps up the session\u0027s main work when no focus areas were chosen", () => {
    const result = applyReviewToSession(session(), outcome({ verdict: 'thriving', extraFocusSets: 1 }), opts)
    // Bench opens the session, so chest is what gains the set.
    expect(result.exercises[0]!.sets).toBe(5)
    expect(result.exercises[1]!.sets).toBe(4)
  })

  it('never pushes a muscle past the per-session ceiling', () => {
    const heavy = session({
      exercises: [
        exercise({ exerciseId: 'bench_press', sets: 6 }),
        exercise({ exerciseId: 'incline_dumbbell_press', label: 'B', sets: 4 }),
      ],
    })
    const result = applyReviewToSession(heavy, outcome({ extraFocusSets: 2 }), { ...opts, focus: ['chest'] })
    const chestSets = result.exercises.reduce((n, e) => n + e.sets, 0)
    expect(chestSets).toBeLessThanOrEqual(10)
  })

  it('re-estimates the session length rather than lying about it', () => {
    const before = session()
    const after = applyReviewToSession(before, outcome({ volumeMultiplier: 0.85 }), opts)
    expect(after.estimatedMinutes).toBeLessThan(before.estimatedMinutes)
  })

  it('keeps adjustments the generator already recorded', () => {
    const withTrim = session({ adjustments: [{ reason: 'time', exerciseId: 'lateral_raise', setsRemoved: 1, removed: false }] })
    const result = applyReviewToSession(withTrim, outcome({ volumeMultiplier: 0.85 }), opts)
    expect(result.adjustments?.some((a) => a.reason === 'time')).toBe(true)
    expect(result.adjustments?.some((a) => a.reason === 'review')).toBe(true)
  })

  it('leaves the finisher out of the volume maths', () => {
    const withFinisher = session({ finisher: exercise({ exerciseId: 'burpee', label: 'F', role: 'finisher', sets: 3, loadKg: 0 }) })
    const result = applyReviewToSession(withFinisher, outcome({ volumeMultiplier: 0.5 }), opts)
    expect(result.finisher?.sets).toBe(3)
  })
})

describe('applyDeloadToSession', () => {
  const hard = session({
    exercises: [
      exercise({ exerciseId: 'bench_press', sets: 5, rpeTarget: 9, technique: 'top_set_backoff', loadKg: 80 }),
      exercise({ exerciseId: 'barbell_row', label: 'B', sets: 4, rpeTarget: 9, technique: 'drop_set', loadKg: 60 }),
    ],
  })

  it('takes the intensity down, not only the volume', () => {
    const result = applyDeloadToSession(hard, opts)
    for (const e of result.exercises) {
      expect(e.rpeTarget).toBeLessThanOrEqual(6)
      expect(e.technique).toBe('straight')
    }
  })

  it('still lightens the work', () => {
    const result = applyDeloadToSession(hard, opts)
    const before = hard.exercises.reduce((n, e) => n + e.sets, 0)
    const after = result.exercises.reduce((n, e) => n + e.sets, 0)
    expect(after).toBeLessThan(before)
    expect(result.exercises[0]!.loadKg).toBeLessThan(80)
  })

  it('never raises an RPE target that was already easy', () => {
    const easy = session({ exercises: [exercise({ exerciseId: 'bench_press', rpeTarget: 5 })] })
    expect(applyDeloadToSession(easy, opts).exercises[0]!.rpeTarget).toBe(5)
  })

  it('keeps a tempo prescription, which is not an intensity technique', () => {
    const tempo = session({ exercises: [exercise({ exerciseId: 'bench_press', technique: 'tempo' })] })
    expect(applyDeloadToSession(tempo, opts).exercises[0]!.technique).toBe('tempo')
  })
})
