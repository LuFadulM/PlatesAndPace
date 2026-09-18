import { describe, expect, it } from 'vitest'
import { deloadAdvice, hasStalled, LOW_READINESS_DAYS, musclesAtMrv, painfulMovements, readinessIsLow } from '../deload'
import { VOLUME_LANDMARKS } from '../volume'

describe('hasStalled', () => {
  it('needs enough sessions before it will call anything', () => {
    expect(hasStalled([100])).toBe(false)
    expect(hasStalled([100, 100])).toBe(false)
  })

  it('calls a flat run of sessions stalled', () => {
    expect(hasStalled([100, 100, 100])).toBe(true)
  })

  it('calls a declining run stalled', () => {
    expect(hasStalled([105, 102, 100])).toBe(true)
  })

  it('does not call it stalled when the lift is still moving', () => {
    expect(hasStalled([100, 100, 102.5])).toBe(false)
  })

  it('only judges the most recent window', () => {
    // A long plateau that has just broken is not a stall.
    expect(hasStalled([100, 100, 100, 100, 105])).toBe(false)
  })
})

describe('readinessIsLow', () => {
  it('waits for a run of bad days', () => {
    expect(readinessIsLow([2, 2])).toBe(false)
    expect(readinessIsLow([2, 2, 2])).toBe(true)
  })

  it('ignores a single bad day among good ones', () => {
    expect(readinessIsLow([4, 1, 4, 4])).toBe(false)
  })

  it('needs every one of the recent days to be poor', () => {
    expect(readinessIsLow([2, 2, 4])).toBe(false)
  })

  it('reads only the latest days', () => {
    const scores = [5, 5, 5, ...Array(LOW_READINESS_DAYS).fill(2)]
    expect(readinessIsLow(scores)).toBe(true)
  })
})

describe('musclesAtMrv', () => {
  it('names the muscles that have reached what they can recover from', () => {
    const chest = VOLUME_LANDMARKS.chest.mrv
    expect(musclesAtMrv({ chest, back: 4 })).toEqual(['chest'])
  })

  it('leaves a muscle alone while it is still inside its range', () => {
    expect(musclesAtMrv({ chest: VOLUME_LANDMARKS.chest.mev })).toEqual([])
  })

  it('accepts landing just short, because the landmarks are estimates', () => {
    const justUnder = Math.ceil(VOLUME_LANDMARKS.quads.mrv * 0.96)
    expect(musclesAtMrv({ quads: justUnder })).toEqual(['quads'])
  })
})

describe('painfulMovements', () => {
  it('lets one bad day pass', () => {
    expect(painfulMovements({ back_squat: [2] })).toEqual([])
  })

  it('acts when the same movement hurts twice', () => {
    expect(painfulMovements({ back_squat: [2, 2] })).toEqual(['back_squat'])
  })

  it('ignores twinges, which are information rather than a signal', () => {
    expect(painfulMovements({ back_squat: [1, 1, 1] })).toEqual([])
  })

  it('counts only the reports that crossed the threshold', () => {
    expect(painfulMovements({ back_squat: [1, 3, 1, 3] })).toEqual(['back_squat'])
    expect(painfulMovements({ bench_press: [1, 3, 1] })).toEqual([])
  })

  it('has nothing to say when nothing was reported', () => {
    expect(painfulMovements()).toEqual([])
  })
})

describe('deloadAdvice', () => {
  const quiet = { lifts: [], readinessScores: [5, 5, 5] as (number | null)[], weeklySets: { chest: 6 } }

  it('says nothing when everything is fine', () => {
    const advice = deloadAdvice(quiet)
    expect(advice.recommended).toBe(false)
    expect(advice.triggers).toEqual([])
  })

  it('fires on a single trigger rather than waiting for all of them', () => {
    const advice = deloadAdvice({ ...quiet, lifts: [{ exerciseId: 'back_squat', e1rms: [140, 140, 138] }] })
    expect(advice.recommended).toBe(true)
    expect(advice.triggers).toEqual(['stalled'])
    expect(advice.stalledLifts).toEqual(['back_squat'])
  })

  it('reports every reason it found, so the athlete knows why', () => {
    const advice = deloadAdvice({
      lifts: [{ exerciseId: 'bench_press', e1rms: [100, 100, 100] }],
      readinessScores: [2, 2, 2],
      weeklySets: { chest: VOLUME_LANDMARKS.chest.mrv },
    })
    expect(advice.triggers).toEqual(['stalled', 'readiness', 'mrv'])
    expect(advice.overreachedMuscles).toEqual(['chest'])
  })

  it('treats a movement that keeps hurting as its own reason', () => {
    const advice = deloadAdvice({ ...quiet, painReports: { back_squat: [3, 2] } })
    expect(advice.triggers).toEqual(['joint_pain'])
    expect(advice.painfulLifts).toEqual(['back_squat'])
  })

  it('has nothing to say about an athlete who has logged nothing', () => {
    expect(deloadAdvice({ lifts: [], readinessScores: [], weeklySets: {} }).recommended).toBe(false)
  })
})

describe('readiness over consecutive days', () => {
  // The reader hands over one entry per calendar day, null where the athlete
  // did not answer, so "three days running" means what it says.
  it('does not fire on three flat gym days spread across a week', () => {
    expect(readinessIsLow([2, null, 2, null, 2])).toBe(false)
  })

  it('fires on three flat days in a row', () => {
    expect(readinessIsLow([5, null, 2, 2, 2])).toBe(true)
  })

  it('treats an unanswered day as breaking the run, not as a bad one', () => {
    expect(readinessIsLow([2, 2, null])).toBe(false)
  })
})
