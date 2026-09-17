'use client'

import { useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { detectTimeZone, todayInZone, toISODate } from '@/domain/dates'
import { MACHINE_IDS, EXERCISE_IDS } from '@/domain/exercises/library'
import { FOCUS_PRESETS, FOCUS_PRESET_IDS } from '@/domain/strength/splits'
import { MUSCLE_GROUPS, type MuscleGroup } from '@/domain/strength/volume'
import {
  QUESTIONNAIRE_STEPS,
  STEP_SCHEMAS,
  anyHealthFlag,
  toCm,
  toKg,
  type QuestionnaireAnswers,
  type QuestionnaireStep,
} from '@/domain/profile/questionnaire'
import { saveAnswersAndGeneratePlan } from '@/lib/actions/plan'

type Draft = { [K in QuestionnaireStep]: Partial<QuestionnaireAnswers[K]> }

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const

function initialDraft(locale: Locale, initial: QuestionnaireAnswers | null): Draft {
  if (initial) return { ...initial }
  const timezone = detectTimeZone()
  return {
    basics: { locale, timezone, units: 'metric', displayName: '' },
    body: { sex: 'unspecified' },
    health: { heartCondition: false, chestPain: false, dizziness: false, jointProblem: false, bloodPressureMedication: false, pregnancy: false, other: false },
    goals: {},
    experience: { knowsBigLifts: false },
    schedule: { gymDays: [], runDays: [], splitMode: 'auto', customSplit: {}, sessionMinutes: 60, startDate: toISODate(todayInZone(timezone)), blockWeeks: 8 },
    equipment: { setting: 'full_gym', unavailableMachines: [] },
    injuries: { areas: [], note: '' },
    preferences: { focusAreas: [], intensity: 'hard', avoidExerciseIds: [] },
  }
}

const field = 'min-h-11 w-full rounded-lg border border-(--color-border) bg-(--color-surface) px-3 text-base'
const label = 'flex flex-col gap-1.5 text-sm font-medium'
const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-4 text-sm font-semibold ${on ? 'border-(--color-plate-blue) bg-(--color-plate-blue) text-white' : 'border-(--color-border) bg-(--color-surface)'}`

export function OnboardingWizard({ locale, initial, editing }: { locale: Locale; initial: QuestionnaireAnswers | null; editing: boolean }) {
  const t = useTranslations('onboarding')
  const tEx = useTranslations('exercises')
  const tLocale = useTranslations('locale')
  const tMuscles = useTranslations('muscles')
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>(() => initialDraft(locale, initial))
  const [errors, setErrors] = useState<string[]>([])
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [canRun, setCanRun] = useState(initial ? initial.experience.recentRun !== undefined : true)

  const key = QUESTIONNAIRE_STEPS[step]!
  const imperial = draft.basics.units === 'imperial'

  const update = <K extends QuestionnaireStep>(k: K, patch: Partial<QuestionnaireAnswers[K]>) =>
    setDraft((d) => ({ ...d, [k]: { ...d[k], ...patch } }))

  const validateCurrent = (): boolean => {
    const result = STEP_SCHEMAS[key].safeParse(draft[key])
    if (result.success) {
      setErrors([])
      return true
    }
    setErrors(result.error.issues.map((i) => i.path.join('.') || 'form'))
    return false
  }

  const next = () => {
    if (!validateCurrent()) return
    setStep((s) => Math.min(s + 1, QUESTIONNAIRE_STEPS.length - 1))
  }

  const submit = () => {
    if (!validateCurrent()) return
    setServerError(null)
    startTransition(async () => {
      const result = await saveAnswersAndGeneratePlan(draft)
      if (result.ok) router.push('/today')
      else setServerError(result.errorKey)
    })
  }

  const toggle = (list: number[] | string[] | undefined, value: never): never[] => {
    const arr = (list ?? []) as never[]
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
  }

  const machineNames = useMemo(() => MACHINE_IDS, [])

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-(--color-ink-muted)">
          {t('stepOf', { step: step + 1, total: QUESTIONNAIRE_STEPS.length })}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-(--color-surface-2)" role="progressbar" aria-valuemin={1} aria-valuemax={QUESTIONNAIRE_STEPS.length} aria-valuenow={step + 1}>
          <div className="h-full bg-(--color-plate-blue) transition-all" style={{ width: `${((step + 1) / QUESTIONNAIRE_STEPS.length) * 100}%` }} />
        </div>
      </div>

      <h2 className="text-2xl font-bold">{t(`steps.${key}.title`)}</h2>

      {key === 'basics' && (
        <div className="flex flex-col gap-4">
          <label className={label}>{t('steps.basics.displayName')}<input className={field} value={draft.basics.displayName ?? ''} onChange={(e) => update('basics', { displayName: e.target.value })} maxLength={60} /></label>
          <label className={label}>{t('steps.basics.locale')}
            <select className={field} value={draft.basics.locale} onChange={(e) => update('basics', { locale: e.target.value as Locale })}>
              <option value="en">{tLocale('en')}</option><option value="es">{tLocale('es')}</option>
            </select>
          </label>
          <label className={label}>{t('steps.basics.timezone')}<input className={field} value={draft.basics.timezone ?? ''} onChange={(e) => update('basics', { timezone: e.target.value })} /></label>
          <fieldset className="flex gap-2"><legend className="mb-1.5 text-sm font-medium">{t('steps.basics.units')}</legend>
            {(['metric', 'imperial'] as const).map((u) => <button type="button" key={u} className={chip(draft.basics.units === u)} onClick={() => update('basics', { units: u })}>{t(`steps.basics.${u}`)}</button>)}
          </fieldset>
        </div>
      )}

      {key === 'body' && (
        <div className="flex flex-col gap-4">
          <fieldset><legend className="mb-1.5 text-sm font-medium">{t('steps.body.sex')}</legend>
            <div className="flex flex-wrap gap-2">{(['female', 'male', 'unspecified'] as const).map((s) => <button type="button" key={s} className={chip(draft.body.sex === s)} onClick={() => update('body', { sex: s })}>{t(`steps.body.${s}`)}</button>)}</div>
            <p className="mt-1 text-xs text-(--color-ink-muted)">{t('steps.body.sexHelp')}</p>
          </fieldset>
          <label className={label}>{t('steps.body.birthDate')}<input type="date" className={field} value={draft.body.birthDate ?? ''} onChange={(e) => update('body', { birthDate: e.target.value })} /></label>
          <label className={label}>{t('steps.body.height')} ({imperial ? 'in' : 'cm'})
            <input type="number" inputMode="decimal" className={field} onChange={(e) => update('body', { heightCm: imperial ? toCm(Number(e.target.value)) : Number(e.target.value) })} defaultValue={draft.body.heightCm ? (imperial ? Math.round(draft.body.heightCm / 2.54) : draft.body.heightCm) : ''} />
          </label>
          <label className={label}>{t('steps.body.weight')} ({imperial ? 'lb' : 'kg'})
            <input type="number" inputMode="decimal" className={field} onChange={(e) => update('body', { weightKg: imperial ? toKg(Number(e.target.value)) : Number(e.target.value) })} defaultValue={draft.body.weightKg ? (imperial ? Math.round(draft.body.weightKg / 0.45359237) : draft.body.weightKg) : ''} />
          </label>
          <label className={label}>{t('steps.body.waist')} ({imperial ? 'in' : 'cm'})
            <input type="number" inputMode="decimal" className={field} onChange={(e) => update('body', { waistCm: e.target.value ? (imperial ? toCm(Number(e.target.value)) : Number(e.target.value)) : undefined })} />
          </label>
        </div>
      )}

      {key === 'health' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-(--color-ink-muted)">{t('steps.health.intro')}</p>
          {(['heartCondition', 'chestPain', 'dizziness', 'jointProblem', 'bloodPressureMedication', 'pregnancy', 'other'] as const).map((q) => (
            <fieldset key={q} className="flex items-center justify-between gap-3"><legend className="sr-only">{t(`steps.health.${q}`)}</legend>
              <span className="text-sm">{t(`steps.health.${q}`)}</span>
              <div className="flex shrink-0 gap-1">
                <button type="button" className={chip(draft.health[q] === true)} onClick={() => update('health', { [q]: true } as Partial<QuestionnaireAnswers['health']>)}>{t('steps.health.yes')}</button>
                <button type="button" className={chip(draft.health[q] === false)} onClick={() => update('health', { [q]: false } as Partial<QuestionnaireAnswers['health']>)}>{t('steps.health.no')}</button>
              </div>
            </fieldset>
          ))}
          {draft.health.other && <label className={label}>{t('steps.health.otherNote')}<input className={field} value={draft.health.otherNote ?? ''} onChange={(e) => update('health', { otherNote: e.target.value })} /></label>}
          {anyHealthFlag(draft.health as QuestionnaireAnswers['health']) && <p role="status" className="rounded-lg border border-(--color-plate-yellow) bg-(--color-surface) p-3 text-sm">{t('steps.health.clearance')}</p>}
        </div>
      )}

      {key === 'goals' && (
        <div className="flex flex-col gap-4">
          <fieldset><legend className="mb-1.5 text-sm font-medium">{t('steps.goals.primary')}</legend>
            <div className="flex flex-col gap-2">{(['build_muscle', 'get_strong', 'lose_fat', 'fit_and_firm', 'run_faster', 'hybrid'] as const).map((g) => <button type="button" key={g} className={`${chip(draft.goals.primary === g)} text-left`} onClick={() => update('goals', { primary: g })}>{t(`steps.goals.${g}`)}</button>)}</div>
          </fieldset>
          {(draft.goals.primary === 'run_faster' || draft.goals.primary === 'hybrid') && (
            <>
              <fieldset><legend className="mb-1.5 text-sm font-medium">{t('steps.goals.targetRace')}</legend>
                <div className="flex gap-2">{(['5k', '10k', 'half'] as const).map((r) => <button type="button" key={r} className={chip(draft.goals.targetRace === r)} onClick={() => update('goals', { targetRace: r })}>{t(`steps.goals.${r}`)}</button>)}</div>
              </fieldset>
              <label className={label}>{t('steps.goals.raceDate')}<input type="date" className={field} value={draft.goals.raceDate ?? ''} onChange={(e) => update('goals', { raceDate: e.target.value || undefined })} /></label>
            </>
          )}
        </div>
      )}

      {key === 'experience' && (
        <div className="flex flex-col gap-4">
          <fieldset><legend className="mb-1.5 text-sm font-medium">{t('steps.experience.lifting')}</legend>
            <div className="flex flex-col gap-2">{(['none', 'under_1_year', '1_to_3_years', '3_plus_years'] as const).map((l) => <button type="button" key={l} className={`${chip(draft.experience.lifting === l)} text-left`} onClick={() => update('experience', { lifting: l })}>{t(`steps.experience.${l}`)}</button>)}</div>
          </fieldset>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={draft.experience.knowsBigLifts ?? false} onChange={(e) => update('experience', { knowsBigLifts: e.target.checked })} />{t('steps.experience.knowsBigLifts')}</label>
          <fieldset><legend className="mb-1.5 text-sm font-medium">{t('steps.experience.running')}</legend>
            <div className="flex gap-2">
              <button type="button" className={chip(canRun)} onClick={() => { setCanRun(true); update('experience', { continuousRunMinutes: undefined }) }}>{t('steps.experience.canRun')}</button>
              <button type="button" className={chip(!canRun)} onClick={() => { setCanRun(false); update('experience', { recentRun: undefined }) }}>{t('steps.experience.cannotRun')}</button>
            </div>
          </fieldset>
          {canRun ? (
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>{t('steps.experience.recentKm')}<input type="number" inputMode="decimal" step="0.1" className={field} defaultValue={draft.experience.recentRun?.km ?? ''} onChange={(e) => update('experience', { recentRun: { km: Number(e.target.value), minutes: draft.experience.recentRun?.minutes ?? 0 } })} /></label>
              <label className={label}>{t('steps.experience.recentMinutes')}<input type="number" inputMode="decimal" className={field} defaultValue={draft.experience.recentRun?.minutes ?? ''} onChange={(e) => update('experience', { recentRun: { km: draft.experience.recentRun?.km ?? 0, minutes: Number(e.target.value) } })} /></label>
            </div>
          ) : (
            <label className={label}>{t('steps.experience.continuousMinutes')}<input type="number" inputMode="numeric" className={field} defaultValue={draft.experience.continuousRunMinutes ?? ''} onChange={(e) => update('experience', { continuousRunMinutes: Number(e.target.value) })} /></label>
          )}
        </div>
      )}

      {key === 'schedule' && (
        <div className="flex flex-col gap-4">
          <fieldset><legend className="mb-1.5 text-sm font-medium">{t('steps.schedule.gymDays')}</legend>
            <div className="flex flex-wrap gap-2">{DAYS.map((d) => <button type="button" key={d} className={chip((draft.schedule.gymDays ?? []).includes(d))} onClick={() => update('schedule', { gymDays: toggle(draft.schedule.gymDays, d as never) })}>{t(`days.${d}`)}</button>)}</div>
          </fieldset>
          <fieldset><legend className="mb-1.5 text-sm font-medium">{t('steps.schedule.splitMode')}</legend>
            <div className="flex gap-2">
              <button type="button" className={chip((draft.schedule.splitMode ?? 'auto') === 'auto')} onClick={() => update('schedule', { splitMode: 'auto' })}>{t('steps.schedule.splitAuto')}</button>
              <button type="button" className={chip(draft.schedule.splitMode === 'custom')} onClick={() => update('schedule', { splitMode: 'custom' })}>{t('steps.schedule.splitCustom')}</button>
            </div>
          </fieldset>
          {draft.schedule.splitMode === 'custom' && (
            <div className="flex flex-col gap-4 rounded-xl border border-(--color-border) bg-(--color-surface) p-3">
              <p className="text-xs text-(--color-ink-muted)">{t('steps.schedule.splitHelp')}</p>
              {[...(draft.schedule.gymDays ?? [])].sort((a, b) => a - b).map((d) => {
                const chosen: MuscleGroup[] = draft.schedule.customSplit?.[String(d)] ?? []
                const setDay = (muscles: MuscleGroup[]) => update('schedule', { customSplit: { ...(draft.schedule.customSplit ?? {}), [String(d)]: muscles } })
                return (
                  <fieldset key={d}>
                    <legend className="mb-1.5 text-sm font-medium">{t('steps.schedule.dayFocus', { day: t(`days.${d}`) })}</legend>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {FOCUS_PRESET_IDS.map((preset) => <button type="button" key={preset} className="min-h-9 rounded-full border border-dashed border-(--color-border) px-3 text-xs font-semibold" onClick={() => setDay([...FOCUS_PRESETS[preset]])}>{t(`steps.schedule.presets.${preset}`)}</button>)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {MUSCLE_GROUPS.map((m) => {
                        const index = chosen.indexOf(m)
                        return (
                          <button type="button" key={m} aria-pressed={index >= 0} className={chip(index >= 0)} onClick={() => setDay(index >= 0 ? chosen.filter((x) => x !== m) : [...chosen, m])}>
                            {index >= 0 ? `${index + 1}. ` : ''}{tMuscles(m)}
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>
                )
              })}
            </div>
          )}
          <fieldset><legend className="mb-1.5 text-sm font-medium">{t('steps.schedule.runDays')}</legend>
            <div className="flex flex-wrap gap-2">{DAYS.map((d) => <button type="button" key={d} className={chip((draft.schedule.runDays ?? []).includes(d))} onClick={() => update('schedule', { runDays: toggle(draft.schedule.runDays, d as never) })}>{t(`days.${d}`)}</button>)}</div>
          </fieldset>
          {(draft.schedule.runDays ?? []).length > 0 && (
            <fieldset><legend className="mb-1.5 text-sm font-medium">{t('steps.schedule.longRunDay')}</legend>
              <div className="flex flex-wrap gap-2">{(draft.schedule.runDays ?? []).map((d) => <button type="button" key={d} className={chip(draft.schedule.longRunDay === d)} onClick={() => update('schedule', { longRunDay: d })}>{t(`days.${d}`)}</button>)}</div>
            </fieldset>
          )}
          <fieldset><legend className="mb-1.5 text-sm font-medium">{t('steps.schedule.sessionMinutes')}</legend>
            <div className="flex flex-wrap gap-2">{([30, 45, 60, 75, 90] as const).map((m) => <button type="button" key={m} className={chip(draft.schedule.sessionMinutes === m)} onClick={() => update('schedule', { sessionMinutes: m })}>{t('steps.schedule.minutes', { n: m })}</button>)}</div>
          </fieldset>
          <fieldset><legend className="mb-1.5 text-sm font-medium">{t('steps.schedule.blockWeeks')}</legend>
            <div className="flex flex-wrap gap-2">{([4, 6, 8, 12] as const).map((w) => <button type="button" key={w} className={chip(draft.schedule.blockWeeks === w)} onClick={() => update('schedule', { blockWeeks: w })}>{t('steps.schedule.weeks', { n: w })}</button>)}</div>
          </fieldset>
          <label className={label}>{t('steps.schedule.startDate')}<input type="date" className={field} value={draft.schedule.startDate ?? ''} onChange={(e) => update('schedule', { startDate: e.target.value })} /><span className="text-xs font-normal text-(--color-ink-muted)">{t('steps.schedule.startHelp')}</span></label>
        </div>
      )}

      {key === 'equipment' && (
        <div className="flex flex-col gap-4">
          <fieldset><legend className="mb-1.5 text-sm font-medium">{t('steps.equipment.setting')}</legend>
            <div className="flex flex-col gap-2">{(['full_gym', 'dumbbells_bench', 'home_none'] as const).map((s) => <button type="button" key={s} className={`${chip(draft.equipment.setting === s)} text-left`} onClick={() => update('equipment', { setting: s })}>{t(`steps.equipment.${s}`)}</button>)}</div>
          </fieldset>
          {draft.equipment.setting === 'full_gym' && (
            <fieldset><legend className="mb-1.5 text-sm font-medium">{t('steps.equipment.unavailable')}</legend>
              <div className="flex flex-wrap gap-2">{machineNames.map((m) => <button type="button" key={m} className={chip((draft.equipment.unavailableMachines ?? []).includes(m))} onClick={() => update('equipment', { unavailableMachines: toggle(draft.equipment.unavailableMachines, m as never) })}>{m.replace(/_/g, ' ')}</button>)}</div>
            </fieldset>
          )}
        </div>
      )}

      {key === 'injuries' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-(--color-ink-muted)">{t('steps.injuries.intro')}</p>
          <div className="flex flex-wrap gap-2">{(['knees', 'lower_back', 'shoulders', 'hips', 'wrists', 'neck'] as const).map((a) => <button type="button" key={a} className={chip((draft.injuries.areas ?? []).includes(a))} onClick={() => update('injuries', { areas: toggle(draft.injuries.areas, a as never) })}>{t(`steps.injuries.${a}`)}</button>)}</div>
          <label className={label}>{t('steps.injuries.note')}<textarea className={`${field} min-h-24 py-2`} value={draft.injuries.note ?? ''} maxLength={500} onChange={(e) => update('injuries', { note: e.target.value })} /></label>
        </div>
      )}

      {key === 'preferences' && (
        <div className="flex flex-col gap-4">
          <fieldset><legend className="mb-1.5 text-sm font-medium">{t('steps.preferences.focusAreas')}</legend>
            <div className="flex flex-wrap gap-2">{(['glutes', 'legs', 'arms', 'shoulders', 'back', 'chest', 'abs'] as const).map((f) => <button type="button" key={f} className={chip((draft.preferences.focusAreas ?? []).includes(f))} onClick={() => update('preferences', { focusAreas: toggle(draft.preferences.focusAreas, f as never) })}>{t(`steps.preferences.${f}`)}</button>)}</div>
          </fieldset>
          <fieldset><legend className="mb-1.5 text-sm font-medium">{t('steps.preferences.intensity')}</legend>
            <div className="flex gap-2">{(['moderate', 'hard', 'very_hard'] as const).map((i) => <button type="button" key={i} className={chip(draft.preferences.intensity === i)} onClick={() => update('preferences', { intensity: i })}>{t(`steps.preferences.${i}`)}</button>)}</div>
          </fieldset>
          <label className={label}>{t('steps.preferences.avoid')}
            <select multiple className={`${field} min-h-32 py-2`} value={draft.preferences.avoidExerciseIds ?? []} onChange={(e) => update('preferences', { avoidExerciseIds: [...e.target.selectedOptions].map((o) => o.value) })}>
              {EXERCISE_IDS.map((id) => <option key={id} value={id}>{tEx(`${id}.name`)}</option>)}
            </select>
          </label>
        </div>
      )}

      {errors.length > 0 && <p role="alert" className="text-sm text-(--color-plate-red)">{t('errors.invalid')}</p>}
      {serverError && <p role="alert" className="text-sm text-(--color-plate-red)">{t(serverError.replace('onboarding.', ''))}</p>}

      <div className="flex gap-3">
        {step > 0 && <button type="button" className="min-h-11 flex-1 rounded-lg border border-(--color-border) font-semibold" onClick={() => setStep((s) => s - 1)}>{t('back')}</button>}
        {step < QUESTIONNAIRE_STEPS.length - 1 ? (
          <button type="button" className="min-h-11 flex-1 rounded-lg bg-(--color-plate-blue) font-semibold text-white" onClick={next}>{t('next')}</button>
        ) : (
          <button type="button" disabled={pending} className="min-h-11 flex-1 rounded-lg bg-(--color-plate-blue) font-semibold text-white disabled:opacity-60" onClick={submit}>{pending ? t('building') : t('finish')}</button>
        )}
      </div>
      {editing && <p className="text-xs text-(--color-ink-muted)">{t('editingNote')}</p>}
    </div>
  )
}
