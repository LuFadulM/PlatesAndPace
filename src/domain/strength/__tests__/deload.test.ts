import { describe, expect, it } from 'vitest'
import { deloadAdvice, hasStalled, LOW_READINESS_DAYS, musclesAtMrv, readinessIsLow } from '../deload'
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

describe('deloadAdvice', () => {
  const quiet = { lifts: [], readinessScores: [5, 5, 5], weeklySets: { chest: 6 } }

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

  it('has nothing to say about an athlete who has logged nothing', () => {
    expect(deloadAdvice({ lifts: [], readinessScores: [], weeklySets: {} }).recommended).toBe(false)
  })
})
