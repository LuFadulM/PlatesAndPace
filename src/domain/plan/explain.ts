import type { AthleteModel } from '../profile/athlete'
import { goalPolicy } from '../strength/goals'
import { deloadWeeks } from '../strength/periodization'
import type { SessionKind } from '../strength/splits'
import { weeklyVolumeTargets } from '../strength/volume'
import { trainingPaces } from '../running'

/**
 * "Here is your plan, and here is why" (Phase 3 of the brief): the engine
 * explains its own decisions as message keys with parameters, never prose,
 * so both languages read the same reasoning. Every line maps to a rule in
 * CLAUDE.md; nothing here is decoration.
 */
export interface Explanation {
  key: string
  params?: Record<string, string | number>
}

export interface PlanShape {
  weeks: number
  split: readonly SessionKind[]
}

const formatPace = (secPerKm: number) => {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function explainPlan(model: AthleteModel, plan: PlanShape): Explanation[] {
  const policy = goalPolicy(model.goal)
  const lines: Explanation[] = []

  // The goal, in the terms the engine uses.
  lines.push({ key: `explain.goal.${model.goal}` })
  if (model.goalSecondary) lines.push({ key: `explain.secondary.${model.goalSecondary}` })

  // The split, and why that one.
  const kinds = [...new Set(plan.split)]
  const fullBody = kinds.every((k) => k.startsWith('full_body'))
  lines.push({
    key: model.customSplit ? 'explain.split.custom' : fullBody ? 'explain.split.fullBody' : 'explain.split.parts',
    params: { days: model.gymDays.length, sessions: kinds.length },
  })
  if (!model.customSplit && fullBody && !policy.fullBodyOnly) lines.push({ key: model.tier === 'beginner' ? 'explain.split.whyFullBodyBeginner' : 'explain.split.whyFullBodyStrength' })

  // Volume: where the ramp starts and where the light week falls.
  const first = weeklyVolumeTargets({ tier: model.tier, accumulationWeek: 1, deload: false, focusAreas: model.focusAreas, conservativeMode: model.conservativeMode, goalScale: policy.volumeScale })
  const values = Object.values(first)
  const low = Math.min(...values)
  const high = Math.max(...values)
  lines.push({ key: `explain.volume.start.${model.tier}`, params: { low, high } })
  const deloads = deloadWeeks(plan.weeks)
  lines.push({ key: 'explain.volume.ramp', params: { deload: deloads.join(', '), count: deloads.length } })
  if (model.focusAreas.length > 0) lines.push({ key: 'explain.volume.focus', params: { n: model.focusAreas.length } })

  // Intensity and the failure policy.
  lines.push({ key: `explain.intensity.${model.goal}` })
  if (model.maxRpe < 10) lines.push({ key: model.isMinor ? 'explain.intensity.minor' : 'explain.intensity.careful' })
  else if (model.tier !== 'advanced') lines.push({ key: 'explain.intensity.bigLifts' })

  // Time.
  lines.push({ key: 'explain.time', params: { minutes: model.sessionMinutes } })

  // Loads and progression.
  lines.push({ key: model.tier === 'beginner' ? 'explain.loads.calibrate' : 'explain.loads.fromMax' })
  lines.push({ key: 'explain.loads.progression' })

  // Equipment and injuries.
  if (model.equipment !== 'full_gym') lines.push({ key: `explain.equipment.${model.equipment}` })
  if (model.injuries.length > 0) lines.push({ key: 'explain.injuries', params: { n: model.injuries.length } })

  // Running.
  if (model.runDays.length > 0) {
    if (model.recentRun) {
      const paces = trainingPaces(model.recentRun, model.targetRace)
      lines.push({ key: 'explain.cardio.paces', params: { easy: formatPace(paces.easy), threshold: formatPace(paces.threshold), interval: formatPace(paces.interval), runs: model.runDays.length } })
      if (paces.goalRange && model.targetRace) lines.push({ key: 'explain.cardio.goal', params: { race: model.targetRace, fast: formatPace(paces.goalRange.fast), slow: formatPace(paces.goalRange.slow) } })
    } else {
      lines.push({ key: 'explain.cardio.runWalk', params: { runs: model.runDays.length } })
    }
    lines.push({ key: 'explain.cardio.polarised' })
    const method = model.heartRate.lthr ? 'lthr' : model.heartRate.restingHr ? 'hrr' : 'max'
    lines.push({ key: `explain.cardio.zones.${method}` })
    if (model.runsMatter) lines.push({ key: 'explain.cardio.interference' })
  } else if (policy.weeklyEasyCardioMinutes > 0) {
    lines.push({ key: 'explain.cardio.easyMinutes', params: { minutes: policy.weeklyEasyCardioMinutes } })
  }
  if (policy.dailyStepTarget) lines.push({ key: 'explain.cardio.steps', params: { steps: policy.dailyStepTarget } })

  // Food, in one line: the detail lives on Today.
  lines.push({ key: model.allowCalorieDeficit ? `explain.food.${model.goal}` : `explain.food.noDeficit.${model.deficitBlockedBy ?? 'medical'}` })

  // Safety.
  if (model.needsMedicalClearance) lines.push({ key: 'explain.safety.clearance' })
  lines.push({ key: 'explain.safety.adapts' })

  return lines
}
