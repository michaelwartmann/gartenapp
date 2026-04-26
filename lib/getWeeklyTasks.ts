import { createClient } from '@supabase/supabase-js'
import {
  recommendTasks,
  type PlantedPlantInput,
  type WeeklyTasksResult,
} from '@/lib/weeklyTasks'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function getWeeklyTasks(
  gardenId: string,
  planted: PlantedPlantInput[]
): Promise<WeeklyTasksResult> {
  if (planted.length === 0) return { tasks: [] }

  const today = todayISO()
  const admin = adminClient()

  const { data: garden } = await admin
    .from('gardens')
    .select('weekly_tasks_cache, weekly_tasks_cache_date')
    .eq('id', gardenId)
    .maybeSingle()

  if (
    garden?.weekly_tasks_cache_date === today &&
    garden.weekly_tasks_cache &&
    typeof garden.weekly_tasks_cache === 'object'
  ) {
    return garden.weekly_tasks_cache as WeeklyTasksResult
  }

  let result: WeeklyTasksResult
  try {
    result = await recommendTasks({ todayISO: today, planted })
  } catch (e) {
    console.error('weeklyTasks Gemini failed:', e)
    return { tasks: [] }
  }

  const { error: updateError } = await admin
    .from('gardens')
    .update({
      weekly_tasks_cache: result,
      weekly_tasks_cache_date: today,
    })
    .eq('id', gardenId)

  if (updateError) {
    console.error('weeklyTasks cache write failed:', updateError)
  }

  return result
}
