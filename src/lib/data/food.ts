import { createClient } from '@/lib/supabase/server'
import { addDays, toISODate, type PlainDate } from '@/domain/dates'
import { frequentFoods, type FoodEntry, type FrequentFood } from '@/domain/nutrition'

function toEntry(row: { id: string; name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }): FoodEntry {
  return { id: row.id, name: row.name, kcal: row.kcal, proteinG: row.protein_g, carbsG: row.carbs_g, fatG: row.fat_g }
}

/** Everything logged on one day, in the order it was eaten. */
export async function getFoodLog(date: string): Promise<FoodEntry[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('food_logs')
    .select('id, name, kcal, protein_g, carbs_g, fat_g')
    .eq('user_id', user.id)
    .eq('date', date)
    .order('logged_at')
  return (data ?? []).map(toEntry)
}

/**
 * The athlete's own most-used entries, for one-tap repeats. Read over a window
 * rather than all time so a food they have stopped eating stops being offered.
 *
 * The cap is there so a heavy logger cannot drag a page load; it has to take the
 * newest rows, not the oldest, or someone who logs six times a day would spend
 * the whole budget on the far end of the window and be offered chips from a
 * month ago. The rows come back newest first for that reason and are reversed
 * here, because `frequentFoods` reads oldest first.
 */
export async function getFrequentFoods(today: PlainDate, days = 30): Promise<FrequentFood[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('food_logs')
    .select('id, name, kcal, protein_g, carbs_g, fat_g')
    .eq('user_id', user.id)
    .gte('date', toISODate(addDays(today, -days)))
    .lte('date', toISODate(today))
    .order('logged_at', { ascending: false })
    .limit(500)
  return frequentFoods((data ?? []).reverse().map(toEntry))
}
