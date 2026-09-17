import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'
import { ANON_KEY, SUPABASE_URL, admin, createUser, hasSupabase, unique } from './helpers'

test.skip(!hasSupabase, 'needs a local Supabase stack')

test('a user cannot read another user\'s logs, even through the API directly', async () => {
  const a = await createUser(unique('a'))
  const b = await createUser(unique('b'))
  await admin().from('profiles').insert([
    { user_id: a.id, display_name: 'A', timezone: 'America/Bogota' },
    { user_id: b.id, display_name: 'B', timezone: 'America/Bogota' },
  ])
  const { data: log } = await admin().from('session_logs').insert({ user_id: a.id, date: '2026-09-15', done: true }).select('id').single()
  await admin().from('set_logs').insert({ user_id: a.id, session_log_id: log!.id, exercise_id: 'back_squat', set_index: 0, kg: 100, reps: 5, rpe: 8, done: true })

  // Sign in as B with the anon key and ask for everything.
  const { data: link } = await admin().auth.admin.generateLink({ type: 'magiclink', email: b.email! })
  const asB = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  await asB.auth.verifyOtp({ token_hash: link!.properties.hashed_token, type: 'magiclink' })

  const { data: sets } = await asB.from('set_logs').select('*')
  const { data: logs } = await asB.from('session_logs').select('*')
  const { data: profiles } = await asB.from('profiles').select('*')
  expect(sets).toEqual([])
  expect(logs).toEqual([])
  expect(profiles?.map((p) => p.user_id)).toEqual([b.id])
})
