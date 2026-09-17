import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/routing'

export default async function CheckEmailPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  setRequestLocale(locale)
  const t = await getTranslations('auth')

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 py-12">
      <h1 className="text-3xl font-bold">{t('checkEmailTitle')}</h1>
      <p className="text-(--color-ink-muted)">{t('checkEmailBody')}</p>
      <p className="text-sm text-(--color-ink-muted)">{t('checkEmailSpam')}</p>
    </main>
  )
}
