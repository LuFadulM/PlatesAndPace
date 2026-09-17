import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/routing'
import { getProfile } from '@/lib/data/profile'
import { SettingsPanel } from './settings-panel'

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('settings')
  const profile = (await getProfile())!
  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <SettingsPanel locale={locale} units={profile.units as 'metric' | 'imperial'} timezone={profile.timezone} displayName={profile.display_name} />
    </main>
  )
}
