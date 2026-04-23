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

export async function addToGarden(plantId: string) {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) return { error: 'no-garden' as const }

  const supabase = adminClient()
  const { error } = await supabase
    .from('garden_plants')
    .insert({ garden_id: gardenId, plant_id: plantId })

  if (error && !error.message.includes('duplicate')) {
    console.error('addToGarden failed:', error)
    return { error: 'server' as const }
  }

  revalidatePath('/')
  revalidatePath('/browse')
  return { ok: true as const }
}

export async function removeFromGarden(plantId: string) {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) return { error: 'no-garden' as const }

  const supabase = adminClient()
  const { error } = await supabase
    .from('garden_plants')
    .delete()
    .eq('garden_id', gardenId)
    .eq('plant_id', plantId)

  if (error) {
    console.error('removeFromGarden failed:', error)
    return { error: 'server' as const }
  }

  revalidatePath('/')
  revalidatePath('/browse')
  return { ok: true as const }
}
