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

/**
 * Where Hyex's own data lives, as a fallback when nothing is configured.
 *
 * Both values are public by design. The URL is a hostname, and the anon key is
 * a token that ships inside the JavaScript every visitor downloads — it grants
 * nothing on its own, because row level security decides what any request may
 * read or write. Supabase publishes them for exactly this reason.
 *
 * They are here because the alternative turned out to be worse. These were
 * injected by the Supabase–Vercel integration, which meant they could vanish
 * from the deployment without anyone editing them: disconnecting or changing
 * the integration removed both, and every page that touches the database threw
 * "Supabase is not configured" until someone noticed. A hostname that lives in
 * the repository cannot be lost that way.
 *
 * An environment variable still wins where one is set, so a local stack or a
 * different project needs no change here.
 */
const DEFAULT_URL = 'https://msumpyjjvjvkrwljfupx.supabase.co'
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zdW1weWpqdmp2a3J3bGpmdXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NjA4NjEsImV4cCI6MjA4OTUzNjg2MX0.w012AMV1u8pKb_-uCxlpIbqDllTb9YUPAPyFO_dVFiU'

function configured(): SupabaseEnv {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY,
  }
}

/** Always true now that there is a default: kept so callers read the same. */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = configured()
  return Boolean(url && anonKey)
}

export function supabaseEnv(): SupabaseEnv {
  return configured()
}
