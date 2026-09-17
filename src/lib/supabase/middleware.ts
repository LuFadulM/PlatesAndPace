import { createServerClient } from '@supabase/ssr'
import type { NextRequest, NextResponse } from 'next/server'
import { supabaseEnv } from './env'

/**
 * Refreshes the auth session on an existing response.
 *
 * It writes onto a response the caller already has rather than making its own,
 * so the next-intl middleware can own routing and this can own auth without
 * either discarding the other's cookies or headers.
 */
export async function refreshSession(
  request: NextRequest,
  response: NextResponse,
): Promise<{ isSignedIn: boolean }> {
  const { url, anonKey } = supabaseEnv()

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // getUser, not getSession: it revalidates the token with Supabase rather than
  // trusting a cookie the browser could have been handed by anyone.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { isSignedIn: user !== null }
}
