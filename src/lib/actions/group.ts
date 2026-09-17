'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export async function createGroup(name: string) {
  const parsed = z.string().trim().min(1).max(60).safeParse(name)
  if (!parsed.success) return { ok: false as const, errorKey: 'group.errors.name' }
  const supabase = await createClient()
  // One RPC creates the group, the owner's membership and the first invite
  // atomically; see the migration for why plain inserts cannot.
  const { error } = await supabase.rpc('create_group', { p_name: parsed.data })
  if (error) return { ok: false as const, errorKey: 'group.errors.create' }
  revalidatePath('/', 'layout')
  return { ok: true as const }
}

export async function joinGroup(code: string) {
  const parsed = z.string().trim().length(6).safeParse(code)
  if (!parsed.success) return { ok: false as const, errorKey: 'group.errors.code' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('join_group_with_code', { p_code: parsed.data.toUpperCase() })
  if (error) return { ok: false as const, errorKey: 'group.errors.code' }
  revalidatePath('/', 'layout')
  return { ok: true as const }
}

export async function leaveGroup(groupId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }
  await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', user.id)
  revalidatePath('/', 'layout')
  return { ok: true as const }
}

export async function removeMember(groupId: string, memberId: string) {
  const supabase = await createClient()
  // RLS only lets the owner delete another member's row.
  await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', memberId)
  revalidatePath('/', 'layout')
  return { ok: true as const }
}

export async function setShareDetails(groupId: string, share: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }
  await supabase.from('group_members').update({ share_details: share }).eq('group_id', groupId).eq('user_id', user.id)
  revalidatePath('/', 'layout')
  return { ok: true as const }
}
