import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/routing'
import { requireProfile } from '@/lib/data/profile'
import { getAccountIdentity } from '@/lib/data/account'
import { AccountCard } from '@/components/settings/account-card'
import { SettingsPanel } from './settings-panel'

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('settings')
  const [profile, identity] = await Promise.all([requireProfile(locale), getAccountIdentity()])
  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <AccountCard locale={locale} email={identity.email} anonymous={identity.anonymous} />
      <SettingsPanel locale={locale} units={profile.units as 'metric' | 'imperial'} timezone={profile.timezone} displayName={profile.display_name} />
    </main>
  )
}
