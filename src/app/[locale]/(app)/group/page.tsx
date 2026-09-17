import { headers } from 'next/headers'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { isLocale } from '@/i18n/routing'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { GroupPanel, type GroupView } from './group-panel'

export default async function GroupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations('group')
  const user = (await getCurrentUser())!
  const supabase = await createClient()

  const { data: memberships } = await supabase.from('group_members').select('group_id, role').eq('user_id', user.id)
  const groups: GroupView[] = []
  for (const m of memberships ?? []) {
    const [{ data: group }, { data: invite }, { data: summary }] = await Promise.all([
      supabase.from('groups').select('id, name, owner_id').eq('id', m.group_id).maybeSingle(),
      supabase.from('group_invites').select('code').eq('group_id', m.group_id).limit(1).maybeSingle(),
      supabase.rpc('group_weekly_summary', { p_group_id: m.group_id }),
    ])
    if (!group) continue
    groups.push({
      id: group.id,
      name: group.name,
      isOwner: group.owner_id === user.id,
      code: invite?.code ?? null,
      members: (summary ?? []).map((s) => ({ id: s.member_id, displayName: s.display_name, sessions: s.sessions_done_this_week, streak: s.streak_days })),
    })
  }
  const host = (await headers()).get('host') ?? 'localhost:3000'
  const origin = `${host.startsWith('localhost') ? 'http' : 'https'}://${host}/${locale}`

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-3xl font-bold">{t('title')}</h1>
      <GroupPanel groups={groups} selfId={user.id} origin={origin} />
    </main>
  )
}
