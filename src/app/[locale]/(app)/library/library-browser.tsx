'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { ExerciseFigure } from '@/components/figure/exercise-figure'
import { MuscleMap } from '@/components/library/muscle-map'
import { matchesFilters, photoUrl, sortEntries, type LibraryEntry, type LibraryFilters } from '@/domain/exercises/catalogue'
import { buildSearchIndex, search } from '@/domain/exercises/graph'
import { EXERCISE_TYPES, MATERIALS, PURPOSES, type Difficulty, type ExerciseType, type Material, type Purpose } from '@/domain/exercises/types'
import { MUSCLE_GROUPS, type MuscleGroup } from '@/domain/strength/volume'
import { Link } from '@/i18n/navigation'

const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced']
const PAGE = 60

export function LibraryBrowser({ entries }: { entries: LibraryEntry[] }) {
  const t = useTranslations('library')
  const tM = useTranslations('muscles')
  const tT = useTranslations('taxonomy')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<LibraryFilters>({})
  const [limit, setLimit] = useState(PAGE)

  const index = useMemo(() => buildSearchIndex(entries.map((e) => ({ id: e.id, texts: e.terms }))), [entries])
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries])
  const materials = useMemo(() => MATERIALS.filter((m) => entries.some((e) => e.materials.includes(m))), [entries])

  const list = useMemo(() => {
    const pool = query.trim() ? search(index, query, entries.length).map((id) => byId.get(id)!).filter(Boolean) : sortEntries(entries)
    return pool.filter((e) => matchesFilters(e, filters))
  }, [query, filters, index, byId, entries])

  const set = <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) => {
    setFilters((f) => ({ ...f, [key]: f[key] === value ? undefined : value }))
    setLimit(PAGE)
  }
  const active = Object.values(filters).some(Boolean) || query.trim().length > 0
  const chip = (on: boolean) => `min-h-11 shrink-0 rounded-full border px-3 text-sm font-semibold ${on ? 'border-(--color-plate-blue) bg-(--color-plate-blue) text-white' : 'border-(--color-border) bg-(--color-surface)'}`

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="sr-only">{t('searchLabel')}</span>
        <input
          type="search"
          value={query}
          onChange={(ev) => { setQuery(ev.target.value); setLimit(PAGE) }}
          placeholder={t('search')}
          className="min-h-12 w-full rounded-xl border border-(--color-border) bg-(--color-surface) px-3 text-base"
        />
      </label>

      <MuscleMap value={filters.group ?? null} onChange={(g) => { setFilters((f) => ({ ...f, group: g ?? undefined })); setLimit(PAGE) }} />

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('filterMuscle')}>
        <button type="button" className={chip(!filters.group)} onClick={() => set('group', undefined)}>{t('all')}</button>
        {MUSCLE_GROUPS.map((m: MuscleGroup) => <button type="button" key={m} aria-pressed={filters.group === m} className={chip(filters.group === m)} onClick={() => set('group', m)}>{tM(m)}</button>)}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('filterPurpose')}>
        {PURPOSES.map((p: Purpose) => <button type="button" key={p} aria-pressed={filters.purpose === p} className={chip(filters.purpose === p)} onClick={() => set('purpose', p)}>{tT(`purpose.${p}`)}</button>)}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('filterType')}>
        {EXERCISE_TYPES.map((k: ExerciseType) => <button type="button" key={k} aria-pressed={filters.type === k} className={chip(filters.type === k)} onClick={() => set('type', k)}>{tT(`type.${k}`)}</button>)}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('filterEquipment')}>
        {materials.map((m: Material) => <button type="button" key={m} aria-pressed={filters.material === m} className={chip(filters.material === m)} onClick={() => set('material', m)}>{tT(`material.${m}`)}</button>)}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('filterDifficulty')}>
        {DIFFICULTIES.map((d) => <button type="button" key={d} aria-pressed={filters.difficulty === d} className={chip(filters.difficulty === d)} onClick={() => set('difficulty', d)}>{tT(`difficulty.${d}`)}</button>)}
        <button type="button" aria-pressed={filters.source === 'authored'} className={chip(filters.source === 'authored')} onClick={() => set('source', 'authored')}>{tT('source.authored')}</button>
      </div>

      <div className="flex items-center justify-between text-xs text-(--color-ink-muted)">
        <p aria-live="polite">{t('showing', { shown: Math.min(limit, list.length), total: list.length })}</p>
        {active && <button type="button" className="min-h-11 font-semibold text-(--color-plate-blue)" onClick={() => { setQuery(''); setFilters({}); setLimit(PAGE) }}>{t('clear')}</button>}
      </div>

      {list.length === 0 && <p className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4 text-sm">{t('noResults')}</p>}

      <ul className="flex flex-col gap-2" aria-label={t('title')}>
        {list.slice(0, limit).map((e) => (
          <li key={e.id}>
            <Link href={`/library/${e.id}`} className="flex min-h-16 items-center gap-3 rounded-xl border border-(--color-border) bg-(--color-surface) px-3 py-2">
              {e.animation ? (
                <ExerciseFigure animation={e.animation} title={e.name} className="h-14 w-14 shrink-0 text-(--color-ink)" />
              ) : e.photo ? (
                <Image src={photoUrl(e.photo)} alt="" width={56} height={56} unoptimized loading="lazy" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              ) : (
                <span aria-hidden="true" className="h-14 w-14 shrink-0 rounded-lg bg-(--color-border)" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-semibold break-words">{e.name}</span>
                {e.altName && <span className="block text-xs text-(--color-ink-muted) break-words">{e.altName}</span>}
                <span className="block text-xs text-(--color-ink-muted)">{tM(e.group)} · {tT(`material.${e.materials[0]!}`)} · {tT(`difficulty.${e.difficulty}`)}</span>
              </span>
              {e.source === 'authored' && <span className="shrink-0 rounded-full bg-(--color-plate-blue)/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-(--color-plate-blue)">{tT('source.authored')}</span>}
            </Link>
          </li>
        ))}
      </ul>
      {list.length > limit && (
        <button type="button" className="min-h-12 rounded-xl border border-(--color-border) bg-(--color-surface) font-semibold" onClick={() => setLimit((n) => n + PAGE)}>
          {t('showMore')}
        </button>
      )}
      <p className="text-xs text-(--color-ink-muted)">{t('attribution')}</p>
    </div>
  )
}
