import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ExerciseFigure } from '@/components/figure/exercise-figure'
import { Counter } from '@/components/landing/counter'
import { Marquee } from '@/components/landing/marquee'
import { PhoneMock } from '@/components/landing/phone-mock'
import { Reveal } from '@/components/landing/reveal'
import { RotatingWord } from '@/components/landing/rotating-word'
import { SessionDemo } from '@/components/landing/session-demo'
import { EXERCISES } from '@/domain/exercises/library'
import type { AnimationId } from '@/domain/exercises/types'
import { readinessAdjustment, type Readiness } from '@/domain/strength/autoregulation'
import { FOCUS_PRESET_IDS, type FocusPreset } from '@/domain/strength/splits'
import { MUSCLE_GROUPS } from '@/domain/strength/volume'
import { Link } from '@/i18n/navigation'
import { isLocale, locales, type Locale } from '@/i18n/routing'

const PRESET_FIGURE: Record<FocusPreset, AnimationId> = {
  legs: 'squat',
  glutes_hamstrings: 'hip_thrust',
  push: 'horizontal_push',
  pull: 'lat_pulldown',
  upper: 'vertical_push',
  full_body: 'deadlift',
}

const SECTIONS = ['how', 'demo', 'programs', 'why'] as const
const ANIMATION_COUNT = new Set(EXERCISES.map((e) => e.animation)).size

/** Three days as the readiness check-in would score them. */
const COACH_DAYS: Array<{ key: 'good' | 'moderate' | 'low'; readiness: Readiness }> = [
  // Each answer scores 1–5 with 5 as best, and the three are summed.
  { key: 'good', readiness: { sleep: 5, soreness: 5, energy: 5 } },
  { key: 'moderate', readiness: { sleep: 3, soreness: 3, energy: 3 } },
  { key: 'low', readiness: { sleep: 1, soreness: 2, energy: 2 } },
]

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()
  const tl = await getTranslations('landing')
  const tPresets = await getTranslations('onboarding.steps.schedule.presets')
  const tMuscles = await getTranslations('muscles')
  const tEx = await getTranslations('exercises')
  const tDays = await getTranslations('onboarding.days')
  const current: Locale = isLocale(locale) ? locale : 'en'
  const other = locales.find((l) => l !== current) ?? current

  const primary =
    'inline-flex min-h-12 items-center justify-center rounded-full bg-(--color-accent) px-6 font-display text-lg font-bold uppercase tracking-wide text-(--color-hero-bg) transition-transform hover:-translate-y-0.5'
  const secondary =
    'inline-flex min-h-12 items-center justify-center rounded-full border border-(--color-hero-muted) px-6 font-display text-lg font-bold uppercase tracking-wide text-(--color-hero-ink) transition-colors hover:border-(--color-hero-ink)'
  const card = 'card-lift flex flex-col gap-3 rounded-2xl border border-(--color-border) bg-(--color-surface) p-5'
  const eyebrow = 'text-xs font-semibold uppercase tracking-[0.2em] text-(--color-plate-blue)'

  const rotating = (['w1', 'w2', 'w3', 'w4', 'w5', 'w6'] as const).map((k) => tl(`rotating.${k}`))
  const marqueeItems = [...MUSCLE_GROUPS.map((m) => tMuscles(m)), ...FOCUS_PRESET_IDS.map((p) => tPresets(p))]
  const phoneRows = [
    { label: 'A', name: tEx('hip_thrust.name'), meta: '4 × 8 · 60 kg', animation: 'hip_thrust' as const },
    { label: 'B', name: tEx('romanian_deadlift.name'), meta: '3 × 10 · 45 kg', animation: 'hinge' as const },
    { label: 'C', name: tEx('bulgarian_split_squat.name'), meta: '3 × 10 · 12 kg', animation: 'split_squat' as const },
    { label: 'D', name: tEx('leg_curl.name'), meta: '3 × 12 · 30 kg', animation: 'leg_curl' as const },
    { label: 'E', name: tEx('cable_kickback.name'), meta: '3 × 15 · 10 kg', animation: 'kickback' as const },
  ]
  const days = [1, 2, 3, 4, 5, 6, 7].map((d) => tDays(String(d)))

  return (
    <div className="min-h-screen bg-(--color-bg) text-(--color-ink)">
      {/* ---------------------------------------------------------- nav -- */}
      <header className="sticky top-0 z-30 border-b border-(--color-hero-surface) bg-(--color-hero-bg)/90 text-(--color-hero-ink) backdrop-blur">
        <nav aria-label={tl('nav.menu')} className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="font-display text-xl font-bold uppercase tracking-wide">
            {t('app.name')}
          </Link>
          <ul className="hidden items-center gap-6 text-sm font-semibold md:flex">
            {SECTIONS.map((id) => (
              <li key={id}>
                <a href={`#${id}`} className="py-3 text-(--color-hero-muted) transition-colors hover:text-(--color-hero-ink)">
                  {tl(`nav.${id}`)}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <Link href="/" locale={other} className="flex min-h-11 items-center px-2 text-sm font-semibold text-(--color-hero-muted)">
              {t(`locale.${other}`)}
            </Link>
            <Link href="/sign-in" className="hidden min-h-11 items-center px-3 text-sm font-semibold sm:flex">
              {tl('signIn')}
            </Link>
            <Link
              href={{ pathname: '/sign-in', query: { next: '/onboarding' } }}
              className="inline-flex min-h-11 items-center rounded-full bg-(--color-accent) px-4 text-sm font-bold uppercase tracking-wide text-(--color-hero-bg)"
            >
              {tl('getStarted')}
            </Link>
          </div>
        </nav>
      </header>

      {/* --------------------------------------------------------- hero -- */}
      <section className="relative overflow-hidden bg-(--color-hero-bg) text-(--color-hero-ink)">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_80%_20%,rgb(214_255_63_/_0.14),transparent_60%),radial-gradient(40%_40%_at_10%_90%,rgb(91_141_255_/_0.18),transparent_60%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pt-12 pb-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:pt-20 md:pb-24">
          <div className="flex flex-col gap-6">
            <p className="flex flex-wrap items-baseline gap-2 font-display text-xl font-bold uppercase tracking-wide text-(--color-accent)">
              <span>{tl('eyebrow')}</span>
              <RotatingWord words={rotating} className="text-(--color-hero-ink)" />
            </p>
            <h1 className="font-display text-5xl leading-[0.95] font-bold uppercase sm:text-6xl md:text-7xl">{tl('headline')}</h1>
            <p className="max-w-prose text-lg text-(--color-hero-muted)">{tl('body')}</p>
            <div className="flex flex-wrap gap-3">
              <Link href={{ pathname: '/sign-in', query: { next: '/onboarding' } }} className={primary}>
                {tl('getStarted')}
              </Link>
              <a href="#demo" className={secondary}>
                {tl('nav.demo')}
              </a>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-(--color-hero-muted)">
              {(['exercises', 'everyDay', 'languages'] as const).map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-(--color-accent)" />
                  {tl(`stats.${k}`)}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto py-6">
            <div aria-hidden="true" className="pulse-ring absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-(--color-accent)" />
            <div aria-hidden="true" className="float-slow absolute -top-2 -right-6 h-24 w-24 rounded-full border-8 border-(--color-plate-blue) opacity-80 md:h-32 md:w-32" />
            <div aria-hidden="true" className="float-fast absolute -bottom-2 -left-8 h-16 w-16 rounded-full border-8 border-(--color-plate-yellow) opacity-80" />
            <div aria-hidden="true" className="float-slow absolute -bottom-6 right-2 h-10 w-10 rounded-full bg-(--color-accent) opacity-90" />
            <PhoneMock week={tl('phone.week')} todayLabel={tl('phone.today')} title={tl('phone.title')} meta={tl('phone.meta')} rows={phoneRows} done={tl('phone.done')} days={days} />
          </div>
        </div>
      </section>

      <Marquee items={marqueeItems} label={tl('nav.programs')} />

      {/* ------------------------------------------------------- numbers -- */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <Reveal>
          <p className={eyebrow}>{tl('numbers.title')}</p>
        </Reveal>
        <dl className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {(
            [
              ['exercises', EXERCISES.length],
              ['animations', ANIMATION_COUNT],
              ['days', 365],
              ['languages', locales.length],
            ] as const
          ).map(([k, n], i) => (
            <Reveal key={k} delay={(i % 4) as 0 | 1 | 2 | 3} className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-5">
              <dt className="order-2 text-sm text-(--color-ink-muted)">{tl(`numbers.${k}`)}</dt>
              <dd className="font-display text-5xl font-bold text-(--color-plate-blue)"><Counter value={n} /></dd>
            </Reveal>
          ))}
        </dl>
      </section>

      {/* ------------------------------------------------------ how it works -- */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
        <Reveal>
          <p className={eyebrow}>{tl('nav.how')}</p>
          <h2 className="mt-2 font-display text-4xl font-bold uppercase md:text-5xl">{tl('how.title')}</h2>
        </Reveal>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {(['step1', 'step2', 'step3'] as const).map((step, i) => (
            <Reveal as="li" key={step} delay={(i + 1) as 1 | 2 | 3} className={card}>
              <span className="font-display text-5xl font-bold text-(--color-plate-blue)">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="font-display text-2xl font-bold">{tl(`how.${step}.title`)}</h3>
              <p className="text-(--color-ink-muted)">{tl(`how.${step}.body`)}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ----------------------------------------------------------- demo -- */}
      <section id="demo" className="scroll-mt-20 bg-(--color-surface-2)">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Reveal>
            <p className={eyebrow}>{tl('nav.demo')}</p>
            <h2 className="mt-2 font-display text-4xl font-bold uppercase md:text-5xl">{tl('demo.title')}</h2>
            <p className="mt-2 max-w-prose text-(--color-ink-muted)">{tl('demo.body')}</p>
          </Reveal>
          <div className="mt-8">
            <SessionDemo />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- focus -- */}
      <section id="programs" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <Reveal>
          <p className={eyebrow}>{tl('nav.programs')}</p>
          <h2 className="mt-2 font-display text-4xl font-bold uppercase md:text-5xl">{tl('programs.title')}</h2>
          <p className="mt-2 max-w-prose text-(--color-ink-muted)">{tl('programs.body')}</p>
        </Reveal>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FOCUS_PRESET_IDS.map((preset, i) => (
            <Reveal as="li" key={preset} delay={(i % 4) as 0 | 1 | 2 | 3} className={card}>
              <ExerciseFigure animation={PRESET_FIGURE[preset]} title={tPresets(preset)} className="h-24 w-24 text-(--color-ink)" />
              <h3 className="font-display text-2xl font-bold">{tPresets(preset)}</h3>
              <p className="text-(--color-ink-muted)">{tl(`programs.${preset}`)}</p>
            </Reveal>
          ))}
          <Reveal as="li" delay={2} className="card-lift flex flex-col gap-3 rounded-2xl border-2 border-(--color-plate-yellow) bg-(--color-surface) p-5 sm:col-span-2">
            <ExerciseFigure animation="cardio" title={tl('programs.run.title')} className="h-24 w-24 text-(--color-ink)" />
            <h3 className="font-display text-2xl font-bold">{tl('programs.run.title')}</h3>
            <p className="text-(--color-ink-muted)">{tl('programs.run.body')}</p>
          </Reveal>
        </ul>
      </section>

      {/* ---------------------------------------------------------- coach -- */}
      <section className="bg-(--color-hero-bg) text-(--color-hero-ink)">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-accent)">{tl('coach.title')}</p>
            <h2 className="mt-2 font-display text-4xl font-bold uppercase md:text-5xl">{tl('coach.body')}</h2>
          </Reveal>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {COACH_DAYS.map(({ key, readiness }, i) => {
              const adj = readinessAdjustment(readiness)
              const pct = Math.round(adj.loadMultiplier * 100)
              return (
                <Reveal as="li" key={key} delay={(i + 1) as 1 | 2 | 3} className="flex flex-col gap-3 rounded-2xl border border-(--color-hero-surface) bg-(--color-hero-surface) p-5">
                  <p className="text-sm font-semibold text-(--color-hero-muted)">{tl(`coach.${key}`)}</p>
                  <p className="font-display text-2xl font-bold">{t(adj.messageKey)}</p>
                  <div className="mt-auto">
                    <div className="h-2 overflow-hidden rounded-full bg-(--color-hero-bg)">
                      <div className="bar-fill h-full rounded-full bg-(--color-accent)" style={{ width: `${pct}%`, animationDelay: `${0.3 + i * 0.2}s` }} />
                    </div>
                    <p className="mt-1 text-xs font-semibold tabular-nums text-(--color-hero-muted)">{pct}%</p>
                  </div>
                </Reveal>
              )
            })}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ why -- */}
      <section id="why" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <Reveal>
          <p className={eyebrow}>{tl('nav.why')}</p>
          <h2 className="mt-2 max-w-3xl font-display text-4xl font-bold uppercase md:text-5xl">{tl('why.title')}</h2>
        </Reveal>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {(['safe', 'progress', 'gear', 'group'] as const).map((k, i) => (
            <Reveal as="li" key={k} delay={(i % 4) as 0 | 1 | 2 | 3} className={card}>
              <span aria-hidden="true" className={`h-1.5 w-12 rounded-full ${['bg-(--color-plate-green)', 'bg-(--color-plate-blue)', 'bg-(--color-plate-yellow)', 'bg-(--color-plate-red)'][i]}`} />
              <h3 className="font-display text-2xl font-bold">{tl(`why.${k}.title`)}</h3>
              <p className="text-(--color-ink-muted)">{tl(`why.${k}.body`)}</p>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------ cta -- */}
      <section className="relative overflow-hidden bg-(--color-hero-bg) text-(--color-hero-ink)">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_90%_50%,rgb(214_255_63_/_0.16),transparent_60%)]" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-16 md:flex-row md:items-center md:justify-between">
          <Reveal>
            <h2 className="font-display text-4xl font-bold uppercase md:text-5xl">{tl('cta.title')}</h2>
            <p className="mt-2 text-(--color-hero-muted)">{tl('cta.body')}</p>
          </Reveal>
          <Link href={{ pathname: '/sign-in', query: { next: '/onboarding' } }} className={primary}>
            {tl('cta.button')}
          </Link>
        </div>
      </section>

      {/* --------------------------------------------------------- footer -- */}
      <footer className="border-t border-(--color-border) pb-24 md:pb-0">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-(--color-ink-muted) md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-display text-xl font-bold uppercase text-(--color-ink)">{t('app.name')}</p>
            <p>{t('app.tagline')}</p>
            <p className="mt-2 max-w-sm">{tl('footer.madeFor')}</p>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li><Link href="/sign-in" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">{tl('signIn')}</Link></li>
            <li><Link href="/privacy" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">{t('settings.privacyLink')}</Link></li>
            <li><Link href="/" locale={other} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">{t(`locale.${other}`)}</Link></li>
          </ul>
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-(--color-ink-muted)">{t('disclaimer.short')}</p>
      </footer>

      {/* Sticky call to action on phones: never more than one thumb away. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-(--color-hero-surface) bg-(--color-hero-bg)/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <Link href={{ pathname: '/sign-in', query: { next: '/onboarding' } }} className="flex min-h-12 items-center justify-center rounded-full bg-(--color-accent) font-display text-lg font-bold uppercase tracking-wide text-(--color-hero-bg)">
          {tl('sticky.cta')}
        </Link>
      </div>
    </div>
  )
}
