'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getCurrentGardenId } from '@/lib/currentGarden'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export type PlantedActionResult =
  | { ok: true; plantedAt: string | null }
  | { error: 'no-garden' | 'not-in-garden' | 'invalid' | 'server' }

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type EnsureOwnResult =
  | { error: 'no-garden' | 'not-in-garden' }
  | {
      supabase: ReturnType<typeof adminClient>
      gardenId: string
      gardenPlantId: string
      plantId: string
    }

async function ensureOwn(gardenPlantId: string): Promise<EnsureOwnResult> {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) return { error: 'no-garden' }
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('garden_plants')
    .select('id, garden_id, plant_id')
    .eq('id', gardenPlantId)
    .maybeSingle()
  if (error || !data) return { error: 'not-in-garden' }
  if (data.garden_id !== gardenId) return { error: 'not-in-garden' }
  return {
    supabase,
    gardenId,
    gardenPlantId: data.id as string,
    plantId: data.plant_id as string,
  }
}

async function clearWeeklyTasksCache(
  supabase: ReturnType<typeof adminClient>,
  gardenId: string
): Promise<void> {
  const { error } = await supabase
    .from('gardens')
    .update({ weekly_tasks_cache: null, weekly_tasks_cache_date: null })
    .eq('id', gardenId)
  if (error) {
    console.error('clearWeeklyTasksCache failed:', error)
  }
}

export async function markAsPlanted(
  gardenPlantId: string
): Promise<PlantedActionResult> {
  try {
    const own = await ensureOwn(gardenPlantId)
    if ('error' in own) return { error: own.error }
    const date = todayISO()
    const { error } = await own.supabase
      .from('garden_plants')
      .update({ planted_at: date })
      .eq('id', own.gardenPlantId)
    if (error) {
      console.error('markAsPlanted failed:', error)
      return { error: 'server' }
    }
    await clearWeeklyTasksCache(own.supabase, own.gardenId)
    revalidatePath('/')
    revalidatePath(`/plants/${own.plantId}`)
    return { ok: true, plantedAt: date }
  } catch (err) {
    console.error('markAsPlanted threw:', err)
    return { error: 'server' }
  }
}

export async function updatePlantedDate(
  gardenPlantId: string,
  dateISO: string
): Promise<PlantedActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return { error: 'invalid' }
  try {
    const own = await ensureOwn(gardenPlantId)
    if ('error' in own) return { error: own.error }
    const { error } = await own.supabase
      .from('garden_plants')
      .update({ planted_at: dateISO })
      .eq('id', own.gardenPlantId)
    if (error) {
      console.error('updatePlantedDate failed:', error)
      return { error: 'server' }
    }
    await clearWeeklyTasksCache(own.supabase, own.gardenId)
    revalidatePath('/')
    revalidatePath(`/plants/${own.plantId}`)
    return { ok: true, plantedAt: dateISO }
  } catch (err) {
    console.error('updatePlantedDate threw:', err)
    return { error: 'server' }
  }
}

export async function markAsNotPlanted(
  gardenPlantId: string
): Promise<PlantedActionResult> {
  try {
    const own = await ensureOwn(gardenPlantId)
    if ('error' in own) return { error: own.error }
    const { error } = await own.supabase
      .from('garden_plants')
      .update({ planted_at: null })
      .eq('id', own.gardenPlantId)
    if (error) {
      console.error('markAsNotPlanted failed:', error)
      return { error: 'server' }
    }
    await clearWeeklyTasksCache(own.supabase, own.gardenId)
    revalidatePath('/')
    revalidatePath(`/plants/${own.plantId}`)
    return { ok: true, plantedAt: null }
  } catch (err) {
    console.error('markAsNotPlanted threw:', err)
    return { error: 'server' }
  }
}
