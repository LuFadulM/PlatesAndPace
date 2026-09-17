'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { createGroup, joinGroup, leaveGroup, removeMember } from '@/lib/actions/group'

export interface GroupView {
  id: string
  name: string
  isOwner: boolean
  code: string | null
  members: { id: string; displayName: string; sessions: number; streak: number }[]
}

export function GroupPanel({ groups, selfId, origin }: { groups: GroupView[]; selfId: string; origin: string }) {
  const t = useTranslations('group')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const field = 'min-h-11 w-full rounded-lg border border-(--color-border) bg-(--color-surface) px-3'

  const run = (fn: () => Promise<{ ok: boolean; errorKey?: string }>) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) setError(r.errorKey ?? 'group.errors.create')
    })

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.id} className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-2xl font-bold">{g.name}</h2>
            <button type="button" disabled={pending} onClick={() => run(() => leaveGroup(g.id))} className="min-h-11 rounded-lg px-3 text-sm text-(--color-ink-muted)">{t('leave')}</button>
          </div>
          {g.code && (
            <div className="mt-2 rounded-lg bg-(--color-surface-2) p-3 text-sm">
              <p className="text-xs uppercase text-(--color-ink-muted)">{t('inviteCode')}</p>
              <p className="font-display text-2xl font-bold tracking-[0.3em]">{g.code}</p>
              <button type="button" onClick={() => navigator.clipboard?.writeText(`${origin}/join/${g.code}`)} className="mt-1 min-h-11 text-(--color-plate-blue) underline-offset-2 hover:underline">{t('copyLink')}</button>
            </div>
          )}
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase text-(--color-ink-muted)"><tr><th scope="col" className="py-1">{t('member')}</th><th scope="col" className="text-right">{t('thisWeek')}</th><th scope="col" className="text-right">{t('streak')}</th>{g.isOwner && <th scope="col"><span className="sr-only">{t('remove')}</span></th>}</tr></thead>
            <tbody>
              {g.members.map((m) => (
                <tr key={m.id} className="border-t border-(--color-border)">
                  <td className="py-2 font-semibold">{m.displayName}{m.id === selfId ? ` (${t('you')})` : ''}</td>
                  <td className="py-2 text-right tabular-nums">{m.sessions}</td>
                  <td className="py-2 text-right tabular-nums">{m.streak}</td>
                  {g.isOwner && <td className="py-2 text-right">{m.id !== selfId && <button type="button" disabled={pending} onClick={() => run(() => removeMember(g.id, m.id))} className="min-h-11 px-2 text-xs text-(--color-plate-red)">{t('remove')}</button>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-(--color-ink-muted)">{t('privacy')}</p>
        </section>
      ))}

      <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); run(() => createGroup(name)) }}>
        <label className="text-sm font-medium" htmlFor="group-name">{t('createTitle')}</label>
        <div className="flex gap-2"><input id="group-name" className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required /><button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-(--color-plate-blue) px-4 font-semibold text-white">{t('create')}</button></div>
      </form>
      <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); run(() => joinGroup(code)) }}>
        <label className="text-sm font-medium" htmlFor="group-code">{t('joinTitle')}</label>
        <div className="flex gap-2"><input id="group-code" className={`${field} uppercase tracking-widest`} value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} minLength={6} required autoCapitalize="characters" /><button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-(--color-ink) px-4 font-semibold text-(--color-bg)">{t('join')}</button></div>
      </form>
      {error && <p role="alert" className="text-sm text-(--color-plate-red)">{t(error.replace('group.', ''))}</p>}
    </div>
  )
}
