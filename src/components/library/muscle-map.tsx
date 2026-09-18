'use client'

import { useTranslations } from 'next-intl'
import type { MuscleGroup } from '@/domain/strength/volume'

/**
 * A tappable body, front and back, one region per muscle group the engine
 * counts volume for. Regions are keyboard-reachable buttons drawn in SVG;
 * the chips beside it stay the accessible fallback.
 */
interface Region {
  group: MuscleGroup
  side: 'front' | 'back'
  d: string
}

// Canvas 0–100 wide per figure, 0–200 tall. Shapes are deliberately simple:
// they are targets, not anatomy.
const REGIONS: Region[] = [
  { group: 'shoulders', side: 'front', d: 'M22 42a9 9 0 1 1 18 0a9 9 0 1 1-18 0zM60 42a9 9 0 1 1 18 0a9 9 0 1 1-18 0z' },
  { group: 'chest', side: 'front', d: 'M34 46h32v18a16 8 0 0 1-16 8a16 8 0 0 1-16-8z' },
  { group: 'biceps', side: 'front', d: 'M18 52h12v26a6 6 0 0 1-12 0zM70 52h12v26a6 6 0 0 1-12 0z' },
  { group: 'abs', side: 'front', d: 'M38 74h24v34a12 6 0 0 1-24 0z' },
  { group: 'quads', side: 'front', d: 'M30 112h18v46a9 6 0 0 1-18 0zM52 112h18v46a9 6 0 0 1-18 0z' },
  { group: 'calves', side: 'front', d: 'M32 166h13v26a6 4 0 0 1-13 0zM55 166h13v26a6 4 0 0 1-13 0z' },
  { group: 'shoulders', side: 'back', d: 'M22 42a9 9 0 1 1 18 0a9 9 0 1 1-18 0zM60 42a9 9 0 1 1 18 0a9 9 0 1 1-18 0z' },
  { group: 'back', side: 'back', d: 'M32 44h36l-4 42h-28z' },
  { group: 'triceps', side: 'back', d: 'M18 52h12v26a6 6 0 0 1-12 0zM70 52h12v26a6 6 0 0 1-12 0z' },
  { group: 'glutes', side: 'back', d: 'M32 90h36v20a18 10 0 0 1-36 0z' },
  { group: 'hamstrings', side: 'back', d: 'M30 114h18v44a9 6 0 0 1-18 0zM52 114h18v44a9 6 0 0 1-18 0z' },
  { group: 'calves', side: 'back', d: 'M32 164h13v28a6 4 0 0 1-13 0zM55 164h13v28a6 4 0 0 1-13 0z' },
]

const SILHOUETTE = 'M50 8a10 10 0 1 1 0 20a10 10 0 0 1 0-20zM36 30h28l14 12v40l-8 2v-30l-2 50v56l-8 36h-8l-2-40l-2 40h-8l-8-36v-56l-2-50v30l-8-2v-40z'

export function MuscleMap({ value, onChange }: { value: MuscleGroup | null; onChange: (group: MuscleGroup | null) => void }) {
  const t = useTranslations('library')
  const tM = useTranslations('muscles')
  const figure = (side: 'front' | 'back') => (
    <svg viewBox="0 0 100 200" className="h-48 w-24" role="group" aria-label={t(side)}>
      <path d={SILHOUETTE} fill="currentColor" opacity="0.08" />
      {REGIONS.filter((r) => r.side === side).map((r) => {
        const on = value === r.group
        return (
          <path
            key={`${side}-${r.group}`}
            d={r.d}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={tM(r.group)}
            className={`cursor-pointer outline-none transition-colors focus-visible:stroke-(--color-plate-blue) ${on ? 'fill-(--color-plate-blue)' : 'fill-(--color-border) hover:fill-(--color-plate-blue)/60'}`}
            strokeWidth={2}
            onClick={() => onChange(on ? null : r.group)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault()
                onChange(on ? null : r.group)
              }
            }}
          />
        )
      })}
    </svg>
  )
  return (
    <div className="flex items-center justify-center gap-6 text-(--color-ink)" aria-label={t('muscleMap')}>
      {figure('front')}
      {figure('back')}
    </div>
  )
}
