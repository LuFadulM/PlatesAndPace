'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { FOCUS_PRESETS, FOCUS_PRESET_IDS } from '@/domain/strength/splits'
import { MUSCLE_GROUPS, type MuscleGroup } from '@/domain/strength/volume'
import { refocusDay } from '@/lib/actions/plan'

/**
 * "What do you want to train today?" — the athlete names muscle groups in
 * priority order and the day's gym session is rebuilt by the same engine that
 * planned the block, so the choice never bypasses their injuries, equipment
 * or the run scheduled for tomorrow.
 */
export function FocusPicker({ date, current, isRestDay }: { date: string; current?: readonly MuscleGroup[]; isRestDay: boolean }) {
  const t = useTranslations('today.refocus')
  const tPresets = useTranslations('onboarding.steps.schedule.presets')
  const tMuscles = useTranslations('muscles')
  const router = useRouter()
  const [chosen, setChosen] = useState<MuscleGroup[]>(() => [...(current ?? [])])
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle')
  const [pending, startTransition] = useTransition()

  const toggle = (m: MuscleGroup) => {
    setStatus('idle')
    setChosen((list) => (list.includes(m) ? list.filter((x) => x !== m) : [...list, m]))
  }

  const apply = () => {
    if (chosen.length === 0) return
    startTransition(async () => {
      const result = await refocusDay({ date, muscles: chosen })
      if (result.ok) {
        setStatus('done')
        router.refresh()
      } else {
        setStatus('error')
      }
    })
  }

  const chipClass = (on: boolean) =>
    `min-h-11 rounded-full border px-4 text-sm font-semibold ${on ? 'border-(--color-plate-blue) bg-(--color-plate-blue) text-white' : 'border-(--color-border) bg-(--color-surface)'}`

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-(--color-ink-muted)">{isRestDay ? t('restHint') : t('help')}</p>
      <div className="flex flex-wrap gap-1.5">
        {FOCUS_PRESET_IDS.map((preset) => (
          <button type="button" key={preset} className="min-h-9 rounded-full border border-dashed border-(--color-border) px-3 text-xs font-semibold" onClick={() => { setStatus('idle'); setChosen([...FOCUS_PRESETS[preset]]) }}>
            {tPresets(preset)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {MUSCLE_GROUPS.map((m) => {
          const index = chosen.indexOf(m)
          return (
            <button type="button" key={m} aria-pressed={index >= 0} className={chipClass(index >= 0)} onClick={() => toggle(m)}>
              {index >= 0 ? `${index + 1}. ` : ''}{tMuscles(m)}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" disabled={pending || chosen.length === 0} onClick={apply} className="min-h-11 flex-1 rounded-lg bg-(--color-plate-blue) font-semibold text-white disabled:opacity-60">
          {t('apply')}
        </button>
        <span className="text-xs text-(--color-ink-muted)">{t('selected', { n: chosen.length })}</span>
      </div>
      {status === 'done' && <p role="status" className="text-sm font-semibold text-(--color-plate-green)">{t('rebuilt')}</p>}
      {status === 'error' && <p role="alert" className="text-sm text-(--color-plate-red)">{t('error')}</p>}
    </div>
  )
}
