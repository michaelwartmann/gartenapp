'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { getCurrentGardenId } from '@/lib/currentGarden'
import { enrichPlantWithGemini, FIELD_KEYS } from '@/lib/enrichPlant'
import { generateAndUploadKawaiiImage } from '@/lib/generateKawaiiImage'
import { classifyPlantCategories } from '@/lib/classifyPlantCategories'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

const CATEGORIES = [
  'Gemüse',
  'Kraut',
  'Blume',
  'Obst',
  'Baum',
  'Strauch',
  'Nuss',
] as const

export type CreateResult =
  | {
      ok: true
      plantId: string
      plantName: string
      category: string
      categories: string[]
      /**
       * Suitable bed kinds known *at submission time*. For freshly created
       * plants this is null — Gemini enrichment runs in the background. The
       * post-submit AssignBedSheet uses null to mean "show all beds neutrally".
       */
      suitableBedKinds: string[] | null
      deduped: boolean
    }
  | { error: 'no-garden' | 'invalid' | 'server' }

export async function createPlantAndAdd(
  _prev: CreateResult | null,
  formData: FormData
): Promise<CreateResult> {
  const name = String(formData.get('name') ?? '').trim()
  const latinName = String(formData.get('latin_name') ?? '').trim()
  const category = String(formData.get('category') ?? '').trim()
  const categoriesRaw = String(formData.get('categories') ?? '').trim()

  if (!name || name.length > 80) return { error: 'invalid' }
  if (latinName.length > 80) return { error: 'invalid' }
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    return { error: 'invalid' }
  }

  // Parse multi-cat list. Must contain primary, all values valid, dedupe.
  const validCats = CATEGORIES as readonly string[]
  const rawList = categoriesRaw
    ? categoriesRaw.split(',').map((c) => c.trim()).filter(Boolean)
    : []
  const seen = new Set<string>()
  const categories: string[] = []
  for (const c of rawList) {
    if (!validCats.includes(c)) continue
    if (seen.has(c)) continue
    seen.add(c)
    categories.push(c)
  }
  // Always ensure primary is in the array, at front.
  if (!categories.includes(category)) categories.unshift(category)
  if (categories.length === 0 || categories.length > 7) {
    return { error: 'invalid' }
  }

  const gardenId = await getCurrentGardenId()
  if (!gardenId) return { error: 'no-garden' }

  const supabase = adminClient()

  // Dedup: case-insensitive match on name; if multiple matches, prefer one
  // that also matches the (optional) user-provided latin name.
  const { data: matches } = await supabase
    .from('plants')
    .select('id, latin_name, suitable_bed_kinds, categories, category')
    .ilike('name', name)

  let existing: {
    id: string
    latin_name: string | null
    suitable_bed_kinds: string[] | null
    categories: string[] | null
    category: string
  } | null = null
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
  let suitableBedKinds: string[] | null = null
  // Effective categories returned in the result. For deduped plants we
  // honor the catalog truth (so other gardeners see consistent data); for
  // new plants we use the user's pick.
  let effectiveCategories: string[] = categories

  if (existing) {
    plantId = existing.id
    isNew = false
    suitableBedKinds = existing.suitable_bed_kinds
    effectiveCategories =
      existing.categories && existing.categories.length > 0
        ? existing.categories
        : [existing.category]
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('plants')
      .insert({
        name,
        latin_name: latinName,
        category,
        categories,
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
        const update: Record<string, string | string[]> = {}
        for (const key of FIELD_KEYS) {
          if (key === 'latin_name' && latinName) continue
          const value = enriched[key]
          if (value) update[key] = value
        }
        if (enriched.suitable_bed_kinds.length > 0) {
          update.suitable_bed_kinds = enriched.suitable_bed_kinds
        }
        // Stage 8.2: smart merge of Gemini's category suggestions with the
        // user's pick.
        //   - If there is ANY overlap → user's pick is meaningful, augment
        //     with Gemini's additional suggestions (cap 3, primary preserved).
        //   - If there is NO overlap → user picked something Gemini disagrees
        //     with completely (Kim's "Zitrone = Gemüse" case). Replace with
        //     Gemini's set so we don't end up with ['Gemüse', 'Obst', 'Baum'].
        // Either way, also update `category` (primary) so the colored display
        // pill matches the new primary.
        if (enriched.categories.length > 0) {
          const userSet = new Set(categories)
          const overlap = enriched.categories.some((c) => userSet.has(c))
          let final: string[]
          if (overlap) {
            final = [...categories]
            for (const c of enriched.categories) {
              if (final.length >= 3) break
              if (!final.includes(c)) final.push(c)
            }
          } else {
            final = enriched.categories.slice(0, 3)
          }
          const changed =
            final.length !== categories.length ||
            final.some((c, i) => c !== categories[i])
          if (changed) {
            update.categories = final
            if (final[0] && final[0] !== category) {
              update.category = final[0]
            }
          }
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

  return {
    ok: true,
    plantId,
    plantName: name,
    category: effectiveCategories[0] ?? category,
    categories: effectiveCategories,
    suitableBedKinds,
    deduped: !isNew,
  }
}

/**
 * Stage 8.2 — live category suggestion for the AddPlantForm.
 * Called debounced from the client as the user types name + latin name.
 * Returns null on any failure so the UI silently falls back to manual mode.
 */
export async function suggestCategoriesForPlant(
  name: string,
  latinName: string
): Promise<{ categories: string[] } | null> {
  const cleanName = (name ?? '').trim()
  const cleanLatin = (latinName ?? '').trim()
  if (!cleanName || cleanName.length < 2 || cleanName.length > 80) return null
  if (cleanLatin.length > 80) return null
  return classifyPlantCategories(cleanName, cleanLatin)
}
