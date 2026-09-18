'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { compareDates, fromISODate } from '@/domain/dates'
import { getAthleteToday } from '@/lib/data/profile'
import { createClient } from '@/lib/supabase/server'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/**
 * The bounds match the table's own checks. Whole numbers throughout: nobody
 * eats to a decigram, and integers keep a day's sum exact.
 */
const foodSchema = z.object({
  date: isoDate,
  name: z.string().trim().min(1).max(80),
  kcal: z.number().int().min(0).max(10_000),
  proteinG: z.number().int().min(0).max(1000).default(0),
  carbsG: z.number().int().min(0).max(1000).default(0),
  fatG: z.number().int().min(0).max(1000).default(0),
})

/** Logs what the athlete ate. Their words, their numbers: nothing is looked up. */
export async function logFood(input: unknown) {
  const parsed = foodSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const }
  const { date, name, kcal, proteinG, carbsG, fatG } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }

  // Food belongs to a day that has happened. A meal cannot be eaten in advance,
  // and the fuel card only ever reads today and earlier. "Today" is the zone the
  // athlete set in Settings, the same one the page used to decide what to show.
  const today = await getAthleteToday()
  if (today && compareDates(fromISODate(date), today) > 0) {
    return { ok: false as const }
  }

  const { error } = await supabase.from('food_logs').insert({
    user_id: user.id,
    date,
    name,
    kcal,
    protein_g: proteinG,
    carbs_g: carbsG,
    fat_g: fatG,
  })
  if (error) return { ok: false as const }

  revalidatePath('/', 'layout')
  return { ok: true as const }
}

export async function removeFood(input: unknown) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false as const }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }

  const { error } = await supabase.from('food_logs').delete().eq('id', parsed.data.id).eq('user_id', user.id)
  if (error) return { ok: false as const }

  revalidatePath('/', 'layout')
  return { ok: true as const }
}
