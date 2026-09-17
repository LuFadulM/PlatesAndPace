import { ExerciseFigure } from '@/components/figure/exercise-figure'
import type { AnimationId } from '@/domain/exercises/types'

interface Row {
  label: string
  name: string
  meta: string
  animation: AnimationId
}

/**
 * A phone showing the Today screen with the session ticking itself off. The
 * rows light up one after another on a CSS timeline, so the hero moves
 * without a line of JavaScript; reduced motion holds the finished state.
 */
export function PhoneMock({ week, todayLabel, title, meta, rows, done, days }: { week: string; todayLabel: string; title: string; meta: string; rows: Row[]; done: string; days: string[] }) {
  return (
    <div className="relative mx-auto w-[300px] rounded-[2.4rem] border-[6px] border-(--color-hero-surface) bg-(--color-hero-surface) p-2 shadow-2xl">
      <div aria-hidden="true" className="absolute top-2 left-1/2 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-(--color-hero-surface)" />
      <div className="rounded-[1.9rem] bg-(--color-bg) px-4 pt-9 pb-5 text-(--color-ink)">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-(--color-ink-muted)">{week}</p>
        <ol className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold">
          {days.map((d, i) => (
            <li key={d} className={`rounded-lg py-1 ${i === 3 ? 'bg-(--color-plate-red) text-white' : i < 3 ? 'bg-(--color-plate-green)/20' : 'bg-(--color-surface-2)'}`}>{d}</li>
          ))}
        </ol>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-(--color-plate-red)">{todayLabel}</p>
        <p className="font-display text-2xl leading-tight font-bold">{title}</p>
        <p className="text-xs text-(--color-ink-muted)">{meta}</p>
        <ol className="mt-3 flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <li
              key={row.label}
              style={{ animationDelay: `${1.2 + i * 1.3}s` }}
              className="flex items-center gap-2 rounded-xl border border-(--color-border) bg-(--color-surface) px-2 py-1.5"
              data-tick=""
            >
              <span className="w-4 font-display text-sm font-bold text-(--color-plate-blue)">{row.label}</span>
              <ExerciseFigure animation={row.animation} title={row.name} className="h-8 w-8 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{row.name}</span>
                <span className="block text-[10px] text-(--color-ink-muted)">{row.meta}</span>
              </span>
              <span aria-hidden="true" className="tick h-5 w-5 rounded-md border border-(--color-border)" style={{ animationDelay: `${1.2 + i * 1.3}s` }} />
            </li>
          ))}
        </ol>
        <p className="done-line mt-3 rounded-xl bg-(--color-plate-green) px-3 py-2 text-center text-xs font-semibold text-white" style={{ animationDelay: `${1.2 + rows.length * 1.3}s` }}>{done}</p>
      </div>
    </div>
  )
}
