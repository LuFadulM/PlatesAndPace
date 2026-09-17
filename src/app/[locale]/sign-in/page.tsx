import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/routing'
import { SignInForm } from './sign-in-form'

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  setRequestLocale(locale)
  const { next, error } = await searchParams
  const t = await getTranslations('auth')

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-3xl font-bold">{t('signInTitle')}</h1>
      <p className="text-(--color-ink-muted)">{t('signInBody')}</p>

      {error ? (
        <p role="alert" className="text-sm text-(--color-plate-red)">
          {error === 'exchange_failed' ? t('errors.linkExpired') : t('errors.linkInvalid')}
        </p>
      ) : null}

      <SignInForm locale={locale} next={next} />
    </main>
  )
}
