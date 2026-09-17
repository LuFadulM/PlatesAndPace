import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/routing'

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('privacy')
  const sections = ['stored', 'visible', 'groups', 'export', 'delete', 'health'] as const
  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 px-4 py-8">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <p className="text-(--color-ink-muted)">{t('intro')}</p>
      {sections.map((s) => (
        <section key={s}>
          <h2 className="font-display text-xl font-bold">{t(`${s}.title`)}</h2>
          <p className="mt-1 text-sm">{t(`${s}.body`)}</p>
        </section>
      ))}
    </main>
  )
}
