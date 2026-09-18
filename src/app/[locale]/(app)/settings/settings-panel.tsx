'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { signOut } from '@/app/[locale]/sign-in/actions'
import { deleteMyAccount, exportMyData, updateLocale, updateTimezone, updateUnits } from '@/lib/actions/account'

interface Props {
  locale: Locale
  units: 'metric' | 'imperial'
  timezone: string
  displayName: string
  /** True while the account has no email, so this session is the only key to it. */
  anonymous: boolean
}

export function SettingsPanel({ locale, units, timezone, displayName, anonymous }: Props) {
  const t = useTranslations('settings')
  const tLocale = useTranslations('locale')
  const tD = useTranslations('disclaimer')
  const router = useRouter()
  const pathname = usePathname()
  const [pending, start] = useTransition()
  const [tz, setTz] = useState(timezone)
  const [confirmDelete, setConfirmDelete] = useState('')
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const field = 'min-h-11 w-full rounded-lg border border-(--color-border) bg-(--color-surface) px-3'
  const row = 'flex flex-col gap-2 rounded-xl border border-(--color-border) bg-(--color-surface) p-4'

  const switchLocale = (next: Locale) => start(async () => { await updateLocale(next); router.replace(pathname, { locale: next }) })

  const download = () => start(async () => {
    const json = await exportMyData()
    if (!json) return
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'hyex-export.json'; a.click()
    URL.revokeObjectURL(url)
  })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-(--color-ink-muted)">{t('hello', { name: displayName })}</p>

      <section className={row}>
        <h2 className="font-display text-lg font-bold">{t('plan')}</h2>
        <p className="text-sm text-(--color-ink-muted)">{t('planHelp')}</p>
        <Link href="/onboarding" className="flex min-h-11 items-center justify-center rounded-lg bg-(--color-plate-blue) font-semibold text-white">{t('editAnswers')}</Link>
      </section>

      <section className={row}>
        <h2 className="font-display text-lg font-bold">{tLocale('switchLabel')}</h2>
        <div className="flex gap-2">
          {(['en', 'es'] as const).map((l) => <button key={l} type="button" disabled={pending} aria-pressed={locale === l} onClick={() => switchLocale(l)} className={`min-h-11 flex-1 rounded-lg border font-semibold ${locale === l ? 'border-(--color-plate-blue) bg-(--color-plate-blue) text-white' : 'border-(--color-border)'}`}>{tLocale(l)}</button>)}
        </div>
      </section>

      <section className={row}>
        <h2 className="font-display text-lg font-bold">{t('units')}</h2>
        <div className="flex gap-2">
          {(['metric', 'imperial'] as const).map((u) => <button key={u} type="button" disabled={pending} aria-pressed={units === u} onClick={() => start(async () => { await updateUnits(u); router.refresh() })} className={`min-h-11 flex-1 rounded-lg border font-semibold ${units === u ? 'border-(--color-plate-blue) bg-(--color-plate-blue) text-white' : 'border-(--color-border)'}`}>{t(u)}</button>)}
        </div>
      </section>

      <section className={row}>
        <label className="font-display text-lg font-bold" htmlFor="tz">{t('timezone')}</label>
        <div className="flex gap-2"><input id="tz" className={field} value={tz} onChange={(e) => setTz(e.target.value)} /><button type="button" disabled={pending} onClick={() => start(async () => { await updateTimezone(tz); router.refresh() })} className="min-h-11 rounded-lg bg-(--color-ink) px-4 font-semibold text-(--color-bg)">{t('save')}</button></div>
        <p className="text-xs text-(--color-ink-muted)">{t('timezoneHelp')}</p>
      </section>

      <section className={row}>
        <h2 className="font-display text-lg font-bold">{t('data')}</h2>
        <button type="button" disabled={pending} onClick={download} className="min-h-11 rounded-lg border border-(--color-border) font-semibold">{t('export')}</button>
        <Link href="/privacy" className="min-h-11 text-center text-sm text-(--color-plate-blue) underline-offset-2 hover:underline">{t('privacyLink')}</Link>
      </section>

      <section className={row}>
        <h2 className="font-display text-lg font-bold">{t('disclaimerTitle')}</h2>
        <p className="text-sm text-(--color-ink-muted)">{tD('long')}</p>
      </section>

      {/* On an account with no email there is no second way back in: the session
          cookie is the only key, so signing out is a delete in everything but
          name. It gets a gate of its own rather than sharing the plain button. */}
      <section className={anonymous ? `${row} border-(--color-plate-red)` : row}>
        {anonymous && (
          <>
            <h2 className="font-display text-lg font-bold text-(--color-plate-red)">{t('signOutAnonymousTitle')}</h2>
            <p className="text-sm text-(--color-ink-muted)">{t('signOutAnonymousHelp')}</p>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={confirmSignOut} onChange={(e) => setConfirmSignOut(e.target.checked)} className="mt-1 size-4" />
              <span>{t('signOutUnderstand')}</span>
            </label>
          </>
        )}
        <button type="button" disabled={pending || (anonymous && !confirmSignOut)} onClick={() => start(async () => { await signOut(locale) })} className={`min-h-11 rounded-lg border font-semibold disabled:opacity-40 ${anonymous ? 'border-(--color-plate-red) text-(--color-plate-red)' : 'border-(--color-border)'}`}>{t('signOut')}</button>
      </section>

      <section className={`${row} border-(--color-plate-red)`}>
        <h2 className="font-display text-lg font-bold text-(--color-plate-red)">{t('deleteTitle')}</h2>
        <p className="text-sm text-(--color-ink-muted)">{t('deleteHelp')}</p>
        <label className="text-sm" htmlFor="confirm">{t('deleteConfirmLabel')}</label>
        <input id="confirm" className={field} value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} autoComplete="off" />
        <button type="button" disabled={pending || confirmDelete !== t('deleteWord')} onClick={() => start(async () => { await deleteMyAccount(locale) })} className="min-h-11 rounded-lg bg-(--color-plate-red) font-semibold text-white disabled:opacity-40">{t('deleteButton')}</button>
      </section>
    </div>
  )
}
