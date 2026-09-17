/**
 * Heart-rate zones from the Tanaka estimate, HRmax = 208 − 0.7 × age
 * (PLAN.md §6.7). Preferred over the older 220 − age, which understates max
 * heart rate for older athletes and overstates it for younger ones.
 */
export interface HeartRateZone {
  zone: 1 | 2 | 3 | 4 | 5
  minBpm: number
  maxBpm: number
}

const ZONE_BOUNDS: ReadonlyArray<{ zone: HeartRateZone['zone']; from: number; to: number }> = [
  { zone: 1, from: 0.5, to: 0.68 },
  { zone: 2, from: 0.68, to: 0.78 },
  { zone: 3, from: 0.78, to: 0.87 },
  { zone: 4, from: 0.87, to: 0.93 },
  { zone: 5, from: 0.93, to: 1.0 },
]

export function estimatedMaxHeartRate(ageYears: number): number {
  if (ageYears <= 0) throw new RangeError('age must be positive')
  return 208 - 0.7 * ageYears
}

export function heartRateZones(ageYears: number): HeartRateZone[] {
  const max = estimatedMaxHeartRate(ageYears)
  return ZONE_BOUNDS.map(({ zone, from, to }) => ({
    zone,
    minBpm: Math.round(max * from),
    maxBpm: Math.round(max * to),
  }))
}
