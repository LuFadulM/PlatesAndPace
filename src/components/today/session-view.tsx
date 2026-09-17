'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { formatDuration, formatPace } from '@/domain/dates'
import type { PlannedExercise, PlannedDay } from '@/domain/plan'
import type { ResolvedExercise } from '@/domain/plan/resolve'
import { nextSetMultiplier, readinessAdjustment, type Readiness } from '@/domain/strength/autoregulation'
import { nearestLoadable, roundToIncrement, type PlateInventory } from '@/domain/strength/loads'
import { getExercise } from '@/domain/exercises/library'
import type { NutritionEstimate } from '@/domain/nutrition'
import { createOutbox, setLogKey, type Outbox } from '@/lib/offline'
import { finishSession, saveReadiness, saveRun, saveSets } from '@/lib/actions/logs'
import type { LastPerformance, MaxDetail } from '@/lib/data/logs'
import type { Units } from '@/domain/profile/types'
import { ExerciseFigure } from '@/components/figure/exercise-figure'
import { AddExercise, ExerciseTools } from './exercise-editor'
import { FocusPicker } from './focus-picker'
import { RestTimer } from './rest-timer'
import { displayLoad, toKg, unitLabel } from './units'

export interface LoggedSet {
  exerciseId: string
  setIndex: number
  kg: number | null
  reps: number | null
  rpe: number | null
  done: boolean
  updatedAt: number
}

interface Props {
  date: string
  day: PlannedDay | null
  units: Units
  /** The athlete's bar and plates, for the per-side view on barbell lifts. */
  plates: PlateInventory
  /** Best estimated max per exercise, with how much to trust it. */
  maxes: Record<string, MaxDetail>
  initialSets: LoggedSet[]
  initialReadiness: Readiness | null
  alreadyDone: boolean
  initialNotes: string | null
  nutrition: NutritionEstimate | null
  /** Per exercise id, what it may be swapped for; empty when the day cannot be edited. */
  alternatives: Record<string, string[]>
  /** Everything that may be added to the day. */
  catalogue: string[]
  /** What the athlete did the last time they met each exercise. */
  lastTime: Record<string, LastPerformance>
  /** Today or later, and not yet finished: the session may still be changed. */
  editable: boolean
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="rounded-xl border border-(--color-border) bg-(--color-surface)">
      <summary className="flex min-h-11 cursor-pointer items-center px-4 font-display text-lg font-bold">{title}</summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  )
}

const input = 'min-h-11 w-full rounded-lg border border-(--color-border) px-2 text-center'

export function SessionView({ date, day, units, plates, maxes, initialSets, initialReadiness, alreadyDone, initialNotes, nutrition, alternatives, catalogue, lastTime, editable }: Props) {
  const t = useTranslations('today')
  const tEx = useTranslations('exercises')
  const tCoach = useTranslations()
  const tMuscles = useTranslations('muscles')
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [readiness, setReadiness] = useState<Readiness | null>(initialReadiness)
  const [sets, setSets] = useState<Map<string, LoggedSet>>(() => new Map(initialSets.map((s) => [setLogKey(date, s.exerciseId, s.setIndex), s])))
  const [open, setOpen] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const outbox = useRef<Outbox | null>(null)
  const [done, setDone] = useState(alreadyDone)
  const [notes, setNotes] = useState(initialNotes ?? '')
  // Bumped when a set is marked done, so the rest timer starts by itself.
  const [restKey, setRestKey] = useState(0)

  useEffect(() => {
    outbox.current = createOutbox()
    const sync = () => setOffline(!navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  const flush = useCallback(async () => {
    const box = outbox.current
    if (!box) return
    const pendingWrites = await box.pending()
    const batch = pendingWrites.filter((e) => e.kind === 'set_log').map((e) => e.payload as LoggedSet)
    if (batch.length === 0) return
    try {
      const result = await saveSets({ date, sets: batch })
      if (result.ok) for (const e of pendingWrites) await box.markSent(e.key)
    } catch {
      for (const e of pendingWrites) await box.markFailed(e.id)
    }
  }, [date])

  useEffect(() => {
    const id = window.setInterval(() => void flush(), 4000)
    window.addEventListener('online', () => void flush())
    return () => window.clearInterval(id)
  }, [flush])

  const adjustment = readiness ? readinessAdjustment(readiness) : null
  const gym = day?.gym
  const exercises = useMemo(() => {
    if (!gym) return []
    const list = [...gym.exercises]
    if (adjustment?.dropLastAccessory) {
      const last = [...list].reverse().find((e) => e.role === 'accessory' || e.role === 'isolation')
      if (last) list.splice(list.indexOf(last), 1)
    }
    return list
  }, [gym, adjustment])

  const loadFor = (exercise: PlannedExercise, setIndex: number): number => {
    let kg = exercise.loadKg * (adjustment?.loadMultiplier ?? 1)
    // Within-session autoregulation from the sets already logged for this exercise.
    let cumulative = 0
    for (let i = 0; i < setIndex; i += 1) {
      const logged = sets.get(setLogKey(date, exercise.exerciseId, i))
      if (logged?.rpe !== null && logged?.rpe !== undefined && logged.done) {
        cumulative = nextSetMultiplier({ loggedRpe: logged.rpe, targetRpe: exercise.rpeTarget }, cumulative).cumulativeAdjustment
      }
    }
    kg *= 1 + cumulative
    return kg === 0 ? 0 : roundToIncrement(kg, getExercise(exercise.exerciseId).implement, units)
  }

  const logSet = (exercise: PlannedExercise, setIndex: number, patch: Partial<LoggedSet>) => {
    const key = setLogKey(date, exercise.exerciseId, setIndex)
    const previous = sets.get(key)
    const entry: LoggedSet = {
      exerciseId: exercise.exerciseId,
      setIndex,
      kg: previous?.kg ?? (exercise.loadKg ? loadFor(exercise, setIndex) : null),
      reps: previous?.reps ?? Math.round((exercise.repMin + exercise.repMax) / 2),
      rpe: previous?.rpe ?? exercise.rpeTarget,
      done: previous?.done ?? false,
      ...patch,
      updatedAt: Date.now(),
    }
    setSets((m) => new Map(m).set(key, entry))
    void outbox.current?.enqueue({ kind: 'set_log', key, payload: entry, updatedAt: entry.updatedAt })
    // Rest starts itself after a completed set, unless it was the last one.
    if (patch.done === true && !previous?.done && setIndex < exercise.sets - 1) setRestKey((k) => k + 1)
  }

  /** One tap: every set at the suggested load, the middle of the rep range, the target RPE. */
  const logAllPlanned = (exercise: PlannedExercise) => {
    const now = Date.now()
    const entries: [string, LoggedSet][] = []
    for (let i = 0; i < exercise.sets; i += 1) {
      const key = setLogKey(date, exercise.exerciseId, i)
      const previous = sets.get(key)
      entries.push([
        key,
        {
          exerciseId: exercise.exerciseId,
          setIndex: i,
          kg: previous?.kg ?? (exercise.loadKg ? loadFor(exercise, i) : null),
          reps: previous?.reps ?? Math.round((exercise.repMin + exercise.repMax) / 2),
          rpe: previous?.rpe ?? exercise.rpeTarget,
          done: true,
          updatedAt: now,
        },
      ])
    }
    setSets((m) => {
      const next = new Map(m)
      for (const [key, entry] of entries) next.set(key, entry)
      return next
    })
    for (const [key, entry] of entries) void outbox.current?.enqueue({ kind: 'set_log', key, payload: entry, updatedAt: now })
  }

  const doneCount = (exercise: PlannedExercise) => {
    let n = 0
    for (let i = 0; i < exercise.sets; i += 1) if (sets.get(setLogKey(date, exercise.exerciseId, i))?.done) n += 1
    return n
  }

  const totals = useMemo(() => {
    let planned = 0
    let completed = 0
    let volumeKg = 0
    for (const e of exercises) {
      planned += e.sets
      for (let i = 0; i < e.sets; i += 1) {
        const logged = sets.get(setLogKey(date, e.exerciseId, i))
        if (!logged?.done) continue
        completed += 1
        if (logged.kg && logged.reps) volumeKg += logged.kg * logged.reps
      }
    }
    return { planned, completed, volumeKg }
  }, [exercises, sets, date])

  const submitReadiness = (r: Readiness) => {
    setReadiness(r)
    startTransition(async () => {
      await saveReadiness({ date, readiness: r })
    })
  }

  const finish = () => {
    startTransition(async () => {
      await flush()
      const result = await finishSession({ date, notes: notes.trim() || undefined })
      if (result.ok) {
        setDone(true)
        router.refresh()
      }
    })
  }

  if (!day) return <p className="text-(--color-ink-muted)">{t('noPlan')}</p>

  const run = day.run
  const unit = unitLabel(units)
  const gymTitle = gym
    ? gym.kind === 'custom' && gym.focus && gym.focus.length > 0
      ? gym.focus.map((m) => tMuscles(m)).join(' · ')
      : tCoach(gym.titleKey)
    : ''
  const summaryOf = (e: PlannedExercise) => `${e.sets} × ${e.holdSeconds ? `${e.holdSeconds} s` : `${e.repMin}–${e.repMax}`}${e.loadKg ? `, ${displayLoad(e.loadKg * (adjustment?.loadMultiplier ?? 1), units)} ${unit}` : ''}`
  const effortOf = (e: PlannedExercise) => (e.role === 'mobility' ? '' : t('effort', { rpe: e.rpeTarget, rir: Math.max(0, Math.round((10 - e.rpeTarget) * 2) / 2) }))
  const shortDate = (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(`${iso}T12:00:00`))
  const maxLine = (e: PlannedExercise) => {
    const m = maxes[e.exerciseId]
    if (!m || e.loadKg === 0) return null
    return t('maxLine', { amount: displayLoad(m.e1rm, units), unit, confidence: t(`confidence.${m.confidence}`) })
  }
  const progressionLine = (e: ResolvedExercise) => (e.progression && e.progression.reason !== 'max' && e.progression.reason !== 'first' ? t(`progression.${e.progression.reason}`) : null)
  const plateLine = (e: PlannedExercise, kg: number) => {
    if (getExercise(e.exerciseId).implement !== 'barbell' || kg <= 0) return null
    const load = nearestLoadable(kg, plates)
    if (load.perSideKg.length === 0) return t('plates.barOnly', { bar: displayLoad(plates.barKg, units), unit })
    return t('plates.perSide', { plates: load.perSideKg.map((p) => displayLoad(p, units)).join(' + '), unit, bar: displayLoad(plates.barKg, units) })
  }
  const lastLine = (e: PlannedExercise) => {
    const last = lastTime[e.exerciseId]
    if (!last || last.sets.length === 0) return t('firstTime')
    const parts = last.sets.map((s) => (s.kg ? `${displayLoad(s.kg, units)}×${s.reps ?? '–'}` : `${s.reps ?? '–'}`))
    return t('lastTime', { date: shortDate(last.date), sets: parts.join(', ') })
  }
  const volume = displayLoad(totals.volumeKg, units)
  const canEdit = editable && !done

  return (
    <div className="flex flex-col gap-4">
      {offline && <p role="status" className="rounded-full bg-(--color-plate-yellow) px-3 py-1 text-center text-xs font-semibold">{t('savedOffline')}</p>}
      {done && (
        <div role="status" className="rounded-xl bg-(--color-plate-green) px-4 py-3 text-center text-white">
          <p className="font-semibold">{t('sessionDone')}</p>
          {gym && <p className="text-sm">{t('summary', { done: totals.completed, total: totals.planned, amount: volume, unit })}</p>}
        </div>
      )}

      {gym && (
        <>
          <div>
            <h2 className="font-display text-3xl font-bold">{gymTitle}</h2>
            <p className="text-sm text-(--color-ink-muted)">{tCoach(gym.intentKey)} · {t('estimate', { minutes: gym.estimatedMinutes })}</p>
          </div>

          {totals.planned > 0 && (
            <div aria-live="polite">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold tabular-nums">{t('progress', { done: totals.completed, total: totals.planned })}</span>
                {totals.volumeKg > 0 && <span className="text-(--color-ink-muted) tabular-nums">{t('volume', { amount: volume, unit })}</span>}
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-(--color-surface-2)" role="progressbar" aria-valuemin={0} aria-valuemax={totals.planned} aria-valuenow={totals.completed}>
                <div className="h-full rounded-full bg-(--color-plate-green) transition-[width] duration-500" style={{ width: `${Math.round((totals.completed / totals.planned) * 100)}%` }} />
              </div>
            </div>
          )}

          {gym.adjustments && gym.adjustments.length > 0 && (
            <details className="rounded-xl border border-dashed border-(--color-border) bg-(--color-surface) text-sm">
              <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold">{t('adjustments.title', { n: gym.adjustments.length })}</summary>
              <ul className="flex flex-col gap-1 px-4 pb-3 text-(--color-ink-muted)">
                {gym.adjustments.map((a) => (
                  <li key={`${a.reason}-${a.exerciseId}`}>
                    {t(a.removed ? 'adjustments.removed' : 'adjustments.trimmed', { name: tEx(`${a.exerciseId}.name`), sets: a.setsRemoved })} · {t(`adjustments.${a.reason}`, { minutes: gym.estimatedMinutes })}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <Section title={t('readiness')} defaultOpen={!readiness && !done}>
            {readiness ? (
              <p className="text-sm">{tCoach(readinessAdjustment(readiness).messageKey)}</p>
            ) : (
              <ReadinessForm onSubmit={submitReadiness} />
            )}
          </Section>

          <Section title={t('warmup')}><p className="text-sm">{tCoach(gym.warmupKey)}</p></Section>

          {nutrition && (
            <Section title={t('fuel')}>
              <p className="text-sm">{t('fuelLine', { kcal: nutrition.targetKcal, protein: nutrition.proteinG, water: (nutrition.waterMlPerTrainingDay / 1000).toFixed(1) })}</p>
              <p className="mt-1 text-xs text-(--color-ink-muted)">{tCoach('nutrition.notes.estimateOnly')}</p>
            </Section>
          )}

          <ol className="flex flex-col gap-2" aria-label={t('exercises')}>
            {exercises.map((e, index) => {
              const isOpen = open === e.exerciseId
              const count = doneCount(e)
              const complete = count >= e.sets
              return (
                <li key={e.exerciseId} className="rounded-xl border border-(--color-border) bg-(--color-surface)">
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : e.exerciseId)} className="flex min-h-14 w-full items-center gap-3 px-3 text-left">
                    <span className={`w-7 font-display text-lg font-bold ${complete ? 'text-(--color-plate-green)' : 'text-(--color-plate-blue)'}`}>{e.label}</span>
                    <ExerciseFigure animation={getExercise(e.exerciseId).animation} title={tEx(`${e.exerciseId}.name`)} className="h-12 w-12 shrink-0 text-(--color-ink)" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{tEx(`${e.exerciseId}.name`)}</span>
                      <span className="block text-xs text-(--color-ink-muted)">{summaryOf(e)}{effortOf(e) ? ` · ${effortOf(e)}` : ''}{e.technique !== 'straight' ? ` · ${t(`technique.${e.technique}`)}` : ''}</span>
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ${complete ? 'text-(--color-plate-green)' : ''}`}>{count}/{e.sets}</span>
                  </button>
                  {isOpen && (
                    <div className="flex flex-col gap-2 border-t border-(--color-border) px-3 py-3">
                      <div className="flex items-center gap-3">
                        <ExerciseFigure animation={getExercise(e.exerciseId).animation} title={tEx(`${e.exerciseId}.name`)} className="h-28 w-28 shrink-0 text-(--color-ink)" />
                        <div className="text-xs text-(--color-ink-muted)">
                          <p>{tEx(`${e.exerciseId}.cue1`)}</p>
                          <p>{tEx(`${e.exerciseId}.cue2`)}</p>
                          <p className="mt-1 text-(--color-plate-red)">{tEx(`${e.exerciseId}.mistake1`)}</p>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-(--color-plate-blue)">{lastLine(e)}</p>
                      {(maxLine(e) || progressionLine(e as ResolvedExercise)) && (
                        <p className="text-xs text-(--color-ink-muted)">{[maxLine(e), progressionLine(e as ResolvedExercise)].filter(Boolean).join(' · ')}</p>
                      )}
                      {plateLine(e, loadFor(e, 0)) && <p className="text-xs text-(--color-ink-muted)">{plateLine(e, loadFor(e, 0))}</p>}
                      {Array.from({ length: e.sets }, (_, i) => {
                        const logged = sets.get(setLogKey(date, e.exerciseId, i))
                        const suggested = loadFor(e, i)
                        return (
                          <div key={i} className="grid grid-cols-[2rem_1fr_1fr_1fr_2.75rem] items-center gap-2">
                            <span className="text-sm font-semibold">{i + 1}</span>
                            <label className="text-xs">
                              <span className="sr-only">{t('kg')}</span>
                              <input type="number" inputMode="decimal" step={units === 'imperial' ? 5 : 0.5} aria-label={`${t('kg')} ${i + 1}`} className={input} placeholder={e.loadKg ? String(displayLoad(suggested, units)) : '—'} value={logged?.kg !== null && logged?.kg !== undefined ? displayLoad(logged.kg, units) : ''} onChange={(ev) => logSet(e, i, { kg: ev.target.value === '' ? null : toKg(Number(ev.target.value), units) })} />
                            </label>
                            <input type="number" inputMode="numeric" aria-label={`${t('reps')} ${i + 1}`} className={input} placeholder={`${e.repMin}–${e.repMax}`} value={logged?.reps ?? ''} onChange={(ev) => logSet(e, i, { reps: ev.target.value === '' ? null : Number(ev.target.value) })} />
                            <input type="number" inputMode="decimal" step={0.5} min={1} max={10} aria-label={`${t('rpe')} ${i + 1}`} className={input} placeholder={String(e.rpeTarget)} value={logged?.rpe ?? ''} onChange={(ev) => logSet(e, i, { rpe: ev.target.value === '' ? null : Number(ev.target.value) })} />
                            <button type="button" aria-pressed={logged?.done ?? false} aria-label={`${t('setDone')} ${i + 1}`} onClick={() => logSet(e, i, { done: !(logged?.done ?? false) })} className={`min-h-11 rounded-lg font-bold ${logged?.done ? 'bg-(--color-plate-green) text-white' : 'border border-(--color-border)'}`}><svg aria-hidden="true" viewBox="0 0 20 20" className="mx-auto h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 10.5l4 4 8-9" /></svg></button>
                          </div>
                        )
                      })}
                      <div className="grid grid-cols-[2rem_1fr_1fr_1fr_2.75rem] gap-2 text-center text-[10px] uppercase text-(--color-ink-muted)"><span /><span>{unit}</span><span>{t('reps')}</span><span>{t('rpe')}</span><span /></div>
                      <div className="flex flex-wrap items-center gap-2">
                        <RestTimer seconds={e.restSec} autoStartKey={restKey} />
                        {!complete && !done && (
                          <button type="button" onClick={() => logAllPlanned(e)} className="min-h-11 rounded-lg bg-(--color-plate-green)/15 px-3 text-sm font-semibold text-(--color-plate-green)">
                            {t('logAllPlanned')}
                          </button>
                        )}
                      </div>
                      {canEdit && (
                        <ExerciseTools
                          date={date}
                          exercise={e}
                          alternatives={alternatives[e.exerciseId] ?? []}
                          units={units}
                          canMoveUp={index > 0}
                          canMoveDown={index < exercises.length - 1}
                          onSwapped={(to) => setOpen(to)}
                        />
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>

          {canEdit && <AddExercise date={date} catalogue={catalogue} />}

          {gym.finisher && (
            <Section title={t('finisher')}>
              <p className="font-semibold">{tEx(`${gym.finisher.exerciseId}.name`)}</p>
              <p className="text-sm text-(--color-ink-muted)">{t('finisherLine')}</p>
            </Section>
          )}
        </>
      )}

      {run && day.order === 'lift_first' && gym && <p role="note" className="rounded-full bg-(--color-plate-yellow) px-3 py-1 text-center text-xs font-semibold">{t('liftFirst')}</p>}
      {run && <RunCard run={run} date={date} locale={locale} />}

      {!done && (
        <Section title={t('refocus.title')} defaultOpen={!gym}>
          <FocusPicker date={date} current={gym?.focus} isRestDay={!gym} />
        </Section>
      )}

      {!done && (gym || run) && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold">
            <span className="mb-1 block">{t('notes')}</span>
            <textarea value={notes} onChange={(ev) => setNotes(ev.target.value)} rows={2} maxLength={1000} placeholder={t('notesPlaceholder')} className="w-full rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm font-normal" />
          </label>
          <button type="button" disabled={pending} onClick={finish} className="min-h-12 rounded-xl bg-(--color-plate-green) font-display text-lg font-bold text-white disabled:opacity-60">
            {t('finish')}
          </button>
        </div>
      )}
      {done && notes.trim() && <p className="rounded-xl border border-(--color-border) bg-(--color-surface) px-4 py-3 text-sm whitespace-pre-wrap">{notes}</p>}
    </div>
  )
}

function ReadinessForm({ onSubmit }: { onSubmit: (r: Readiness) => void }) {
  const t = useTranslations('today.readinessForm')
  const [r, setR] = useState<Readiness>({ sleep: 3, soreness: 3, energy: 3 })
  const Row = ({ k }: { k: keyof Readiness }) => (
    <fieldset className="flex items-center justify-between gap-2">
      <legend className="sr-only">{t(k)}</legend>
      <span className="text-sm">{t(k)}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((v) => (
          <button type="button" key={v} aria-pressed={r[k] === v} onClick={() => setR({ ...r, [k]: v })} className={`h-11 w-11 rounded-lg text-sm font-bold ${r[k] === v ? 'bg-(--color-plate-blue) text-white' : 'border border-(--color-border)'}`}>{v}</button>
        ))}
      </div>
    </fieldset>
  )
  return (
    <div className="flex flex-col gap-3">
      <Row k="sleep" /><Row k="soreness" /><Row k="energy" />
      <button type="button" onClick={() => onSubmit(r)} className="min-h-11 rounded-lg bg-(--color-ink) font-semibold text-(--color-bg)">{t('save')}</button>
    </div>
  )
}

function RunCard({ run, date, locale }: { run: NonNullable<PlannedDay['run']>; date: string; locale: string }) {
  const t = useTranslations('today')
  const tRuns = useTranslations()
  const [minutes, setMinutes] = useState('')
  const [km, setKm] = useState('')
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  return (
    <section className="rounded-xl border-2 border-(--color-plate-yellow) bg-(--color-surface) p-4">
      <h2 className="font-display text-2xl font-bold">{tRuns(run.titleKey)}</h2>
      <p className="text-sm text-(--color-ink-muted)">{tRuns(run.intentKey)}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div><dt className="text-[10px] uppercase text-(--color-ink-muted)">{t('runMinutes')}</dt><dd className="font-display text-xl font-bold">{run.minutes}</dd></div>
        {run.km > 0 && <div><dt className="text-[10px] uppercase text-(--color-ink-muted)">{t('km')}</dt><dd className="font-display text-xl font-bold">{run.km}</dd></div>}
        {run.paceSecPerKm && <div><dt className="text-[10px] uppercase text-(--color-ink-muted)">{t('pace')}</dt><dd className="font-display text-xl font-bold">{formatPace(run.paceSecPerKm, locale)}</dd></div>}
      </dl>
      {run.intervals && <p className="mt-2 text-sm">{t('intervalLine', { reps: run.intervals.reps, meters: run.intervals.workMeters, rest: formatDuration(run.intervals.restSec, locale), pace: formatPace(run.intervals.paceSecPerKm, locale) })}</p>}
      {run.runWalk && <p className="mt-2 text-sm">{t('runWalkLine', { repeats: run.runWalk.repeats, run: run.runWalk.runMinutes, walk: run.runWalk.walkMinutes })}</p>}
      <p className="mt-1 text-xs text-(--color-ink-muted)">
        {run.hrRange ? t('zoneRange', { zone: run.hrZone, min: run.hrRange.minBpm, max: run.hrRange.maxBpm }) : t('zone', { zone: run.hrZone })}
        {run.hrRange ? ` · ${t(`zoneMethod.${run.hrRange.method}`)}${run.hrRange.maxEstimated ? ` · ${t('zoneMaxEstimated')}` : ''}` : ''}
      </p>
      <Link href={{ pathname: '/run', query: { date } }} className="mt-3 flex min-h-11 items-center justify-center rounded-lg bg-(--color-plate-yellow) font-semibold">{t('guidedRun')}</Link>
      {!saved ? (
        <form className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2" onSubmit={(e) => { e.preventDefault(); startTransition(async () => { const r = await saveRun({ date, plannedType: run.kind === 'none' ? null : run.kind, minutes: Number(minutes), km: Number(km) }); if (r.ok) setSaved(true) }) }}>
          <input type="number" inputMode="decimal" step="0.1" required aria-label={t('runMinutes')} placeholder={t('runMinutes')} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="min-h-11 rounded-lg border border-(--color-border) px-2" />
          <input type="number" inputMode="decimal" step="0.01" required aria-label="km" placeholder="km" value={km} onChange={(e) => setKm(e.target.value)} className="min-h-11 rounded-lg border border-(--color-border) px-2" />
          <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-(--color-ink) px-3 font-semibold text-(--color-bg) disabled:opacity-60">{t('logRun')}</button>
        </form>
      ) : <p role="status" className="mt-3 text-sm font-semibold text-(--color-plate-green)">{t('runSaved')}</p>}
    </section>
  )
}
