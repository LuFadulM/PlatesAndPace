/**
 * Heart-rate zones by the best method the profile allows (CLAUDE.md, rule 6):
 * Friel's lactate-threshold zones when LTHR is known, Karvonen's heart-rate
 * reserve when resting HR is known, a percentage of max otherwise. Max is the
 * measured value when given, else Nes's estimate 211 − 0.64 × age, which is an
 * estimate and is labelled as one in the UI.
 */
export interface HeartRateZone {
  zone: 1 | 2 | 3 | 4 | 5
  minBpm: number
  maxBpm: number
}

export type ZoneMethod = 'lthr' | 'hrr' | 'max'

export interface HeartRateProfile {
  restingHr?: number
  maxHr?: number
  /** Lactate threshold heart rate, from a 30-minute time trial. */
  lthr?: number
}

export interface HeartRateZones {
  method: ZoneMethod
  maxHr: number
  /** True when max came from the age estimate rather than a measurement. */
  maxEstimated: boolean
  zones: HeartRateZone[]
}

const ZONE_IDS = [1, 2, 3, 4, 5] as const

/** Percent of max heart rate. */
const MAX_BOUNDS = [
  [0.5, 0.68],
  [0.68, 0.78],
  [0.78, 0.87],
  [0.87, 0.93],
  [0.93, 1.0],
] as const

/** Percent of heart-rate reserve (Karvonen). */
const HRR_BOUNDS = [
  [0.5, 0.6],
  [0.6, 0.7],
  [0.7, 0.8],
  [0.8, 0.9],
  [0.9, 1.0],
] as const

/** Percent of lactate-threshold heart rate (Friel), zones 5a–5c collapsed. */
const LTHR_BOUNDS = [
  [0.68, 0.85],
  [0.85, 0.9],
  [0.9, 0.95],
  [0.95, 1.0],
  [1.0, 1.08],
] as const

export function estimatedMaxHeartRate(ageYears: number): number {
  if (ageYears <= 0) throw new RangeError('age must be positive')
  return 211 - 0.64 * ageYears
}

export function heartRateZones(ageYears: number, profile: HeartRateProfile = {}): HeartRateZones {
  const maxEstimated = profile.maxHr === undefined
  const maxHr = profile.maxHr ?? estimatedMaxHeartRate(ageYears)

  if (profile.lthr !== undefined && profile.lthr > 0) {
    return {
      method: 'lthr',
      maxHr,
      maxEstimated,
      zones: ZONE_IDS.map((zone, i) => ({ zone, minBpm: Math.round(profile.lthr! * LTHR_BOUNDS[i]![0]), maxBpm: Math.round(Math.min(maxHr, profile.lthr! * LTHR_BOUNDS[i]![1])) })),
    }
  }

  if (profile.restingHr !== undefined && profile.restingHr > 0 && profile.restingHr < maxHr) {
    const reserve = maxHr - profile.restingHr
    const at = (fraction: number) => Math.round(profile.restingHr! + reserve * fraction)
    return {
      method: 'hrr',
      maxHr,
      maxEstimated,
      zones: ZONE_IDS.map((zone, i) => ({ zone, minBpm: at(HRR_BOUNDS[i]![0]), maxBpm: at(HRR_BOUNDS[i]![1]) })),
    }
  }

  return {
    method: 'max',
    maxHr,
    maxEstimated,
    zones: ZONE_IDS.map((zone, i) => ({ zone, minBpm: Math.round(maxHr * MAX_BOUNDS[i]![0]), maxBpm: Math.round(maxHr * MAX_BOUNDS[i]![1]) })),
  }
}
