'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { intakeProgress, type FoodEntry, type FrequentFood } from '@/domain/nutrition'
import type { Macros } from '@/domain/nutrition'
import { logFood, removeFood } from '@/lib/actions/food'

const field = 'min-h-11 w-full rounded-lg border border-(--color-border) bg-(--color-surface) px-2 text-center text-base'

/**
 * What the athlete ate, against what the day asked for.
 *
 * The numbers are theirs. The brief's food databases are unreachable and
 * inventing macros for a named food would be fabricating a nutritional claim
 * (CLAUDE.md, rule 9), so the form asks and the card says so. The repeat list
 * is built from their own history, which is the part that makes logging twice
 * a week survivable.
 */
export function FoodLog({
  date,
  isToday,
  entries,
  frequent,
  targetKcal,
  macros,
}: {
  date: string
  /** Whether `date` is the athlete's own today, which changes the empty copy. */
  isToday: boolean
  entries: FoodEntry[]
  frequent: FrequentFood[]
  targetKcal: number
  macros: Macros
}) {
  const t = useTranslations('food')
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  const [removeFailed, setRemoveFailed] = useState(false)
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({ name: '', kcal: '', proteinG: '', carbsG: '', fatG: '' })

  const progress = intakeProgress(entries, targetKcal, macros)
  const over = progress.remaining.kcal < 0

  const submit = (entry: { name: string; kcal: number; proteinG: number; carbsG: number; fatG: number }) => {
    setFailed(false)
    setRemoveFailed(false)
    startTransition(async () => {
      const result = await logFood({ date, ...entry })
      if (!result?.ok) setFailed(true)
      else {
        setForm({ name: '', kcal: '', proteinG: '', carbsG: '', fatG: '' })
        setOpen(false)
      }
    })
  }

  const num = (value: string) => Math.max(0, Math.round(Number(value) || 0))

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-(--color-border) pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="font-display text-base font-bold">{t('title')}</h4>
        <p className="text-sm tabular-nums">
          {t('eaten', { kcal: progress.eaten.kcal, target: targetKcal })}
          <span className={`ml-2 font-semibold ${over ? 'text-(--color-plate-red)' : 'text-(--color-plate-green)'}`}>
            {over ? t('over', { kcal: -progress.remaining.kcal }) : t('left', { kcal: progress.remaining.kcal })}
          </span>
        </p>
      </div>

      <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-(--color-border)">
        <div
          className={`h-full rounded-full ${over ? 'bg-(--color-plate-red)' : 'bg-(--color-plate-green)'}`}
          style={{ width: `${Math.min(100, Math.round(progress.fraction.kcal * 100))}%` }}
        />
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
        {([['protein', progress.eaten.proteinG, macros.proteinG], ['carbs', progress.eaten.carbsG, macros.carbsG], ['fat', progress.eaten.fatG, macros.fatG]] as const).map(([key, eaten, target]) => (
          <div key={key} className="rounded-lg bg-(--color-surface-2) py-1.5">
            <dt className="text-[10px] uppercase text-(--color-ink-muted)">{t(key)}</dt>
            <dd className="font-display font-bold tabular-nums">{eaten}/{target}</dd>
          </div>
        ))}
      </dl>

      {entries.length === 0 ? (
        <p className="text-xs text-(--color-ink-muted)">{isToday ? t('empty') : t('emptyPast')}</p>
      ) : (
        <ul className="flex flex-col gap-1" aria-label={t('title')}>
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 break-words">{e.name}</span>
              <span className="shrink-0 tabular-nums text-(--color-ink-muted)">{e.kcal} {t('kcal')}</span>
              <button
                type="button"
                aria-label={t('remove', { name: e.name })}
                disabled={pending}
                onClick={() => {
                  setRemoveFailed(false)
                  startTransition(async () => {
                    const result = await removeFood({ id: e.id })
                    // The row is rendered from the server's copy, so a failed
                    // delete leaves it on screen with nothing said. Say it.
                    if (!result?.ok) setRemoveFailed(true)
                  })
                }}
                className="min-h-11 shrink-0 px-2 text-(--color-plate-red)"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {frequent.length > 0 && !open && (
        <div className="flex flex-wrap gap-1" role="group" aria-label={t('again')}>
          {frequent.map((f) => (
            <button
              key={f.name}
              type="button"
              disabled={pending}
              onClick={() => submit({ name: f.name, kcal: f.kcal, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG })}
              className="min-h-11 rounded-full border border-(--color-border) px-3 text-xs font-semibold"
            >
              {f.name} · {f.kcal}
            </button>
          ))}
        </div>
      )}

      {failed && <p role="alert" className="text-xs text-(--color-plate-red)">{t('error')}</p>}
      {removeFailed && <p role="alert" className="text-xs text-(--color-plate-red)">{t('removeError')}</p>}

      {open ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(ev) => {
            ev.preventDefault()
            if (!form.name.trim()) return
            submit({ name: form.name.trim(), kcal: num(form.kcal), proteinG: num(form.proteinG), carbsG: num(form.carbsG), fatG: num(form.fatG) })
          }}
        >
          <label className="text-xs font-semibold">
            {t('name')}
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('namePlaceholder')} className={`${field} mt-1 text-left`} />
          </label>
          <div className="grid grid-cols-4 gap-2">
            {([['kcal', 'kcal'], ['proteinG', 'protein'], ['carbsG', 'carbs'], ['fatG', 'fat']] as const).map(([key, label]) => (
              <label key={key} className="text-[10px] font-semibold uppercase text-(--color-ink-muted)">
                {t(label)}
                <input type="number" inputMode="numeric" min={0} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={`${field} mt-1`} />
              </label>
            ))}
          </div>
          <button type="submit" disabled={pending || !form.name.trim()} className="min-h-11 rounded-lg bg-(--color-ink) font-semibold text-(--color-bg) disabled:opacity-60">
            {pending ? t('saving') : t('save')}
          </button>
          <p className="text-[10px] text-(--color-ink-muted)">{t('noDatabase')}</p>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-lg border border-(--color-border) text-sm font-semibold">
          {t('add')}
        </button>
      )}
    </div>
  )
}
