import { createClient } from '@/lib/supabase/server'

export interface AccountIdentity {
  /** The address on the account, when there is one. */
  email: string | null
  /**
   * True while the account has no email. Supabase marks these users
   * `is_anonymous`; the flag is absent on older sessions, so an account with
   * no address is treated as anonymous either way.
   */
  anonymous: boolean
}

/** Who the session belongs to, and whether it can be recovered on another device. */
export async function getAccountIdentity(): Promise<AccountIdentity> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { email: null, anonymous: false }
  const email = user.email ?? null
  const flagged = (user as { is_anonymous?: boolean }).is_anonymous
  return { email, anonymous: flagged ?? email === null }
}
