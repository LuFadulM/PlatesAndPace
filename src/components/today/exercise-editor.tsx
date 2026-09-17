'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { ExerciseFigure } from '@/components/figure/exercise-figure'
import { getExercise } from '@/domain/exercises/library'
import type { PlannedExercise } from '@/domain/plan'
import { EDIT_LIMITS } from '@/domain/plan/edit'
import type { Units } from '@/domain/profile/types'
import { MUSCLE_GROUPS, type MuscleGroup } from '@/domain/strength/volume'
import { editSession, type SessionEdit } from '@/lib/actions/session'
import { displayLoad, toKg, unitLabel } from './units'

/**
 * The athlete's hand on today's session: swap a lift, change its numbers,
 * reorder, drop it, or add one. Every change goes through the same domain
 * rules the generator uses, then the page re-renders from the server so what
 * is shown is always what is stored.
 */
function useSessionEdit(date: string) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (edit: SessionEdit, onDone?: () => void) => {
    setError(null)
    startTransition(async () => {
      const result = await editSession({ date, edit })
      if (result.ok) {
        onDone?.()
        router.refresh()
      } else {
        setError(result.errorKey)
      }
    })
  }
  return { pending, error, run }
}

const tool = 'min-h-11 rounded-lg border border-(--color-border) px-3 text-sm font-semibold disabled:opacity-40'
const field = 'min-h-11 w-full rounded-lg border border-(--color-border) px-2 text-center'

function ErrorLine({ errorKey }: { errorKey: string | null }) {
  const t = useTranslations()
  if (!errorKey) return null
  return <p role="alert" className="text-sm text-(--color-plate-red)">{t(errorKey)}</p>
}

interface ToolsProps {
  date: string
  exercise: PlannedExercise
  /** Exercise ids the athlete may swap this one for, best first. */
  alternatives: readonly string[]
  units: Units
  canMoveUp: boolean
  canMoveDown: boolean
  onSwapped: (toId: string) => void
}

export function ExerciseTools({ date, exercise, alternatives, units, canMoveUp, canMoveDown, onSwapped }: ToolsProps) {
  const t = useTranslations('today.edit')
  const tEx = useTranslations('exercises')
  const tM = useTranslations('muscles')
  const tI = useTranslations('implements')
  const { pending, error, run } = useSessionEdit(date)
  const [mode, setMode] = useState<'idle' | 'swap' | 'edit' | 'remove'>('idle')
  const [scope, setScope] = useState<'session' | 'global'>('session')
  const name = tEx(`${exercise.exerciseId}.name`)

  const toggle = (next: typeof mode) => setMode((m) => (m === next ? 'idle' : next))

  return (
    <div className="flex flex-col gap-2 border-t border-(--color-border) pt-3" role="group" aria-label={t('tools', { name })}>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-expanded={mode === 'swap'} className={tool} onClick={() => toggle('swap')}>{t('swap')}</button>
        <button type="button" aria-expanded={mode === 'edit'} className={tool} onClick={() => toggle('edit')}>{t('edit')}</button>
        <button type="button" aria-label={`${t('up')}: ${name}`} disabled={!canMoveUp || pending} className={tool} onClick={() => run({ op: 'move', exerciseId: exercise.exerciseId, direction: 'up' })}>↑</button>
        <button type="button" aria-label={`${t('down')}: ${name}`} disabled={!canMoveDown || pending} className={tool} onClick={() => run({ op: 'move', exerciseId: exercise.exerciseId, direction: 'down' })}>↓</button>
        <button type="button" aria-expanded={mode === 'remove'} className={`${tool} text-(--color-plate-red)`} onClick={() => toggle('remove')}>{t('remove')}</button>
      </div>

      {mode === 'swap' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{t('swapTitle')}</p>
            <div className="flex gap-1" role="group" aria-label={t('scope')}>
              {(['session', 'global'] as const).map((s) => (
                <button type="button" key={s} aria-pressed={scope === s} onClick={() => setScope(s)} className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${scope === s ? 'border-(--color-plate-blue) bg-(--color-plate-blue) text-white' : 'border-(--color-border)'}`}>
                  {t(s === 'session' ? 'scopeSession' : 'scopeGlobal')}
                </button>
              ))}
            </div>
          </div>
          {alternatives.length === 0 ? (
            <p className="text-sm text-(--color-ink-muted)">{t('noAlternatives')}</p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto" aria-label={t('swapTitle')}>
              {alternatives.map((id) => {
                const alt = getExercise(id)
                return (
                  <li key={id}>
                    <button type="button" disabled={pending} onClick={() => run({ op: 'swap', from: exercise.exerciseId, to: id, scope }, () => onSwapped(id))} className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-(--color-border) px-2 text-left disabled:opacity-60">
                      <ExerciseFigure animation={alt.animation} title={tEx(`${id}.name`)} className="h-10 w-10 shrink-0 text-(--color-ink)" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{tEx(`${id}.name`)}</span>
                        <span className="block text-xs text-(--color-ink-muted)">{tM(alt.primary)} · {tI(alt.implement)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {mode === 'edit' && <EditForm exercise={exercise} units={units} pending={pending} onCancel={() => setMode('idle')} onSave={(edit) => run(edit, () => setMode('idle'))} />}

      {mode === 'remove' && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm">{t('confirmRemove', { name })}</p>
          <div className="flex gap-2">
            <button type="button" className={tool} onClick={() => setMode('idle')}>{t('cancel')}</button>
            <button type="button" disabled={pending} className="min-h-11 rounded-lg bg-(--color-plate-red) px-3 text-sm font-semibold text-white disabled:opacity-60" onClick={() => run({ op: 'remove', exerciseId: exercise.exerciseId })}>{t('confirm')}</button>
          </div>
        </div>
      )}

      <ErrorLine errorKey={error} />
    </div>
  )
}

function EditForm({ exercise, units, pending, onSave, onCancel }: { exercise: PlannedExercise; units: Units; pending: boolean; onSave: (edit: SessionEdit) => void; onCancel: () => void }) {
  const t = useTranslations('today.edit')
  const [sets, setSets] = useState(String(exercise.sets))
  const [repMin, setRepMin] = useState(String(exercise.repMin))
  const [repMax, setRepMax] = useState(String(exercise.repMax))
  const [load, setLoad] = useState(exercise.loadKg > 0 ? String(displayLoad(exercise.loadKg, units)) : '0')
  const [rest, setRest] = useState(String(exercise.restSec))
  const [rpe, setRpe] = useState(String(exercise.rpeTarget))
  const unit = unitLabel(units)

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    const n = (v: string, fallback: number) => (v.trim() === '' || Number.isNaN(Number(v)) ? fallback : Number(v))
    onSave({
      op: 'update',
      exerciseId: exercise.exerciseId,
      sets: Math.round(n(sets, exercise.sets)),
      repMin: Math.round(n(repMin, exercise.repMin)),
      repMax: Math.round(n(repMax, exercise.repMax)),
      loadKg: Math.max(0, toKg(n(load, 0), units)),
      restSec: Math.round(n(rest, exercise.restSec)),
      rpeTarget: n(rpe, exercise.rpeTarget),
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs">
          <span className="mb-1 block text-(--color-ink-muted)">{t('sets')}</span>
          <input type="number" inputMode="numeric" min={EDIT_LIMITS.sets.min} max={EDIT_LIMITS.sets.max} className={field} value={sets} onChange={(e) => setSets(e.target.value)} />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-(--color-ink-muted)">{t('repMin')}</span>
          <input type="number" inputMode="numeric" min={EDIT_LIMITS.reps.min} max={EDIT_LIMITS.reps.max} className={field} value={repMin} onChange={(e) => setRepMin(e.target.value)} />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-(--color-ink-muted)">{t('repMax')}</span>
          <input type="number" inputMode="numeric" min={EDIT_LIMITS.reps.min} max={EDIT_LIMITS.reps.max} className={field} value={repMax} onChange={(e) => setRepMax(e.target.value)} />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-(--color-ink-muted)">{t('load', { unit })}</span>
          <input type="number" inputMode="decimal" step={units === 'imperial' ? 5 : 0.5} min={0} className={field} value={load} onChange={(e) => setLoad(e.target.value)} />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-(--color-ink-muted)">{t('rest')}</span>
          <input type="number" inputMode="numeric" step={15} min={EDIT_LIMITS.restSec.min} max={EDIT_LIMITS.restSec.max} className={field} value={rest} onChange={(e) => setRest(e.target.value)} />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-(--color-ink-muted)">{t('rpe')}</span>
          <input type="number" inputMode="decimal" step={0.5} min={EDIT_LIMITS.rpeTarget.min} max={EDIT_LIMITS.rpeTarget.max} className={field} value={rpe} onChange={(e) => setRpe(e.target.value)} />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={tool} onClick={onCancel}>{t('cancel')}</button>
        <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-(--color-ink) px-4 text-sm font-semibold text-(--color-bg) disabled:opacity-60">{t('save')}</button>
      </div>
    </form>
  )
}

/** Adds one more exercise to the day, from everything the athlete's setup allows. */
export function AddExercise({ date, catalogue }: { date: string; catalogue: readonly string[] }) {
  const t = useTranslations('today.edit')
  const tEx = useTranslations('exercises')
  const tM = useTranslations('muscles')
  const tI = useTranslations('implements')
  const { pending, error, run } = useSessionEdit(date)
  const [open, setOpen] = useState(false)
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all')
  const list = catalogue.filter((id) => muscle === 'all' || getExercise(id).primary === muscle)
  const chip = (on: boolean) => `min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold ${on ? 'border-(--color-plate-blue) bg-(--color-plate-blue) text-white' : 'border-(--color-border) bg-(--color-surface)'}`

  return (
    <div className="rounded-xl border border-dashed border-(--color-border) bg-(--color-surface)">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex min-h-12 w-full items-center justify-between px-4 font-semibold">
        <span>{t('add')}</span>
        <span aria-hidden="true" className="font-display text-xl">{open ? '–' : '+'}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-(--color-border) px-3 py-3">
          <p className="text-xs text-(--color-ink-muted)">{t('addHelp')}</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={t('filterMuscle')}>
            <button type="button" className={chip(muscle === 'all')} onClick={() => setMuscle('all')}>{t('muscleAll')}</button>
            {MUSCLE_GROUPS.map((m) => <button type="button" key={m} className={chip(muscle === m)} onClick={() => setMuscle(m)}>{tM(m)}</button>)}
          </div>
          <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto" aria-label={t('add')}>
            {list.map((id) => {
              const e = getExercise(id)
              return (
                <li key={id}>
                  <button type="button" disabled={pending} onClick={() => run({ op: 'add', exerciseId: id }, () => setOpen(false))} className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-(--color-border) px-2 text-left disabled:opacity-60">
                    <ExerciseFigure animation={e.animation} title={tEx(`${id}.name`)} className="h-10 w-10 shrink-0 text-(--color-ink)" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{tEx(`${id}.name`)}</span>
                      <span className="block text-xs text-(--color-ink-muted)">{tM(e.primary)} · {tI(e.implement)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <ErrorLine errorKey={error} />
        </div>
      )}
    </div>
  )
}
