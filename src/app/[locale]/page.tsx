import { getTranslations, setRequestLocale } from 'next-intl/server'

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-12">
      <p className="text-sm font-medium tracking-wide text-(--color-plate-blue) uppercase">
        {t('app.name')}
      </p>
      <h1 className="text-4xl leading-tight font-bold">{t('landing.headline')}</h1>
      <p className="text-(--color-ink-muted)">{t('landing.body')}</p>
      <p className="text-xs text-(--color-ink-muted)">{t('disclaimer.short')}</p>
    </main>
  )
}
