'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ExerciseFigure } from '@/components/figure/exercise-figure'
import { EXERCISES } from '@/domain/exercises/library'
import { MUSCLE_GROUPS, type MuscleGroup } from '@/domain/strength/volume'
import type { Implement } from '@/domain/strength/loads'

const IMPLEMENTS: Implement[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight']

export function LibraryBrowser() {
  const t = useTranslations('library')
  const tEx = useTranslations('exercises')
  const tM = useTranslations('muscles')
  const tI = useTranslations('implements')
  const tC = useTranslations('categories')
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all')
  const [implement, setImplement] = useState<Implement | 'all'>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const list = useMemo(
    () => EXERCISES.filter((e) => (muscle === 'all' || e.primary === muscle || e.secondary.includes(muscle)) && (implement === 'all' || e.implement === implement)),
    [muscle, implement],
  )
  const chip = (on: boolean) => `min-h-11 rounded-full border px-3 text-sm font-semibold ${on ? 'border-(--color-plate-blue) bg-(--color-plate-blue) text-white' : 'border-(--color-border) bg-(--color-surface)'}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('filterMuscle')}>
        <button type="button" className={chip(muscle === 'all')} onClick={() => setMuscle('all')}>{t('all')}</button>
        {MUSCLE_GROUPS.map((m) => <button type="button" key={m} className={chip(muscle === m)} onClick={() => setMuscle(m)}>{tM(m)}</button>)}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('filterEquipment')}>
        <button type="button" className={chip(implement === 'all')} onClick={() => setImplement('all')}>{t('all')}</button>
        {IMPLEMENTS.map((i) => <button type="button" key={i} className={chip(implement === i)} onClick={() => setImplement(i)}>{tI(i)}</button>)}
      </div>
      <p className="text-xs text-(--color-ink-muted)">{t('count', { n: list.length })}</p>
      <ul className="flex flex-col gap-2">
        {list.map((e) => {
          const open = openId === e.id
          return (
            <li key={e.id} className="rounded-xl border border-(--color-border) bg-(--color-surface)">
              <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : e.id)} className="flex min-h-16 w-full items-center gap-3 px-3 text-left">
                <ExerciseFigure animation={e.animation} title={tEx(`${e.id}.name`)} className="h-14 w-14 shrink-0 text-(--color-ink)" />
                <span className="flex-1">
                  <span className="block font-semibold">{tEx(`${e.id}.name`)}</span>
                  <span className="block text-xs text-(--color-ink-muted)">{tM(e.primary)} · {tI(e.implement)} · {tC(e.category)}</span>
                </span>
              </button>
              {open && (
                <div className="border-t border-(--color-border) px-3 py-3 text-sm">
                  <div className="flex justify-center py-2"><ExerciseFigure animation={e.animation} title={tEx(`${e.id}.name`)} className="h-40 w-40 text-(--color-ink)" /></div>
                  <h3 className="font-display text-base font-bold">{t('cues')}</h3>
                  <ul className="list-disc pl-5"><li>{tEx(`${e.id}.cue1`)}</li><li>{tEx(`${e.id}.cue2`)}</li></ul>
                  <h3 className="mt-2 font-display text-base font-bold">{t('mistakes')}</h3>
                  <ul className="list-disc pl-5"><li>{tEx(`${e.id}.mistake1`)}</li><li>{tEx(`${e.id}.mistake2`)}</li></ul>
                  {e.secondary.length > 0 && <p className="mt-2 text-xs text-(--color-ink-muted)">{t('alsoWorks')}: {e.secondary.map((m) => tM(m)).join(', ')}</p>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
