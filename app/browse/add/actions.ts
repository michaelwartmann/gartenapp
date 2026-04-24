'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { getCurrentGardenId } from '@/lib/currentGarden'
import { enrichPlantWithGemini, FIELD_KEYS } from '@/lib/enrichPlant'
import { generateAndUploadKawaiiImage } from '@/lib/generateKawaiiImage'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

const CATEGORIES = ['Gemüse', 'Kraut', 'Blume', 'Obst'] as const

export type CreateResult =
  | { ok: true; plantId: string; deduped: boolean }
  | { error: 'no-garden' | 'invalid' | 'server' }

export async function createPlantAndAdd(
  _prev: CreateResult | null,
  formData: FormData
): Promise<CreateResult> {
  const name = String(formData.get('name') ?? '').trim()
  const latinName = String(formData.get('latin_name') ?? '').trim()
  const category = String(formData.get('category') ?? '').trim()

  if (!name || name.length > 80) return { error: 'invalid' }
  if (latinName.length > 80) return { error: 'invalid' }
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    return { error: 'invalid' }
  }

  const gardenId = await getCurrentGardenId()
  if (!gardenId) return { error: 'no-garden' }

  const supabase = adminClient()

  // Dedup: case-insensitive match on name; if multiple matches, prefer one
  // that also matches the (optional) user-provided latin name.
  const { data: matches } = await supabase
    .from('plants')
    .select('id, latin_name')
    .ilike('name', name)

  let existing: { id: string; latin_name: string | null } | null = null
  if (matches && matches.length > 0) {
    if (latinName) {
      existing =
        matches.find(
          (r) => (r.latin_name ?? '').toLowerCase() === latinName.toLowerCase()
        ) ?? matches[0]
    } else {
      existing = matches[0]
    }
  }

  let plantId: string
  let isNew: boolean

  if (existing) {
    plantId = existing.id
    isNew = false
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('plants')
      .insert({
        name,
        latin_name: latinName,
        category,
      })
      .select('id')
      .single()
    if (insertError || !inserted) {
      console.error('plant insert failed:', insertError)
      return { error: 'server' }
    }
    plantId = inserted.id
    isNew = true
  }

  // Add to current garden (idempotent — duplicate key errors are swallowed).
  const { error: gpError } = await supabase
    .from('garden_plants')
    .insert({ garden_id: gardenId, plant_id: plantId })
  if (gpError && !gpError.message.includes('duplicate')) {
    console.error('garden_plants insert failed:', gpError)
    return { error: 'server' }
  }

  if (isNew) {
    after(async () => {
      const bgSupabase = adminClient()
      try {
        const enriched = await enrichPlantWithGemini({
          name,
          latin_name: latinName || undefined,
          category,
        })
        const update: Record<string, string> = {}
        for (const key of FIELD_KEYS) {
          if (key === 'latin_name' && latinName) continue
          const value = enriched[key]
          if (value) update[key] = value
        }
        if (Object.keys(update).length > 0) {
          const { error: updErr } = await bgSupabase
            .from('plants')
            .update(update)
            .eq('id', plantId)
          if (updErr) console.error('enrich update failed:', updErr)
        }
      } catch (err) {
        console.error('enrichment failed:', err)
      }

      try {
        const { data: fresh } = await bgSupabase
          .from('plants')
          .select('latin_name')
          .eq('id', plantId)
          .maybeSingle()
        const finalLatin = fresh?.latin_name ?? latinName
        const url = await generateAndUploadKawaiiImage(plantId, name, finalLatin)
        const { error: imgErr } = await bgSupabase
          .from('plants')
          .update({ illustration_url: url })
          .eq('id', plantId)
        if (imgErr) console.error('image update failed:', imgErr)
      } catch (err) {
        console.error('image generation failed:', err)
      }

      revalidatePath('/')
      revalidatePath('/browse')
      revalidatePath(`/plants/${plantId}`)
    })
  }

  revalidatePath('/')
  revalidatePath('/browse')

  return { ok: true, plantId, deduped: !isNew }
}
