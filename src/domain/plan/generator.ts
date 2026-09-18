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
  easyMinutesToAdd,
  heartRateZones,
  intensityDistribution,
  longRunProgression,
  runWalkProgression,
  trainingPaces,
  type RunMinutes,
  type RunWalkWeek,
  type TrainingPaces,
  type ZoneMethod,
} from '../running'
import { getExercise } from '../exercises/library'
import { loadForTarget, roundLoad, startingLoadKg } from '../strength/loads'
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
import { goalPolicy } from '../strength/goals'
import { DELOAD_EVERY, phaseParameters as phaseOf } from '../strength/periodization'
import { sessionTemplate, type Slot, type SlotRole } from '../strength/templates'
import {
  MAX_SESSION_SETS_PER_MUSCLE,
  MAX_SETS_PER_SLOT,
  MUSCLE_GROUPS,
  VOLUME_LANDMARKS,
  SECONDARY_SET_CREDIT,
  weeklyVolumeTargets,
  type MuscleGroup,
} from '../strength/volume'

/**
 * Turns an athlete model into a concrete session for every calendar day of a
 * block (PLAN.md §3, §6). Pure and deterministic: the same model, block number
 * and seed always produce the same plan.
 */

export type Technique = 'straight' | 'top_set_backoff' | 'drop_set' | 'rest_pause' | 'tempo'

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
  /** For timed work (holds, stretches): seconds per set; reps then read as seconds. */
  holdSeconds?: number
}

/** Something the engine changed about a session, and why. Never silent. */
export interface SessionAdjustment {
  reason: 'time' | 'interference' | 'volume_cap' | 'review'
  exerciseId: string
  setsRemoved: number
  /** True when the exercise was dropped altogether. */
  removed: boolean
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
  /** What was trimmed to fit the time budget or the running around it, and why. */
  adjustments?: SessionAdjustment[]
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
  /** Beats per minute for the zone, and how it was derived. */
  hrRange?: { minBpm: number; maxBpm: number; method: ZoneMethod; maxEstimated: boolean }
  /** Minutes of the session at a hard pace, for the 80/20 accounting. */
  hardMinutes: number
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
  /** Set when a hard run and a leg session share the day: lift first, run after. */
  order?: 'lift_first'
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
  const workSeconds = exercises.reduce((sum, e) => {
    const def = getExercise(e.exerciseId)
    const perSet = (e.holdSeconds ?? 40) * (def.unilateral ? 2 : 1)
    return sum + e.sets * (perSet + e.restSec)
  }, 0)
  return Math.round(8 + workSeconds / 60 + (hasFinisher ? 6 : 0))
}

/**
 * The week's volume ledger (CLAUDE.md, rule 2). Targets come from the
 * landmarks; every session consumes its share, credits the muscles it worked
 * (a compound counts fully for its primary and half for each secondary), and
 * later slots for the same muscle see what is left.
 */
export interface WeekVolume {
  targets: Record<MuscleGroup, number>
  done: Record<MuscleGroup, number>
  /** Sum of the weights of this week's slots for each muscle not yet planned. */
  remainingWeight: Record<MuscleGroup, number>
}

/** How much of a muscle's weekly budget a slot deserves relative to the others. */
const SLOT_WEIGHT: Record<SlotRole, number> = { power: 0, primary: 1.5, secondary: 1.2, accessory: 1, isolation: 1, core: 1, mobility: 0, finisher: 0 }

const zeroByMuscle = (): Record<MuscleGroup, number> => Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, 0])) as Record<MuscleGroup, number>

export function newWeekVolume(model: AthleteModel, week: number, templates: readonly Slot[][]): WeekVolume {
  const phase = phaseOf(week, model.blockWeeks)
  const targets = weeklyVolumeTargets({
    tier: model.tier,
    accumulationWeek: ((week - 1) % DELOAD_EVERY) + 1,
    deload: phase.phase === 'deload',
    focusAreas: model.focusAreas,
    conservativeMode: model.conservativeMode,
    goalScale: goalPolicy(model.goal).volumeScale,
  })
  const remainingWeight = zeroByMuscle()
  for (const template of templates) for (const slot of template) remainingWeight[slot.muscle] += SLOT_WEIGHT[slot.role]
  return { targets, done: zeroByMuscle(), remainingWeight }
}

/** The athlete's structural week: one template per gym day, in weekday order. */
export function weekTemplates(model: AthleteModel, split: readonly SessionKind[]): Map<number, Slot[]> {
  const templates = new Map<number, Slot[]>()
  model.gymDays.forEach((dow, i) => {
    const focus = model.customSplit?.get(dow)
    templates.set(dow, sessionTemplate(split[i]!, model.goal, model.tier, model.sessionMinutes, focus))
  })
  return templates
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
  volume: WeekVolume,
  focus?: readonly MuscleGroup[],
): GymSession {
  const phase = phaseParameters(week, model.blockWeeks)
  const policy = goalPolicy(model.goal)
  const limits = interferenceLimits(model.runsMatter, todaysRun, tomorrowsRun)
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
  const adjustments: SessionAdjustment[] = []
  let finisher: PlannedExercise | undefined
  let lowerSets = 0
  const sessionDirect = zeroByMuscle()

  template.forEach((slot, slotIndex) => {
    const continuityKey = `${continuityPrefix}:${slotIndex}`
    const isVolumeSlot = slot.role !== 'power' && slot.role !== 'mobility' && slot.role !== 'finisher'

    // This slot's share of the muscle's weekly budget, decided before the
    // exercise is chosen: a slot that finds nothing still spends its weight,
    // so the rest of the week does not overreach to compensate.
    let share = 0
    if (isVolumeSlot) {
      const m = slot.muscle
      const w = SLOT_WEIGHT[slot.role]
      const remaining = Math.max(0, volume.targets[m] - volume.done[m])
      share = volume.remainingWeight[m] > 0 ? (remaining * w) / volume.remainingWeight[m] : 0
      volume.remainingWeight[m] = Math.max(0, volume.remainingWeight[m] - w)
      // The lifts that carry progression are practised even when the week's
      // budget is already met; accessories and isolation give way.
      const floor = slot.role === 'primary' || slot.role === 'secondary' ? 2 : 0
      if (Math.round(share) < 1 && floor === 0) return
      share = Math.max(floor, share)
    }

    const exercise = selectExercise(slot, { ...dayCtx, preferred: continuity.get(continuityKey) }, chosen)
    if (!exercise) return
    chosen.add(exercise.id)
    continuity.set(continuityKey, exercise.id)

    const timed = exercise.timed === true
    // Mobility and power ride outside the volume ramp: a hold is a hold.
    // A strength primary may run to six sets of a heavy triple; everything
    // else is better served by a second movement past five.
    const slotCap = model.goal === 'strength' && slot.role === 'primary' ? MAX_SETS_PER_SLOT + 1 : MAX_SETS_PER_SLOT
    let sets = isVolumeSlot ? Math.min(slotCap, Math.max(1, Math.round(share))) : slot.sets
    if (isVolumeSlot) {
      const room = MAX_SESSION_SETS_PER_MUSCLE - sessionDirect[exercise.primary]
      if (room <= 0) return
      if (sets > room) {
        adjustments.push({ reason: 'volume_cap', exerciseId: exercise.id, setsRemoved: sets - room, removed: false })
        sets = room
      }
    }
    const isLower = exercise.region === 'lower'
    if (isLower && lowerBody && slot.role !== 'mobility') {
      const room = limits.maxLowerBodySets - lowerSets
      if (room <= 0) {
        adjustments.push({ reason: 'interference', exerciseId: exercise.id, setsRemoved: sets, removed: true })
        return
      }
      if (sets > room) adjustments.push({ reason: 'interference', exerciseId: exercise.id, setsRemoved: sets - room, removed: false })
      sets = Math.min(sets, room)
      lowerSets += sets
    }
    if (isVolumeSlot) {
      sessionDirect[exercise.primary] += sets
      volume.done[exercise.primary] += sets
      for (const m of exercise.secondary) volume.done[m] += SECONDARY_SET_CREDIT * sets
    }

    // The phase sets the target; the goal, the athlete and the movement cap it.
    // Compounds never reach failure, a big barbell lift stays two reps shy for
    // anyone not yet advanced, and power work is never a grind.
    let rpeTarget = Math.min(phase.rpeTarget, model.maxRpe)
    if (slot.role === 'power') rpeTarget = Math.min(rpeTarget, policy.maxRpe.power)
    else if (slot.role === 'isolation' || slot.role === 'core') {
      rpeTarget = Math.min(rpeTarget, policy.isolationToFailure && phase.intensityTechnique ? policy.maxRpe.isolation : Math.min(policy.maxRpe.isolation, 9))
    } else rpeTarget = Math.min(rpeTarget, policy.maxRpe.compound)
    if (exercise.bigLift && model.tier !== 'advanced') rpeTarget = Math.min(rpeTarget, 8)
    if (isLower) rpeTarget = Math.min(rpeTarget, limits.maxLowerBodyRpe)
    if (slot.role === 'finisher') rpeTarget = Math.min(rpeTarget, 8)
    if (slot.role === 'mobility') rpeTarget = 5

    let repMin = slot.repMin
    let repMax = slot.repMax
    if (slot.role === 'primary' && phase.intensityTechnique && policy.primaryRepShiftOnIntensify !== 0) {
      repMin = Math.max(1, repMin + policy.primaryRepShiftOnIntensify)
      repMax = Math.max(repMin + 1, repMax + policy.primaryRepShiftOnIntensify)
    }
    const reps = repTarget({ repMin, repMax })

    const previous = options.previousMaxes?.[exercise.id]
    let loadKg = 0
    if (exercise.implement !== 'bodyweight' && exercise.category !== 'conditioning' && !timed) {
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
      // Power work moves 30–60% of what the lift could carry, as fast as possible.
      const powerScale = exercise.category === 'power' ? 0.5 : 1
      const scaled = base * powerScale * phase.loadMultiplier
      loadKg = roundLoad(scaled, exercise.implement, model.units, model.plates)
    }

    let technique: Technique = 'straight'
    if (slot.role === 'primary' && phase.topSet && policy.tempoWeeks === 0) technique = 'top_set_backoff'
    if (phase.intensityTechnique && slot.role === 'isolation' && !finisher && policy.isolationToFailure) technique = 'drop_set'
    if (week <= policy.tempoWeeks && (slot.role === 'primary' || slot.role === 'secondary')) technique = 'tempo'

    const planned: PlannedExercise = {
      label: '',
      exerciseId: exercise.id,
      role: slot.role,
      sets,
      repMin,
      repMax,
      rpeTarget,
      loadKg,
      restSec: slot.restSec,
      supersetGroup: slot.supersetGroup,
      technique,
      ...(timed ? { holdSeconds: reps } : {}),
    }

    if (slot.role === 'finisher') {
      finisher = { ...planned, label: 'F', sets: 1, repMin: 8, repMax: 12 }
    } else {
      exercises.push(planned)
    }
  })

  trimToBudget(exercises, finisher !== undefined, model.sessionMinutes, adjustments)
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
    ...(adjustments.length > 0 ? { adjustments: mergeAdjustments(adjustments) } : {}),
  }
}

const TRIMMABLE: ReadonlySet<SlotRole> = new Set(['isolation', 'core', 'accessory'])

/**
 * Cuts from the bottom of the session order until it fits the athlete's time,
 * one set at a time, and only then drops an exercise. Every cut is recorded
 * (CLAUDE.md, rule 5): the athlete is told what went and why.
 */
function trimToBudget(exercises: PlannedExercise[], hasFinisher: boolean, budgetMinutes: number, adjustments: SessionAdjustment[]): void {
  let guard = 0
  while (estimateSessionMinutes(exercises, hasFinisher) > budgetMinutes && guard < 60) {
    guard += 1
    let index = -1
    for (let i = exercises.length - 1; i >= 0; i -= 1) {
      const e = exercises[i]!
      if (TRIMMABLE.has(e.role) && e.sets > 1) {
        index = i
        break
      }
    }
    if (index >= 0) {
      exercises[index]!.sets -= 1
      adjustments.push({ reason: 'time', exerciseId: exercises[index]!.exerciseId, setsRemoved: 1, removed: false })
      continue
    }
    let drop = -1
    for (let i = exercises.length - 1; i >= 0; i -= 1) {
      if (TRIMMABLE.has(exercises[i]!.role)) {
        drop = i
        break
      }
    }
    if (drop >= 0) {
      const [gone] = exercises.splice(drop, 1)
      adjustments.push({ reason: 'time', exerciseId: gone!.exerciseId, setsRemoved: gone!.sets, removed: true })
      continue
    }
    // Only the main lifts are left: they give up sets down to three, never fewer.
    let heavy = -1
    for (let i = exercises.length - 1; i >= 0; i -= 1) {
      const e = exercises[i]!
      if ((e.role === 'primary' || e.role === 'secondary') && e.sets > 3) {
        heavy = i
        break
      }
    }
    if (heavy < 0) return
    exercises[heavy]!.sets -= 1
    adjustments.push({ reason: 'time', exerciseId: exercises[heavy]!.exerciseId, setsRemoved: 1, removed: false })
  }
}

/** One line per exercise and reason, so the UI can say "−2 sets, leg curl". */
function mergeAdjustments(list: readonly SessionAdjustment[]): SessionAdjustment[] {
  const merged = new Map<string, SessionAdjustment>()
  for (const a of list) {
    const key = `${a.reason}:${a.exerciseId}`
    const current = merged.get(key)
    if (current) {
      current.setsRemoved += a.setsRemoved
      current.removed = current.removed || a.removed
    } else merged.set(key, { ...a })
  }
  return [...merged.values()]
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
  const hr = heartRateZones(model.ageYears, model.heartRate)
  const zoneFor = (z: number) => {
    const zone = hr.zones[z - 1]!
    return { hrZone: zone.zone, hrRange: { minBpm: zone.minBpm, maxBpm: zone.maxBpm, method: hr.method, maxEstimated: hr.maxEstimated } }
  }

  if (kind === 'run_walk') {
    const ladder = runWalk[Math.min(week - 1, runWalk.length - 1)]!
    return {
      kind,
      titleKey: 'runs.run_walk.title',
      intentKey: 'runs.run_walk.intent',
      minutes: ladder.totalMinutes,
      km: 0,
      paceSecPerKm: null,
      ...zoneFor(2),
      hardMinutes: 0,
      runWalk: ladder,
    }
  }

  if (!paces) return undefined
  const easyMinutes = (model.tier === 'beginner' ? 30 : model.tier === 'intermediate' ? 35 : 40) * deload

  switch (kind) {
    case 'easy': {
      const km = (easyMinutes * 60) / paces.easy
      return { kind, titleKey: 'runs.easy.title', intentKey: 'runs.easy.intent', minutes: Math.round(easyMinutes), km: Math.round(km * 10) / 10, paceSecPerKm: paces.easy, ...zoneFor(2), hardMinutes: 0 }
    }
    case 'long': {
      const km = longRunKm[Math.min(week - 1, longRunKm.length - 1)]!
      return { kind, titleKey: 'runs.long.title', intentKey: 'runs.long.intent', minutes: Math.round((km * paces.long) / 60), km, paceSecPerKm: paces.long, ...zoneFor(2), hardMinutes: 0 }
    }
    case 'threshold': {
      const minutes = Math.round(16 * deload)
      return { kind, titleKey: 'runs.threshold.title', intentKey: 'runs.threshold.intent', minutes: minutes + 20, km: Math.round(((minutes * 60) / paces.threshold + (20 * 60) / paces.easy) * 10) / 10, paceSecPerKm: paces.threshold, ...zoneFor(4), hardMinutes: minutes }
    }
    case 'interval': {
      const reps = Math.max(3, Math.min(8, 3 + week) - (phase.phase === 'deload' ? 2 : 0))
      const intervals: IntervalSet = { reps, workMeters: 400, restSec: 90, paceSecPerKm: paces.interval }
      const workKm = (reps * 400) / 1000
      const hardMinutes = (workKm * paces.interval) / 60
      const minutes = Math.round(15 + hardMinutes + (reps * 90) / 60)
      return { kind, titleKey: 'runs.interval.title', intentKey: 'runs.interval.intent', minutes, km: Math.round((workKm + 3) * 10) / 10, paceSecPerKm: paces.interval, ...zoneFor(5), hardMinutes: Math.round(hardMinutes), intervals }
    }
  }
}

/**
 * Keeps each week polarised (CLAUDE.md, rule 6): when the hard minutes are
 * more than a fifth of the running, the easy runs grow to cover it, the plain
 * easy days first and the long run only after, a quarter hour at most each.
 */
function polariseWeek(days: PlannedDay[]): void {
  const runs = days.filter((d): d is PlannedDay & { run: RunSession } => d.run !== undefined)
  const minutes: RunMinutes[] = runs.map((d) => ({ kind: d.run.kind, minutes: d.run.minutes, hardMinutes: d.run.hardMinutes }))
  let missing = easyMinutesToAdd(intensityDistribution(minutes))
  if (missing === 0) return
  const stretch = (kinds: RunKind[], capEach: number) => {
    for (const day of runs) {
      if (missing <= 0 || !kinds.includes(day.run.kind) || day.run.paceSecPerKm === null) continue
      const add = Math.min(capEach, missing)
      day.run.minutes += add
      day.run.km = Math.round((day.run.km + (add * 60) / day.run.paceSecPerKm) * 10) / 10
      missing -= add
    }
  }
  stretch(['easy'], 15)
  stretch(['long'], 15)
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
  const templates = weekTemplates(model, split)
  let volume: WeekVolume = newWeekVolume(model, 1, [...templates.values()])
  // Slot → exercise chosen last time this session kind ran, so the lifts that
  // carry progression recur week to week (see SelectionContext.preferred).
  const continuity = new Map<string, string>()

  for (let offset = 0; offset < model.blockWeeks * 7; offset += 1) {
    const date: PlainDate = addDays(start, offset)
    const dow = weekday(date)
    const week = weekIndex(date, start)
    const phase = phaseParameters(week, model.blockWeeks).phase

    if (dow === 1) {
      usedThisWeek.clear()
      volume = newWeekVolume(model, week, [...templates.values()])
    }

    const gymIndex = model.gymDays.indexOf(dow)
    const todaysRun: RunKind = runKinds.get(dow) ?? 'none'
    const tomorrowsRun: RunKind = runKinds.get(dow === 7 ? 1 : dow + 1) ?? 'none'

    let gym: GymSession | undefined
    if (gymIndex >= 0) {
      const dayCtx: SelectionContext = { ...ctx, recentlyUsed: new Set([...ctx.recentlyUsed, ...usedThisWeek]) }
      gym = buildGymSession(split[gymIndex]!, week, model, dayCtx, options, todaysRun, tomorrowsRun, continuity, volume, model.customSplit?.get(dow))
      for (const e of gym.exercises) usedThisWeek.add(e.exerciseId)
    }

    const run = buildRunSession(todaysRun, week, model, paces, longRunKm, runWalk)

    const type: DayType = gym && run ? 'gym_run' : gym ? 'gym' : run ? 'run' : 'rest'
    // A hard run and a leg session on one day: the lift comes first, so the
    // intervals never sit in the hours before heavy legs (CLAUDE.md, rule 6).
    const order = gym && run && run.hardMinutes > 0 && isLowerBodySession(gym.kind, gym.focus) ? ('lift_first' as const) : undefined
    days.push({ date: toISODate(date), week, phase, type, gym, run, ...(order ? { order } : {}) })

    if (dow === 7) polariseWeek(days.slice(-7))
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
  // A day rebuilt on its own still takes only its fair share of the week: the
  // ledger is seeded with the athlete's structural week, and this session's
  // slots replace the ones it stands in for.
  const split: SessionKind[] = model.customSplit ? model.gymDays.map(() => 'custom' as const) : selectSplit(model.gymDays.length, model.tier, model.goal)
  const structural = [...weekTemplates(model, split).values()]
  const today = sessionTemplate('custom', model.goal, model.tier, model.sessionMinutes, options.focus)
  const volume = newWeekVolume(model, options.week, [...structural.slice(1), today])
  // The muscles the athlete named get a real session: at least the bottom of
  // their adaptive range this week, and all of it lands today.
  for (const m of new Set(options.focus)) {
    volume.targets[m] = Math.max(volume.targets[m], Math.round(VOLUME_LANDMARKS[m].mavMin * goalPolicy(model.goal).volumeScale))
    volume.remainingWeight[m] = today.filter((slot) => slot.muscle === m).reduce((sum, slot) => sum + SLOT_WEIGHT[slot.role], 0)
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
    volume,
    options.focus,
  )
}
