import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseEnv } from './env'

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 *
 * Every query made through it runs as the signed-in user, so RLS — not
 * application code — decides what comes back.
 */
export async function createClient() {
  const { url, anonKey } = supabaseEnv()
  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components cannot set cookies. The middleware refreshes the
          // session on every request, so ignoring this is safe.
        }
      },
    },
  })
}

/** The signed-in user, or null. Never throws when Supabase is unconfigured. */
export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
