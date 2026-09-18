import { RACE_DISTANCES_KM, type RaceDistanceKey } from '../profile/types'
import { fiveKEquivalentSeconds, riegelPredictSeconds } from './riegel'
import type { RecentRun } from './paces'

/**
 * What the athlete is currently capable of, learned from the runs they log.
 *
 * Onboarding asks for one recent effort and every training pace comes from it.
 * Without this, that answer is frozen: someone who takes two minutes off their
 * 5K over a block keeps training at the paces they walked in with. The runs
 * they log are the evidence, but logged runs are noisy, so three rules keep a
 * bad data point from poisoning the plan.
 */

/** Below this, Riegel extrapolation to 5K is unreliable; a fast 400 is not a fitness test. */
export const MIN_EVIDENCE_KM = 3

/**
 * The most one run may improve the baseline. A mis-typed distance, a downhill
 * route or a short-measured GPS track should cost a little accuracy, not
 * rewrite every pace in the block.
 */
export const MAX_IMPROVEMENT = 0.05

/**
 * Whether a *logged* run is worth learning from. The athlete's own answer at
 * onboarding is not held to this: it is what they told us they can do, not
 * noisy evidence, and it seeds the baseline whatever distance they gave.
 */
export function isEvidence(effort: RecentRun): boolean {
  return effort.km >= MIN_EVIDENCE_KM && effort.seconds > 0
}

/**
 * Folds logged efforts into a 5K-equivalent baseline, oldest first.
 *
 * A ratchet: each qualifying run can pull the baseline faster, by at most
 * MAX_IMPROVEMENT, and nothing can push it slower. Losing fitness is real, but
 * an athlete who jogs an easy week should not be told they got worse, and the
 * weekly review already handles a block that is going badly.
 */
export function improvedBaseline(
  starting: RecentRun | undefined,
  efforts: readonly RecentRun[],
): RecentRun | undefined {
  // Seeded from the athlete's own answer at any distance. Holding it to the
  // three-kilometre rule would drop the seed for someone who reported a mile,
  // and the first easy run they logged would then become the baseline outright,
  // with no direction check and no cap: the opposite of a ratchet.
  let best = starting && starting.km > 0 && starting.seconds > 0
    ? fiveKEquivalentSeconds(starting.km, starting.seconds)
    : undefined

  for (const effort of efforts) {
    if (!isEvidence(effort)) continue
    const equivalent = fiveKEquivalentSeconds(effort.km, effort.seconds)
    if (best === undefined) {
      best = equivalent
      continue
    }
    if (equivalent >= best) continue
    best = Math.max(equivalent, best * (1 - MAX_IMPROVEMENT))
  }

  return best === undefined ? undefined : { km: 5, seconds: best }
}

export interface RacePrediction {
  race: RaceDistanceKey
  km: number
  /** Point estimate in seconds, and the band around it. */
  seconds: number
  fastSeconds: number
  slowSeconds: number
}

/**
 * What the athlete could run today, at every distance the app knows, as a
 * range rather than a promise (CLAUDE.md, rule 6). The band widens with the
 * distance because Riegel drifts the further it extrapolates: predicting a
 * half marathon from a 5K assumes an endurance base the athlete may not have.
 */
export function racePredictions(recent: RecentRun, band = 0.03): RacePrediction[] {
  return (Object.keys(RACE_DISTANCES_KM) as RaceDistanceKey[]).map((race) => {
    const km = RACE_DISTANCES_KM[race]
    const seconds = riegelPredictSeconds(recent.km, recent.seconds, km)
    // The band widens by its own width for every doubling away from the known
    // effort: ±3% at the distance itself, ±6% at twice it, ±9% at four times.
    const stretch = Math.abs(Math.log2(km / recent.km))
    const spread = band * (1 + stretch)
    return {
      race,
      km,
      seconds,
      fastSeconds: seconds * (1 - spread),
      slowSeconds: seconds * (1 + spread),
    }
  })
}
