import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/routing'
import { buildLibraryEntries } from '@/lib/data/catalogue'
import { LibraryBrowser } from './library-browser'

export default async function LibraryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('library')
  const entries = buildLibraryEntries(locale)
  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <LibraryBrowser entries={entries} />
    </main>
  )
}
