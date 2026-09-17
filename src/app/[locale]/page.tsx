import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { isLocale, locales, type Locale } from '@/i18n/routing'

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()
  const current: Locale = isLocale(locale) ? locale : 'en'
  const other = locales.find((l) => l !== current) ?? current

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-12">
      <p className="text-sm font-medium tracking-wide text-(--color-plate-blue) uppercase">
        {t('app.name')}
      </p>
      <h1 className="text-4xl leading-tight font-bold">{t('landing.headline')}</h1>
      <p className="text-(--color-ink-muted)">{t('landing.body')}</p>

      <div className="flex flex-col gap-3">
        <Link
          href={{ pathname: '/sign-in', query: { next: '/onboarding' } }}
          className="flex min-h-12 items-center justify-center rounded-lg bg-(--color-plate-blue) px-4 font-semibold text-white"
        >
          {t('landing.getStarted')}
        </Link>
        <Link
          href="/sign-in"
          className="flex min-h-12 items-center justify-center rounded-lg border border-(--color-border) px-4 font-semibold"
        >
          {t('landing.signIn')}
        </Link>
      </div>

      <div className="flex items-center justify-between text-sm text-(--color-ink-muted)">
        <Link href="/" locale={other} className="min-h-11 py-3 underline underline-offset-4">
          {t(`locale.${other}`)}
        </Link>
        <Link href="/privacy" className="min-h-11 py-3 underline underline-offset-4">
          {t('settings.privacyLink')}
        </Link>
      </div>

      <p className="text-xs text-(--color-ink-muted)">{t('disclaimer.short')}</p>
    </main>
  )
}
