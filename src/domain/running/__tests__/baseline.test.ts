import { describe, expect, it } from 'vitest'
import { improvedBaseline, isEvidence, MAX_IMPROVEMENT, MIN_EVIDENCE_KM, racePredictions } from '../baseline'
import { fiveKEquivalentSeconds } from '../riegel'

// A 25:00 5K: the athlete who walks in off the street.
const fiveKIn25 = { km: 5, seconds: 25 * 60 }

describe('isEvidence', () => {
  it('ignores anything too short to extrapolate from', () => {
    expect(isEvidence({ km: 0.4, seconds: 80 })).toBe(false)
    expect(isEvidence({ km: MIN_EVIDENCE_KM, seconds: 900 })).toBe(true)
  })

  it('ignores a run with no time on it', () => {
    expect(isEvidence({ km: 10, seconds: 0 })).toBe(false)
  })
})

describe('improvedBaseline', () => {
  it('keeps the onboarding effort when nothing has been logged', () => {
    expect(improvedBaseline(fiveKIn25, [])).toEqual({ km: 5, seconds: 25 * 60 })
  })

  it('has no baseline at all for someone who never gave one', () => {
    expect(improvedBaseline(undefined, [])).toBeUndefined()
  })

  it('learns from the first qualifying run when onboarding gave nothing', () => {
    const result = improvedBaseline(undefined, [{ km: 10, seconds: 50 * 60 }])
    expect(result?.seconds).toBeCloseTo(fiveKEquivalentSeconds(10, 50 * 60), 5)
  })

  it('gets faster when the athlete runs faster', () => {
    const result = improvedBaseline(fiveKIn25, [{ km: 5, seconds: 24 * 60 }])
    expect(result!.seconds).toBeCloseTo(24 * 60, 5)
  })

  it('never gets slower from an easy run', () => {
    const result = improvedBaseline(fiveKIn25, [{ km: 10, seconds: 70 * 60 }, { km: 5, seconds: 30 * 60 }])
    expect(result!.seconds).toBeCloseTo(25 * 60, 5)
  })

  it('caps how far one run may pull the baseline', () => {
    // A 12:00 "5K" is a typo or a badly measured track, not a new athlete.
    const result = improvedBaseline(fiveKIn25, [{ km: 5, seconds: 12 * 60 }])
    expect(result!.seconds).toBeCloseTo(25 * 60 * (1 - MAX_IMPROVEMENT), 5)
  })

  it('lets a genuine run of improvements compound over several runs', () => {
    const efforts = [
      { km: 5, seconds: 24 * 60 },
      { km: 5, seconds: 23 * 60 },
      { km: 5, seconds: 22 * 60 },
    ]
    const result = improvedBaseline(fiveKIn25, efforts)
    expect(result!.seconds).toBeCloseTo(22 * 60, 5)
  })

  it('ignores interval reps, however fast they were', () => {
    const result = improvedBaseline(fiveKIn25, [{ km: 0.4, seconds: 75 }])
    expect(result!.seconds).toBeCloseTo(25 * 60, 5)
  })
})

describe('a baseline seeded from a short onboarding effort', () => {
  // The questionnaire accepts any positive distance, so someone can report a
  // mile. That answer must still seed the ratchet, or their first easy run
  // becomes the baseline and every pace in the plan gets slower.
  const mile = { km: 1.6, seconds: 6 * 60 + 30 }
  const seeded = fiveKEquivalentSeconds(mile.km, mile.seconds)

  it("keeps the athlete's own answer when nothing has been logged", () => {
    expect(improvedBaseline(mile, [])?.seconds).toBeCloseTo(seeded, 5)
  })

  it('is not dragged slower by an easy run', () => {
    expect(improvedBaseline(mile, [{ km: 8, seconds: 52 * 60 }])!.seconds).toBeCloseTo(seeded, 5)
  })

  it('still caps how far one run may pull it faster', () => {
    expect(improvedBaseline(mile, [{ km: 5, seconds: 10 * 60 }])!.seconds).toBeCloseTo(seeded * (1 - MAX_IMPROVEMENT), 5)
  })
})

describe('racePredictions', () => {
  it('predicts every distance the app knows, slowing as the distance grows', () => {
    const predictions = racePredictions(fiveKIn25)
    expect(predictions.map((p) => p.race)).toEqual(['5k', '10k', 'half'])
    const paces = predictions.map((p) => p.seconds / p.km)
    expect(paces[0]).toBeLessThan(paces[1]!)
    expect(paces[1]).toBeLessThan(paces[2]!)
  })

  it('returns the known effort back at its own distance', () => {
    const fiveK = racePredictions(fiveKIn25).find((p) => p.race === '5k')!
    expect(fiveK.seconds).toBeCloseTo(25 * 60, 5)
  })

  it('brackets every point estimate and widens with the extrapolation', () => {
    const predictions = racePredictions(fiveKIn25)
    for (const p of predictions) {
      expect(p.fastSeconds).toBeLessThanOrEqual(p.seconds)
      expect(p.slowSeconds).toBeGreaterThanOrEqual(p.seconds)
    }
    const spread = (p: { fastSeconds: number; slowSeconds: number; seconds: number }) => (p.slowSeconds - p.fastSeconds) / p.seconds
    expect(spread(predictions[2]!)).toBeGreaterThan(spread(predictions[0]!))
  })
})
