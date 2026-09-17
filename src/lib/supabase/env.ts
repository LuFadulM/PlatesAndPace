/**
 * Supabase connection details.
 *
 * Read lazily rather than at module load: the marketing routes prerender at
 * build time, and a throw during import would fail the build on a machine that
 * has no Supabase credentials — including CI, which has none by design.
 */
export interface SupabaseEnv {
  url: string
  anonKey: string
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function supabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY — see .env.example.',
    )
  }

  return { url, anonKey }
}
