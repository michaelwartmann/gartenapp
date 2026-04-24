'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getCurrentGardenId } from '@/lib/currentGarden'
import {
  recommendPlants,
  type CatalogItem,
  type IdeaFeedback,
  type QuestionnaireInput,
} from '@/lib/recommendPlants'
import type { Plant } from '@/lib/supabase'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export type SuggestionCardData = {
  plant: Plant
  reason: string
}

export type RecommendState =
  | {
      ok: true
      idea: IdeaFeedback
      suggestions: SuggestionCardData[]
      basis: {
        planted: string[]
        interested: string[]
      }
    }
  | { error: 'no-garden' | 'invalid' | 'server' }
  | undefined

const SUN_VALUES = ['sonnig', 'halbschattig', 'schattig'] as const
const SPACE_VALUES = ['klein', 'mittel', 'gross'] as const
const LIKE_VALUES = ['essbar', 'kraeuter', 'zierpflanze'] as const

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function getSuggestions(
  _prev: RecommendState,
  formData: FormData
): Promise<RecommendState> {
  const sun = String(formData.get('sun') ?? '').trim()
  const space = String(formData.get('space') ?? '').trim()
  const likes = formData.getAll('likes').map((v) => String(v).trim())
  const note = String(formData.get('note') ?? '').trim().slice(0, 600)

  if (!(SUN_VALUES as readonly string[]).includes(sun)) return { error: 'invalid' }
  if (!(SPACE_VALUES as readonly string[]).includes(space)) return { error: 'invalid' }
  const cleanLikes = likes.filter((l) =>
    (LIKE_VALUES as readonly string[]).includes(l)
  ) as QuestionnaireInput['likes']
  if (cleanLikes.length === 0) return { error: 'invalid' }

  const gardenId = await getCurrentGardenId()
  if (!gardenId) return { error: 'no-garden' }

  try {
    const supabase = adminClient()

    const [gardenRes, catalogRes] = await Promise.all([
      supabase
        .from('garden_plants')
        .select('planted_at, plants(id, name, category)')
        .eq('garden_id', gardenId),
      supabase
        .from('plants')
        .select(
          'id, name, latin_name, category, saatzeit, pflanzort, nachbarn, stark_oder_schwachzehrer, einjaehrig_oder_mehrjaehrig'
        ),
    ])

    if (gardenRes.error) {
      console.error('garden plants load failed:', gardenRes.error)
      return { error: 'server' }
    }
    if (catalogRes.error || !catalogRes.data) {
      console.error('catalog load failed:', catalogRes.error)
      return { error: 'server' }
    }

    const planted: Array<{ name: string; category: string }> = []
    const interested: Array<{ name: string }> = []
    type JoinedPlant = { id: string; name: string; category: string }
    for (const row of gardenRes.data ?? []) {
      const r = row as unknown as {
        planted_at: string | null
        plants: JoinedPlant | JoinedPlant[] | null
      }
      const joined = Array.isArray(r.plants)
        ? r.plants
        : r.plants
          ? [r.plants]
          : []
      for (const p of joined) {
        if (r.planted_at) {
          planted.push({ name: p.name, category: p.category })
        } else {
          interested.push({ name: p.name })
        }
      }
    }

    const catalog: CatalogItem[] = (catalogRes.data as CatalogItem[]).map(
      (p) => ({
        id: p.id,
        name: p.name,
        latin_name: p.latin_name ?? '',
        category: p.category ?? '',
        saatzeit: p.saatzeit ?? '',
        pflanzort: p.pflanzort ?? '',
        nachbarn: p.nachbarn ?? '',
        stark_oder_schwachzehrer: p.stark_oder_schwachzehrer ?? null,
        einjaehrig_oder_mehrjaehrig: p.einjaehrig_oder_mehrjaehrig ?? null,
      })
    )

    const result = await recommendPlants({
      questionnaire: {
        sun: sun as QuestionnaireInput['sun'],
        space: space as QuestionnaireInput['space'],
        likes: cleanLikes,
        note,
        todayISO: todayISO(),
      },
      planted,
      interested,
      catalog,
    })

    if (
      result.suggestions.length === 0 &&
      result.idea.verdict === 'none'
    ) {
      return { error: 'server' }
    }

    const suggestionIds = result.suggestions.map((s) => s.plant_id)
    const fullPlantsRes =
      suggestionIds.length > 0
        ? await supabase.from('plants').select('*').in('id', suggestionIds)
        : { data: [] as Plant[], error: null }
    if (fullPlantsRes.error) {
      console.error('full plants load failed:', fullPlantsRes.error)
      return { error: 'server' }
    }
    const plantById = new Map<string, Plant>(
      (fullPlantsRes.data as Plant[]).map((p) => [p.id, p])
    )

    const suggestions: SuggestionCardData[] = []
    for (const s of result.suggestions) {
      const plant = plantById.get(s.plant_id)
      if (!plant) continue
      suggestions.push({ plant, reason: s.reason })
    }

    return {
      ok: true,
      idea: result.idea,
      suggestions,
      basis: {
        planted: planted.map((p) => p.name),
        interested: interested.map((p) => p.name),
      },
    }
  } catch (err) {
    console.error('getSuggestions failed:', err)
    return { error: 'server' }
  }
}

export type AddResult =
  | { ok: true; gardenPlantId: string; alreadyIn: boolean }
  | { error: 'no-garden' | 'invalid' | 'server' }

export async function addAsInterested(plantId: string): Promise<AddResult> {
  if (!plantId) return { error: 'invalid' }
  const gardenId = await getCurrentGardenId()
  if (!gardenId) return { error: 'no-garden' }
  try {
    const supabase = adminClient()
    const { data: existing } = await supabase
      .from('garden_plants')
      .select('id')
      .eq('garden_id', gardenId)
      .eq('plant_id', plantId)
      .maybeSingle()
    if (existing) {
      return { ok: true, gardenPlantId: existing.id as string, alreadyIn: true }
    }
    const { data, error } = await supabase
      .from('garden_plants')
      .insert({ garden_id: gardenId, plant_id: plantId })
      .select('id')
      .single()
    if (error || !data) {
      console.error('addAsInterested insert failed:', error)
      return { error: 'server' }
    }
    revalidatePath('/')
    return { ok: true, gardenPlantId: data.id as string, alreadyIn: false }
  } catch (err) {
    console.error('addAsInterested threw:', err)
    return { error: 'server' }
  }
}
