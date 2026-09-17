import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ExerciseFigure } from '@/components/figure/exercise-figure'
import type { AnimationId } from '@/domain/exercises/types'
import { FOCUS_PRESET_IDS, type FocusPreset } from '@/domain/strength/splits'
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

const SECTIONS = ['how', 'programs', 'why'] as const

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
  const current: Locale = isLocale(locale) ? locale : 'en'
  const other = locales.find((l) => l !== current) ?? current

  const primary =
    'inline-flex min-h-12 items-center justify-center rounded-full bg-(--color-accent) px-6 font-display text-lg font-bold uppercase tracking-wide text-(--color-hero-bg)'
  const secondary =
    'inline-flex min-h-12 items-center justify-center rounded-full border border-(--color-hero-muted) px-6 font-display text-lg font-bold uppercase tracking-wide text-(--color-hero-ink)'
  const card = 'flex flex-col gap-3 rounded-2xl border border-(--color-border) bg-(--color-surface) p-5'
  const eyebrow = 'text-xs font-semibold uppercase tracking-[0.2em] text-(--color-plate-blue)'

  return (
    <div className="min-h-screen bg-(--color-bg) text-(--color-ink)">
      {/* ---------------------------------------------------------- nav -- */}
      <header className="sticky top-0 z-30 border-b border-(--color-hero-surface) bg-(--color-hero-bg) text-(--color-hero-ink)">
        <nav aria-label={tl('nav.menu')} className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="font-display text-xl font-bold uppercase tracking-wide">
            {t('app.name')}
          </Link>
          <ul className="hidden items-center gap-6 text-sm font-semibold md:flex">
            {SECTIONS.map((id) => (
              <li key={id}>
                <a href={`#${id}`} className="py-3 text-(--color-hero-muted) hover:text-(--color-hero-ink)">
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
      <section className="overflow-hidden bg-(--color-hero-bg) text-(--color-hero-ink)">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 pt-12 pb-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:pt-20 md:pb-24">
          <div className="flex flex-col gap-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-(--color-accent)">{t('app.tagline')}</p>
            <h1 className="font-display text-5xl leading-[0.95] font-bold uppercase sm:text-6xl md:text-7xl">{tl('headline')}</h1>
            <p className="max-w-prose text-lg text-(--color-hero-muted)">{tl('body')}</p>
            <div className="flex flex-wrap gap-3">
              <Link href={{ pathname: '/sign-in', query: { next: '/onboarding' } }} className={primary}>
                {tl('getStarted')}
              </Link>
              <Link href="/sign-in" className={secondary}>
                {tl('signIn')}
              </Link>
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

          <div className="relative mx-auto w-full max-w-sm">
            <div className="rounded-3xl border border-(--color-hero-surface) bg-(--color-hero-surface) p-5 shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-accent)">{tl('heroCard.today')}</p>
              <p className="mt-1 font-display text-2xl font-bold uppercase">{tl('heroCard.sample')}</p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {(['squat', 'deadlift', 'cardio'] as const).map((a, i) => (
                  <div key={a} className={`flex aspect-square items-center justify-center rounded-2xl ${i === 0 ? 'bg-(--color-accent) text-(--color-hero-bg)' : 'bg-(--color-hero-bg) text-(--color-hero-ink)'}`}>
                    <ExerciseFigure animation={a} title={t(`exercises.${a === 'cardio' ? 'jumping_jack' : a === 'deadlift' ? 'conventional_deadlift' : 'back_squat'}.name`)} className="h-20 w-20" />
                  </div>
                ))}
              </div>
            </div>
            <div aria-hidden="true" className="absolute -top-6 -right-4 h-24 w-24 rounded-full border-8 border-(--color-plate-blue) opacity-70 md:h-32 md:w-32" />
            <div aria-hidden="true" className="absolute -bottom-6 -left-6 h-16 w-16 rounded-full border-8 border-(--color-plate-yellow) opacity-70" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ how it works -- */}
      <section id="how" className="mx-auto max-w-5xl px-4 py-16">
        <p className={eyebrow}>{tl('nav.how')}</p>
        <h2 className="mt-2 font-display text-4xl font-bold uppercase">{tl('how.title')}</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {(['step1', 'step2', 'step3'] as const).map((step, i) => (
            <li key={step} className={card}>
              <span className="font-display text-5xl font-bold text-(--color-plate-blue)">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="font-display text-2xl font-bold">{tl(`how.${step}.title`)}</h3>
              <p className="text-(--color-ink-muted)">{tl(`how.${step}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------------------- focus -- */}
      <section id="programs" className="bg-(--color-surface-2)">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <p className={eyebrow}>{tl('nav.programs')}</p>
          <h2 className="mt-2 font-display text-4xl font-bold uppercase">{tl('programs.title')}</h2>
          <p className="mt-2 max-w-prose text-(--color-ink-muted)">{tl('programs.body')}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FOCUS_PRESET_IDS.map((preset) => (
              <li key={preset} className={card}>
                <ExerciseFigure animation={PRESET_FIGURE[preset]} title={tPresets(preset)} className="h-24 w-24 text-(--color-ink)" />
                <h3 className="font-display text-2xl font-bold">{tPresets(preset)}</h3>
                <p className="text-(--color-ink-muted)">{tl(`programs.${preset}`)}</p>
              </li>
            ))}
            <li className="flex flex-col gap-3 rounded-2xl border-2 border-(--color-plate-yellow) bg-(--color-surface) p-5">
              <ExerciseFigure animation="cardio" title={tl('programs.run.title')} className="h-24 w-24 text-(--color-ink)" />
              <h3 className="font-display text-2xl font-bold">{tl('programs.run.title')}</h3>
              <p className="text-(--color-ink-muted)">{tl('programs.run.body')}</p>
            </li>
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ why -- */}
      <section id="why" className="mx-auto max-w-5xl px-4 py-16">
        <p className={eyebrow}>{tl('nav.why')}</p>
        <h2 className="mt-2 max-w-3xl font-display text-4xl font-bold uppercase">{tl('why.title')}</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {(['safe', 'progress', 'gear', 'group'] as const).map((k, i) => (
            <li key={k} className={card}>
              <span aria-hidden="true" className={`h-1.5 w-12 rounded-full ${['bg-(--color-plate-green)', 'bg-(--color-plate-blue)', 'bg-(--color-plate-yellow)', 'bg-(--color-plate-red)'][i]}`} />
              <h3 className="font-display text-2xl font-bold">{tl(`why.${k}.title`)}</h3>
              <p className="text-(--color-ink-muted)">{tl(`why.${k}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------ cta -- */}
      <section className="bg-(--color-hero-bg) text-(--color-hero-ink)">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-5 px-4 py-16 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-4xl font-bold uppercase md:text-5xl">{tl('cta.title')}</h2>
            <p className="mt-2 text-(--color-hero-muted)">{tl('cta.body')}</p>
          </div>
          <Link href={{ pathname: '/sign-in', query: { next: '/onboarding' } }} className={primary}>
            {tl('cta.button')}
          </Link>
        </div>
      </section>

      {/* --------------------------------------------------------- footer -- */}
      <footer className="border-t border-(--color-border)">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10 text-sm text-(--color-ink-muted) md:flex-row md:items-start md:justify-between">
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
        <p className="mx-auto max-w-5xl px-4 pb-8 text-xs text-(--color-ink-muted)">{t('disclaimer.short')}</p>
      </footer>
    </div>
  )
}
