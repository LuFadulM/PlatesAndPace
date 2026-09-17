'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ExerciseFigure } from '@/components/figure/exercise-figure'
import { getExercise } from '@/domain/exercises/library'
import type { ExperienceTier, Sex } from '@/domain/profile/types'
import { FOCUS_PRESETS, FOCUS_PRESET_IDS } from '@/domain/strength/splits'
import { MUSCLE_GROUPS, type MuscleGroup } from '@/domain/strength/volume'
import { Link } from '@/i18n/navigation'
import { DEMO_TODAY, buildDemoSession } from './demo-session'

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${on ? 'border-(--color-plate-blue) bg-(--color-plate-blue) text-white' : 'border-(--color-border) bg-(--color-surface) hover:border-(--color-plate-blue)'}`

/**
 * The live demo. Every change re-runs the real engine on a stand-in athlete
 * and re-renders the session, so the visitor watches the product work before
 * signing up.
 */
export function SessionDemo() {
  const t = useTranslations('landing.demo')
  const tMuscles = useTranslations('muscles')
  const tEx = useTranslations('exercises')
  const tPresets = useTranslations('onboarding.steps.schedule.presets')

  const [focus, setFocus] = useState<MuscleGroup[]>([...FOCUS_PRESETS.glutes_hamstrings])
  const [tier, setTier] = useState<ExperienceTier>('intermediate')
  const [sessionMinutes, setMinutes] = useState<45 | 60 | 75>(60)
  const [sex, setSex] = useState<Sex>('female')

  const session = useMemo(
    () => (focus.length > 0 ? buildDemoSession({ focus, tier, sessionMinutes, sex, today: DEMO_TODAY }) : null),
    [focus, tier, sessionMinutes, sex],
  )

  const toggle = (m: MuscleGroup) => setFocus((list) => (list.includes(m) ? list.filter((x) => x !== m) : [...list, m]))

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-1.5">
          {FOCUS_PRESET_IDS.map((preset) => (
            <button type="button" key={preset} className="min-h-9 rounded-full border border-dashed border-(--color-border) px-3 text-xs font-semibold hover:border-(--color-plate-blue)" onClick={() => setFocus([...FOCUS_PRESETS[preset]])}>
              {tPresets(preset)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map((m) => {
            const index = focus.indexOf(m)
            return (
              <button type="button" key={m} aria-pressed={index >= 0} className={chip(index >= 0)} onClick={() => toggle(m)}>
                {index >= 0 ? `${index + 1}. ` : ''}{tMuscles(m)}
              </button>
            )
          })}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-(--color-ink-muted)">{t('level')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {(['beginner', 'intermediate', 'advanced'] as const).map((v) => (
                <button type="button" key={v} aria-pressed={tier === v} className={chip(tier === v)} onClick={() => setTier(v)}>{t(v)}</button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-(--color-ink-muted)">{t('length')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {([45, 60, 75] as const).map((v) => (
                <button type="button" key={v} aria-pressed={sessionMinutes === v} className={chip(sessionMinutes === v)} onClick={() => setMinutes(v)}>{t('estimate', { minutes: v })}</button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-(--color-ink-muted)">{t('sex')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {(['female', 'male'] as const).map((v) => (
                <button type="button" key={v} aria-pressed={sex === v} className={chip(sex === v)} onClick={() => setSex(v)}>{t(v)}</button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <div className="rounded-3xl border border-(--color-border) bg-(--color-surface) p-5 shadow-xl">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-2xl font-bold uppercase">{focus.length > 0 ? focus.map((m) => tMuscles(m)).join(' · ') : t('result')}</h3>
          {session && <span className="shrink-0 text-sm font-semibold text-(--color-ink-muted)">{t('estimate', { minutes: session.estimatedMinutes })}</span>}
        </div>
        <ol className="mt-4 flex flex-col gap-2" aria-live="polite">
          {session?.exercises.map((e, i) => (
            <li key={`${e.exerciseId}-${i}`} className="word-in flex items-center gap-3 rounded-2xl border border-(--color-border) bg-(--color-surface-2) px-3 py-2" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="w-6 font-display text-lg font-bold text-(--color-plate-blue)">{e.label}</span>
              <ExerciseFigure animation={getExercise(e.exerciseId).animation} title={tEx(`${e.exerciseId}.name`)} className="h-12 w-12 shrink-0 text-(--color-ink)" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{tEx(`${e.exerciseId}.name`)}</span>
                <span className="block text-xs text-(--color-ink-muted)">
                  {t('sets', { sets: e.sets, min: e.repMin, max: e.repMax })} · {t('rpe', { rpe: e.rpeTarget })}
                </span>
              </span>
              <span className="shrink-0 text-right font-display text-lg font-bold tabular-nums">{e.loadKg > 0 ? `${e.loadKg} kg` : <span className="text-xs font-semibold text-(--color-ink-muted)">{t('bodyweight')}</span>}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-(--color-ink-muted)">{t('note', { kg: sex === 'male' ? 78 : 62 })}</p>
        <Link href={{ pathname: '/sign-in', query: { next: '/onboarding' } }} className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-(--color-plate-blue) px-6 font-display text-lg font-bold uppercase tracking-wide text-white">
          {t('cta')}
        </Link>
      </div>
    </div>
  )
}
