import {
  addDays,
  startOfPlanWeek,
  toISODate,
  weekday,
  weekIndex,
  type PlainDate,
} from '../dates'
import type { AthleteModel, MovementPattern } from '../profile/athlete'
import {
  heartRateZones,
  longRunProgression,
  runWalkProgression,
  trainingPaces,
  type RunWalkWeek,
  type TrainingPaces,
} from '../running'
import { loadForTarget, roundToIncrement, startingLoadKg } from '../strength/loads'
import { phaseParameters, type Phase } from '../strength/periodization'
import { createRng, planSeed } from '../strength/rng'
import { selectExercise, type SelectionContext } from '../strength/selection'
import {
  interferenceLimits,
  isLowerBodySession,
  selectSplit,
  type RunKind,
  type SessionKind,
} from '../strength/splits'
import { sessionTemplate, type SlotRole } from '../strength/templates'
import type { MuscleGroup } from '../strength/volume'

/**
 * Turns an athlete model into a concrete session for every calendar day of a
 * block (PLAN.md §3, §6). Pure and deterministic: the same model, block number
 * and seed always produce the same plan.
 */

export type Technique = 'straight' | 'top_set_backoff' | 'drop_set' | 'rest_pause'

export interface PlannedExercise {
  /** A, B, C1, C2 … as shown in the Today list. */
  label: string
  exerciseId: string
  role: SlotRole
  sets: number
  repMin: number
  repMax: number
  rpeTarget: number
  /** Working load in kilograms; 0 for bodyweight. */
  loadKg: number
  restSec: number
  supersetGroup?: string
  technique: Technique
}

export interface GymSession {
  kind: SessionKind
  /** The muscle groups a custom session was built from, in priority order. */
  focus?: MuscleGroup[]
  titleKey: string
  intentKey: string
  warmupKey: string
  exercises: PlannedExercise[]
  finisher?: PlannedExercise
  estimatedMinutes: number
}

export interface IntervalSet {
  reps: number
  workMeters: number
  restSec: number
  paceSecPerKm: number
}

export interface RunSession {
  kind: RunKind
  titleKey: string
  intentKey: string
  minutes: number
  km: number
  paceSecPerKm: number | null
  hrZone: number
  intervals?: IntervalSet
  runWalk?: RunWalkWeek
}

export type DayType = 'gym' | 'run' | 'gym_run' | 'rest'

export interface PlannedDay {
  date: string
  week: number
  phase: Phase
  type: DayType
  gym?: GymSession
  run?: RunSession
}

export interface GeneratedPlan {
  block: number
  startDate: string
  weeks: number
  days: PlannedDay[]
  paces: TrainingPaces | null
  /** Snapshot for `plans.settings`. */
  settings: {
    split: SessionKind[]
    /** Muscle groups per ISO weekday when the athlete chose the split. */
    customSplit?: Record<string, MuscleGroup[]>
    goal: AthleteModel['goal']
    tier: AthleteModel['tier']
    conservativeMode: boolean
    seed: string
  }
}

export interface GenerateOptions {
  block: number
  /** Overrides the derived seed; tests use it to prove determinism. */
  seed?: string
  /** Latest estimated 1RM per exercise id from logged sessions. */
  previousMaxes?: Readonly<Record<string, number>>
  /** Exercise ids used in the previous week, for variety. */
  recentlyUsed?: ReadonlySet<string>
  /** Permanent swaps from exercise_preferences. */
  swaps?: ReadonlyMap<string, string>
  /** Multipliers from the weekly review to apply to week one. */
  reviewVolumeMultiplier?: number
  reviewLoadMultiplier?: number
}

const LABELS = 'ABCDEFGHIJ'

/** Assigns run kinds to the athlete's run days (PLAN.md §1 worked example). */
export function assignRunKinds(model: AthleteModel): Map<number, RunKind> {
  const kinds = new Map<number, RunKind>()
  if (model.runDays.length === 0) return kinds

  // Someone who cannot yet run continuously does run/walk on every run day.
  if (!model.recentRun) {
    for (const day of model.runDays) kinds.set(day, 'run_walk')
    return kinds
  }

  const longDay = model.longRunDay ?? model.runDays[model.runDays.length - 1]!
  kinds.set(longDay, 'long')

  const others = model.runDays.filter((d) => d !== longDay)
  if (others.length === 0) return kinds

  // Order the remaining run days by how far after the long run they fall. The
  // first is the recovery run — legs are still heavy from the weekend — and the
  // last, closest to the next long run, is the hard one. With Tue/Thu/Sat that
  // is Tuesday easy, Thursday intervals, Saturday long.
  const daysAfterLong = (d: number) => (d - longDay + 7) % 7
  const ordered = [...others].sort((a, b) => daysAfterLong(a) - daysAfterLong(b))
  const hardDay = ordered.at(-1)!
  kinds.set(hardDay, 'interval')
  for (const d of ordered) if (d !== hardDay) kinds.set(d, 'easy')

  return kinds
}

/** Labels in place: A, B, C1/C2 for a superset pair, D … */
export function labelExercises(exercises: PlannedExercise[]): void {
  let index = 0
  let lastGroup: string | undefined
  let groupCount = 0
  for (const exercise of exercises) {
    if (exercise.supersetGroup) {
      if (exercise.supersetGroup !== lastGroup) {
        lastGroup = exercise.supersetGroup
        groupCount = 0
        index += 1
      }
      groupCount += 1
      exercise.label = `${LABELS[index - 1]}${groupCount}`
    } else {
      index += 1
      lastGroup = undefined
      exercise.label = LABELS[index - 1] ?? `${index}`
    }
  }
}

/** Eight minutes to warm up, forty seconds a set plus its rest, six for a finisher. */
export function estimateSessionMinutes(exercises: readonly PlannedExercise[], hasFinisher: boolean): number {
  const workSeconds = exercises.reduce((sum, e) => sum + e.sets * (40 + e.restSec), 0)
  return Math.round(8 + workSeconds / 60 + (hasFinisher ? 6 : 0))
}

function repTarget(slot: { repMin: number; repMax: number }): number {
  return Math.round((slot.repMin + slot.repMax) / 2)
}

function buildGymSession(
  kind: SessionKind,
  week: number,
  model: AthleteModel,
  ctx: SelectionContext,
  options: GenerateOptions,
  todaysRun: RunKind,
  tomorrowsRun: RunKind,
  continuity: Map<string, string>,
  focus?: readonly MuscleGroup[],
): GymSession {
  const phase = phaseParameters(week, model.blockWeeks)
  const limits = interferenceLimits(model.goal, todaysRun, tomorrowsRun)
  const template = sessionTemplate(kind, model.goal, model.tier, model.sessionMinutes, focus)
  const lowerBody = isLowerBodySession(kind, focus)
  // Custom sessions keep continuity per muscle combination, so the same
  // "glutes + hamstrings" day sees the same primary lift week after week.
  const continuityPrefix = kind === 'custom' ? `custom:${(focus ?? []).join('+')}` : kind

  const extraBanned = new Set<MovementPattern>(ctx.extraBannedPatterns ?? [])
  if (!limits.allowHeavyHinge) {
    extraBanned.add('spinal_loading')
    extraBanned.add('loaded_hip_hinge')
  }
  const dayCtx: SelectionContext = { ...ctx, extraBannedPatterns: extraBanned }

  const chosen = new Set<string>()
  const exercises: PlannedExercise[] = []
  let finisher: PlannedExercise | undefined
  let lowerSets = 0
  const volumeScale = phase.volumeMultiplier * (week === 1 ? (options.reviewVolumeMultiplier ?? 1) : 1)

  template.forEach((slot, slotIndex) => {
    const continuityKey = `${continuityPrefix}:${slotIndex}`
    const exercise = selectExercise(slot, { ...dayCtx, preferred: continuity.get(continuityKey) }, chosen)
    if (!exercise) return
    chosen.add(exercise.id)
    continuity.set(continuityKey, exercise.id)

    let sets = Math.max(1, Math.round(slot.sets * volumeScale))
    const isLower = exercise.region === 'lower'
    if (isLower && lowerBody) {
      const room = limits.maxLowerBodySets - lowerSets
      if (room <= 0) return
      sets = Math.min(sets, room)
      lowerSets += sets
    }

    let rpeTarget = Math.min(phase.rpeTarget, model.maxRpe)
    if (isLower) rpeTarget = Math.min(rpeTarget, limits.maxLowerBodyRpe)
    if (slot.role === 'finisher') rpeTarget = Math.min(rpeTarget, 8)

    const reps = repTarget(slot)
    const previous = options.previousMaxes?.[exercise.id]
    let loadKg = 0
    if (exercise.implement !== 'bodyweight' && exercise.category !== 'conditioning') {
      const base = previous
        ? loadForTarget(previous, reps, rpeTarget)
        : startingLoadKg({
            bodyweightKg: model.weightKg,
            strengthRatio: exercise.strengthRatio,
            region: exercise.region,
            implement: exercise.implement,
            sex: model.sex,
            experience: model.experience,
            units: model.units,
            conservativeMode: model.conservativeMode,
          })
      const scaled = base * phase.loadMultiplier * (week === 1 ? (options.reviewLoadMultiplier ?? 1) : 1)
      loadKg = roundToIncrement(scaled, exercise.implement, model.units)
    }

    let technique: Technique = 'straight'
    if (slot.role === 'primary' && phase.topSet) technique = 'top_set_backoff'
    if (phase.intensityTechnique && slot.role === 'isolation' && !finisher) technique = 'drop_set'

    const planned: PlannedExercise = {
      label: '',
      exerciseId: exercise.id,
      role: slot.role,
      sets,
      repMin: slot.repMin,
      repMax: slot.repMax,
      rpeTarget,
      loadKg,
      restSec: slot.restSec,
      supersetGroup: slot.supersetGroup,
      technique,
    }

    if (slot.role === 'finisher') {
      finisher = { ...planned, label: 'F', sets: 1, repMin: 8, repMax: 12 }
    } else {
      exercises.push(planned)
    }
  })

  labelExercises(exercises)
  const estimatedMinutes = estimateSessionMinutes(exercises, finisher !== undefined)

  return {
    kind,
    focus: kind === 'custom' ? [...(focus ?? [])] : undefined,
    titleKey: `sessions.${kind}.title`,
    intentKey: phase.messageKey,
    warmupKey: lowerBody ? 'warmup.lower' : 'warmup.upper',
    exercises,
    finisher,
    estimatedMinutes,
  }
}

function buildRunSession(
  kind: RunKind,
  week: number,
  model: AthleteModel,
  paces: TrainingPaces | null,
  longRunKm: number[],
  runWalk: RunWalkWeek[],
): RunSession | undefined {
  if (kind === 'none') return undefined
  const phase = phaseParameters(week, model.blockWeeks)
  const deload = phase.phase === 'deload' ? 0.7 : 1
  const zones = heartRateZones(model.ageYears)
  const zoneFor = (z: number) => zones[z - 1]!.zone

  if (kind === 'run_walk') {
    const ladder = runWalk[Math.min(week - 1, runWalk.length - 1)]!
    return {
      kind,
      titleKey: 'runs.run_walk.title',
      intentKey: 'runs.run_walk.intent',
      minutes: ladder.totalMinutes,
      km: 0,
      paceSecPerKm: null,
      hrZone: zoneFor(2),
      runWalk: ladder,
    }
  }

  if (!paces) return undefined
  const easyMinutes = (model.tier === 'beginner' ? 30 : model.tier === 'intermediate' ? 35 : 40) * deload

  switch (kind) {
    case 'easy': {
      const km = (easyMinutes * 60) / paces.easy
      return { kind, titleKey: 'runs.easy.title', intentKey: 'runs.easy.intent', minutes: Math.round(easyMinutes), km: Math.round(km * 10) / 10, paceSecPerKm: paces.easy, hrZone: zoneFor(2) }
    }
    case 'long': {
      const km = longRunKm[Math.min(week - 1, longRunKm.length - 1)]!
      return { kind, titleKey: 'runs.long.title', intentKey: 'runs.long.intent', minutes: Math.round((km * paces.long) / 60), km, paceSecPerKm: paces.long, hrZone: zoneFor(2) }
    }
    case 'threshold': {
      const minutes = Math.round(16 * deload)
      return { kind, titleKey: 'runs.threshold.title', intentKey: 'runs.threshold.intent', minutes: minutes + 20, km: Math.round(((minutes * 60) / paces.threshold + (20 * 60) / paces.easy) * 10) / 10, paceSecPerKm: paces.threshold, hrZone: zoneFor(4) }
    }
    case 'interval': {
      const reps = Math.max(3, Math.min(8, 3 + week) - (phase.phase === 'deload' ? 2 : 0))
      const intervals: IntervalSet = { reps, workMeters: 400, restSec: 90, paceSecPerKm: paces.interval }
      const workKm = (reps * 400) / 1000
      const minutes = Math.round(15 + (workKm * paces.interval) / 60 + (reps * 90) / 60)
      return { kind, titleKey: 'runs.interval.title', intentKey: 'runs.interval.intent', minutes, km: Math.round((workKm + 3) * 10) / 10, paceSecPerKm: paces.interval, hrZone: zoneFor(5), intervals }
    }
  }
}

export function generatePlan(model: AthleteModel, options: GenerateOptions): GeneratedPlan {
  const seed = options.seed ?? planSeed(model.displayName, options.block)
  const rng = createRng(seed)
  const split: SessionKind[] = model.customSplit
    ? model.gymDays.map(() => 'custom' as const)
    : selectSplit(model.gymDays.length, model.tier, model.goal)
  const runKinds = assignRunKinds(model)

  const paces = model.recentRun ? trainingPaces(model.recentRun, model.targetRace) : null
  const longStart = model.recentRun ? Math.max(4, Math.round(model.recentRun.km * 1.4 * 2) / 2) : 4
  const longMax = model.targetRace === 'half' ? 20 : model.targetRace === '10k' ? 12 : 8
  const longRunKm = longRunProgression(longStart, model.blockWeeks, { maxKm: longMax }).map((w) => w.km)
  const runWalk = runWalkProgression(model.continuousRunMinutes ?? 0, model.blockWeeks)

  const ctx: SelectionContext = {
    model,
    rng,
    recentlyUsed: options.recentlyUsed ?? new Set(),
    swaps: options.swaps ?? new Map(),
  }

  const start = startOfPlanWeek(model.startDate)
  const days: PlannedDay[] = []
  const usedThisWeek = new Set<string>()
  // Slot → exercise chosen last time this session kind ran, so the lifts that
  // carry progression recur week to week (see SelectionContext.preferred).
  const continuity = new Map<string, string>()

  for (let offset = 0; offset < model.blockWeeks * 7; offset += 1) {
    const date: PlainDate = addDays(start, offset)
    const dow = weekday(date)
    const week = weekIndex(date, start)
    const phase = phaseParameters(week, model.blockWeeks).phase

    if (dow === 1) usedThisWeek.clear()

    const gymIndex = model.gymDays.indexOf(dow)
    const todaysRun: RunKind = runKinds.get(dow) ?? 'none'
    const tomorrowsRun: RunKind = runKinds.get(dow === 7 ? 1 : dow + 1) ?? 'none'

    let gym: GymSession | undefined
    if (gymIndex >= 0) {
      const dayCtx: SelectionContext = { ...ctx, recentlyUsed: new Set([...ctx.recentlyUsed, ...usedThisWeek]) }
      gym = buildGymSession(split[gymIndex]!, week, model, dayCtx, options, todaysRun, tomorrowsRun, continuity, model.customSplit?.get(dow))
      for (const e of gym.exercises) usedThisWeek.add(e.exerciseId)
    }

    const run = buildRunSession(todaysRun, week, model, paces, longRunKm, runWalk)

    const type: DayType = gym && run ? 'gym_run' : gym ? 'gym' : run ? 'run' : 'rest'
    days.push({ date: toISODate(date), week, phase, type, gym, run })
  }

  return {
    block: options.block,
    startDate: toISODate(start),
    weeks: model.blockWeeks,
    days,
    paces,
    settings: {
      split,
      customSplit: model.customSplit
        ? Object.fromEntries([...model.customSplit].map(([day, muscles]) => [String(day), [...muscles]]))
        : undefined,
      goal: model.goal,
      tier: model.tier,
      conservativeMode: model.conservativeMode,
      seed,
    },
  }
}

export interface RegenerateOptions {
  /** The muscle groups the athlete wants today, in priority order. */
  focus: readonly MuscleGroup[]
  week: number
  todaysRun: RunKind
  tomorrowsRun: RunKind
  /** Seeded per day so two taps on the same choice give the same session. */
  seed: string
  previousMaxes?: Readonly<Record<string, number>>
  recentlyUsed?: ReadonlySet<string>
  swaps?: ReadonlyMap<string, string>
}

/**
 * One gym session built from muscle groups chosen on the day, outside the
 * block's split. Everything else — loads, RPE, phase, interference with the
 * runs around it, injuries, equipment — comes from the same rules as the
 * planned sessions, so a day the athlete rearranges is as safe as one the
 * engine planned.
 */
export function regenerateGymSession(model: AthleteModel, options: RegenerateOptions): GymSession {
  const ctx: SelectionContext = {
    model,
    rng: createRng(options.seed),
    recentlyUsed: options.recentlyUsed ?? new Set(),
    swaps: options.swaps ?? new Map(),
  }
  return buildGymSession(
    'custom',
    options.week,
    model,
    ctx,
    { block: 0, previousMaxes: options.previousMaxes },
    options.todaysRun,
    options.tomorrowsRun,
    new Map(),
    options.focus,
  )
}
