import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'
import { supabaseEnv } from './env'

/** Supabase client for Client Components. Safe to call repeatedly. */
export function createClient() {
  const { url, anonKey } = supabaseEnv()
  return createBrowserClient<Database>(url, anonKey)
}
