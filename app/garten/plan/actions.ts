'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getCurrentGardenId } from '@/lib/currentGarden'
import {
  recommendRotation,
  type RotationAdvice,
  type RotationHistoryEntry,
  type RotationCurrentEntry,
} from '@/lib/recommendRotation'
import type { Bed, BedKind, BedShape, Plant } from '@/lib/supabase'
import { VALID_BED_KINDS } from '@/lib/bedKinds'
import { isValidBackgroundKey } from '@/lib/canvasBackgrounds'

const VALID_BED_SHAPES: BedShape[] = ['rect', 'ellipse']

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function currentYear(): number {
  return new Date().getFullYear()
}

export type PlantingWithPlant = {
  id: string
  bed_id: string
  plant_id: string
  season_year: number
  planted_at: string | null
  removed_at: string | null
  plant_name: string
  plant_category: string
  plant_illustration_url: string | null
  plant_family: string | null
  plant_stark_oder_schwachzehrer: string | null
}

export type BedView = {
  bed: Bed
  current: PlantingWithPlant[]
  lastYear: PlantingWithPlant[]
}

export async function listBedsForGarden(): Promise<BedView[]> {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) return []
  const supabase = adminClient()

  const { data: beds, error: bedsError } = await supabase
    .from('beds')
    .select('*')
    .eq('garden_id', gardenId)
    .order('created_at', { ascending: true })
  if (bedsError) {
    console.error('listBedsForGarden beds query failed:', bedsError)
    return []
  }
  const bedRows = (beds ?? []) as Bed[]
  if (bedRows.length === 0) return []

  const bedIds = bedRows.map((b) => b.id)
  const yearNow = currentYear()
  const lastYear = yearNow - 1
  const { data: plantings, error: pError } = await supabase
    .from('bed_plantings')
    .select(
      'id, bed_id, plant_id, season_year, planted_at, removed_at, plants(name, category, illustration_url, family, stark_oder_schwachzehrer)'
    )
    .in('bed_id', bedIds)
    .gte('season_year', lastYear)
    .lte('season_year', yearNow)
    .order('created_at', { ascending: true })
  if (pError) {
    console.error('listBedsForGarden plantings query failed:', pError)
  }

  type PRow = {
    id: string
    bed_id: string
    plant_id: string
    season_year: number
    planted_at: string | null
    removed_at: string | null
    plants: {
      name: string
      category: string
      illustration_url: string | null
      family: string | null
      stark_oder_schwachzehrer: string | null
    } | Array<{
      name: string
      category: string
      illustration_url: string | null
      family: string | null
      stark_oder_schwachzehrer: string | null
    }> | null
  }

  const flat: PlantingWithPlant[] = []
  for (const row of (plantings ?? []) as PRow[]) {
    const p = Array.isArray(row.plants) ? row.plants[0] : row.plants
    if (!p) continue
    flat.push({
      id: row.id,
      bed_id: row.bed_id,
      plant_id: row.plant_id,
      season_year: row.season_year,
      planted_at: row.planted_at,
      removed_at: row.removed_at,
      plant_name: p.name,
      plant_category: p.category,
      plant_illustration_url: p.illustration_url,
      plant_family: p.family,
      plant_stark_oder_schwachzehrer: p.stark_oder_schwachzehrer,
    })
  }

  const views: BedView[] = bedRows.map((bed) => {
    const mine = flat.filter((p) => p.bed_id === bed.id)
    return {
      bed,
      current: mine.filter((p) => p.season_year === yearNow),
      lastYear: mine.filter((p) => p.season_year === lastYear),
    }
  })
  return views
}

type EnsureBedResult =
  | { error: 'no-garden' | 'not-found' }
  | { supabase: ReturnType<typeof adminClient>; gardenId: string; bed: Bed }

async function ensureOwnBed(bedId: string): Promise<EnsureBedResult> {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) return { error: 'no-garden' }
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('beds')
    .select('*')
    .eq('id', bedId)
    .maybeSingle()
  if (error || !data) return { error: 'not-found' }
  if ((data as Bed).garden_id !== gardenId) return { error: 'not-found' }
  return { supabase, gardenId, bed: data as Bed }
}

export type CreateBedResult =
  | { ok: true; bed: Bed }
  | { error: 'no-garden' | 'invalid' | 'server' }

export async function createBed(
  label: string,
  kind: string
): Promise<CreateBedResult> {
  const cleanLabel = label.trim()
  if (!cleanLabel || cleanLabel.length > 60) return { error: 'invalid' }
  if (!VALID_BED_KINDS.includes(kind as BedKind)) return { error: 'invalid' }
  const gardenId = await getCurrentGardenId()
  if (!gardenId) return { error: 'no-garden' }
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('beds')
    .insert({ garden_id: gardenId, label: cleanLabel, kind })
    .select('*')
    .single()
  if (error || !data) {
    console.error('createBed failed:', error)
    return { error: 'server' }
  }
  revalidatePath('/garten/plan')
  return { ok: true, bed: data as Bed }
}

export type UpdateBedResult =
  | { ok: true }
  | { error: 'no-garden' | 'not-found' | 'invalid' | 'server' }

export async function updateBed(
  bedId: string,
  label: string,
  kind: string
): Promise<UpdateBedResult> {
  const cleanLabel = label.trim()
  if (!cleanLabel || cleanLabel.length > 60) return { error: 'invalid' }
  if (!VALID_BED_KINDS.includes(kind as BedKind)) return { error: 'invalid' }
  const own = await ensureOwnBed(bedId)
  if ('error' in own) return { error: own.error }
  const { error } = await own.supabase
    .from('beds')
    .update({ label: cleanLabel, kind })
    .eq('id', bedId)
  if (error) {
    console.error('updateBed failed:', error)
    return { error: 'server' }
  }
  revalidatePath('/garten/plan')
  revalidatePath('/')
  return { ok: true }
}

export type BedLayoutUpdate = {
  id: string
  x: number
  y: number
  w: number
  h: number
  shape?: BedShape | null
  rotation?: number
}

export type UpdateBedLayoutResult =
  | { ok: true; updated: number }
  | { error: 'no-garden' | 'invalid' | 'server' }

const LAYOUT_MIN = 40
const LAYOUT_CANVAS_W = 480
const LAYOUT_CANVAS_H = 720

function normalizeRotationServer(deg: number): number {
  if (!Number.isFinite(deg)) return 0
  let r = deg % 360
  if (r < 0) r += 360
  return r
}

/**
 * Stage 5B — batched persistence of x/y/w/h (+ Stage 5B.1 shape/rotation)
 * for all dirty beds. Validates each id belongs to the current garden in
 * one query, then updates row by row inside the same garden_id guard.
 * Numbers are clamped to canvas bounds server-side as defense in depth.
 */
export async function updateBedLayout(
  updates: BedLayoutUpdate[]
): Promise<UpdateBedLayoutResult> {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) return { error: 'no-garden' }
  if (!Array.isArray(updates) || updates.length === 0) {
    return { ok: true, updated: 0 }
  }
  if (updates.length > 200) return { error: 'invalid' }

  type Sanitized = {
    id: string
    x: number
    y: number
    w: number
    h: number
    shape: BedShape | null
    rotation: number
  }
  const sanitized: Sanitized[] = []
  for (const u of updates) {
    if (typeof u?.id !== 'string' || u.id.length === 0) return { error: 'invalid' }
    if (
      !Number.isFinite(u.x) ||
      !Number.isFinite(u.y) ||
      !Number.isFinite(u.w) ||
      !Number.isFinite(u.h)
    ) {
      return { error: 'invalid' }
    }
    const w = Math.max(LAYOUT_MIN, Math.min(LAYOUT_CANVAS_W, u.w))
    const h = Math.max(LAYOUT_MIN, Math.min(LAYOUT_CANVAS_H, u.h))
    const x = Math.max(0, Math.min(LAYOUT_CANVAS_W - w, u.x))
    const y = Math.max(0, Math.min(LAYOUT_CANVAS_H - h, u.y))
    let shape: BedShape | null = null
    if (u.shape !== undefined && u.shape !== null) {
      if (!VALID_BED_SHAPES.includes(u.shape)) return { error: 'invalid' }
      shape = u.shape
    }
    const rotation = normalizeRotationServer(u.rotation ?? 0)
    sanitized.push({ id: u.id, x, y, w, h, shape, rotation })
  }

  const supabase = adminClient()
  const ids = sanitized.map((u) => u.id)
  const { data: ownedRows, error: ownErr } = await supabase
    .from('beds')
    .select('id')
    .eq('garden_id', gardenId)
    .in('id', ids)
  if (ownErr) {
    console.error('updateBedLayout ownership query failed:', ownErr)
    return { error: 'server' }
  }
  const ownedIds = new Set(((ownedRows ?? []) as { id: string }[]).map((r) => r.id))
  if (ownedIds.size !== ids.length) return { error: 'invalid' }

  const results = await Promise.all(
    sanitized.map((u) =>
      supabase
        .from('beds')
        .update({
          x: u.x,
          y: u.y,
          w: u.w,
          h: u.h,
          shape: u.shape,
          rotation: u.rotation,
        })
        .eq('id', u.id)
        .eq('garden_id', gardenId)
    )
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) {
    console.error('updateBedLayout row update failed:', failed.error)
    return { error: 'server' }
  }
  revalidatePath('/garten/plan/editor')
  revalidatePath('/garten/plan')
  return { ok: true, updated: sanitized.length }
}

export type DeleteBedResult =
  | { ok: true }
  | { error: 'no-garden' | 'not-found' | 'server' }

export async function deleteBed(bedId: string): Promise<DeleteBedResult> {
  const own = await ensureOwnBed(bedId)
  if ('error' in own) return { error: own.error }
  const { error } = await own.supabase.from('beds').delete().eq('id', bedId)
  if (error) {
    console.error('deleteBed failed:', error)
    return { error: 'server' }
  }
  revalidatePath('/garten/plan')
  return { ok: true }
}

async function loadCandidateAndContext(
  supabase: ReturnType<typeof adminClient>,
  bedId: string,
  plantId: string
): Promise<{
  candidate: Plant
  history: RotationHistoryEntry[]
  current: RotationCurrentEntry[]
} | null> {
  const yearNow = currentYear()
  const lastYear = yearNow - 1
  const { data: candidate, error: cError } = await supabase
    .from('plants')
    .select('*')
    .eq('id', plantId)
    .maybeSingle()
  if (cError || !candidate) {
    console.error('candidate plant load failed:', cError)
    return null
  }
  const { data: rows, error: pError } = await supabase
    .from('bed_plantings')
    .select(
      'season_year, removed_at, plants(name, category, family, stark_oder_schwachzehrer, nachbarn)'
    )
    .eq('bed_id', bedId)
    .gte('season_year', lastYear)
    .lte('season_year', yearNow)
  if (pError) {
    console.error('history load failed:', pError)
  }
  type PR = {
    season_year: number
    removed_at: string | null
    plants: {
      name: string
      category: string
      family: string | null
      stark_oder_schwachzehrer: string | null
      nachbarn: string
    } | Array<{
      name: string
      category: string
      family: string | null
      stark_oder_schwachzehrer: string | null
      nachbarn: string
    }> | null
  }
  const history: RotationHistoryEntry[] = []
  const current: RotationCurrentEntry[] = []
  for (const row of (rows ?? []) as PR[]) {
    const p = Array.isArray(row.plants) ? row.plants[0] : row.plants
    if (!p) continue
    // Harvested plantings are no longer present in the bed for Mischkultur
    // purposes; treat them as historic for this season.
    if (row.season_year === yearNow && row.removed_at) continue
    if (row.season_year === yearNow) {
      current.push({ plant_name: p.name, nachbarn: p.nachbarn ?? '' })
    } else {
      history.push({
        year: row.season_year,
        plant_name: p.name,
        family: p.family,
        stark_oder_schwachzehrer: p.stark_oder_schwachzehrer,
        category: p.category,
      })
    }
  }
  return { candidate: candidate as Plant, history, current }
}

export type AdviceResult =
  | { ok: true; advice: RotationAdvice }
  | { error: 'no-garden' | 'not-found' | 'server' }

export async function getRotationAdvice(
  bedId: string,
  plantId: string
): Promise<AdviceResult> {
  try {
    const own = await ensureOwnBed(bedId)
    if ('error' in own) return { error: own.error }
    const ctx = await loadCandidateAndContext(own.supabase, bedId, plantId)
    if (!ctx) return { error: 'not-found' }
    const advice = await recommendRotation({
      candidate: {
        plant_id: ctx.candidate.id,
        name: ctx.candidate.name,
        family: ctx.candidate.family,
        stark_oder_schwachzehrer: ctx.candidate.stark_oder_schwachzehrer,
        nachbarn: ctx.candidate.nachbarn ?? '',
        category: ctx.candidate.category,
      },
      history: ctx.history,
      current: ctx.current,
      bedLabel: own.bed.label,
      todayISO: todayISO(),
    })
    return { ok: true, advice }
  } catch (err) {
    console.error('getRotationAdvice failed:', err)
    return { error: 'server' }
  }
}

export type AddPlantingSeason = 'current' | 'last_year'

export type AddPlantingResult =
  | { ok: true; plantingId: string }
  | { error: 'no-garden' | 'not-found' | 'invalid' | 'server' }

export async function addPlantingToBed(
  bedId: string,
  plantId: string,
  season: AddPlantingSeason = 'current'
): Promise<AddPlantingResult> {
  if (!plantId) return { error: 'invalid' }
  try {
    const own = await ensureOwnBed(bedId)
    if ('error' in own) return { error: own.error }
    const yearNow = currentYear()
    const seasonYear = season === 'last_year' ? yearNow - 1 : yearNow
    // Geplant-by-default: planted_at stays NULL until user marks "gepflanzt".
    // For last_year inserts there's no meaningful "planted today" semantic,
    // so we leave it null too — it's just history.
    const { data, error } = await own.supabase
      .from('bed_plantings')
      .insert({
        bed_id: bedId,
        plant_id: plantId,
        season_year: seasonYear,
        planted_at: null,
      })
      .select('id')
      .single()
    if (error || !data) {
      console.error('addPlantingToBed failed:', error)
      return { error: 'server' }
    }
    // Mirror into garden_plants so "Mein Garten" reflects what's in the plan.
    // If the plant is already in the garden (planted or interessiert), skip.
    await upsertGardenPlantForOwner(own.supabase, own.bed.garden_id, plantId)
    revalidatePath('/garten/plan')
    revalidatePath('/')
    revalidatePath(`/plants/${plantId}`)
    return { ok: true, plantingId: data.id as string }
  } catch (err) {
    console.error('addPlantingToBed threw:', err)
    return { error: 'server' }
  }
}

async function upsertGardenPlantForOwner(
  supabase: ReturnType<typeof adminClient>,
  gardenId: string,
  plantId: string
): Promise<void> {
  const { data: existing } = await supabase
    .from('garden_plants')
    .select('id')
    .eq('garden_id', gardenId)
    .eq('plant_id', plantId)
    .maybeSingle()
  if (existing) return
  const { error } = await supabase
    .from('garden_plants')
    .insert({ garden_id: gardenId, plant_id: plantId })
  if (error) {
    console.error('upsertGardenPlantForOwner failed:', error)
  }
}

export type SetPlantedResult =
  | { ok: true; plantedAt: string | null }
  | { error: 'no-garden' | 'not-found' | 'invalid' | 'server' }

async function ensureOwnPlanting(plantingId: string): Promise<
  | { error: 'no-garden' | 'not-found' }
  | {
      supabase: ReturnType<typeof adminClient>
      gardenId: string
      plantingId: string
      plantId: string
    }
> {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) return { error: 'no-garden' }
  const supabase = adminClient()
  const { data: row } = await supabase
    .from('bed_plantings')
    .select('id, plant_id, beds!inner(garden_id)')
    .eq('id', plantingId)
    .maybeSingle()
  type Joined = {
    id: string
    plant_id: string
    beds:
      | { garden_id: string }
      | Array<{ garden_id: string }>
      | null
  }
  const j = row as Joined | null
  if (!j) return { error: 'not-found' }
  const beds = Array.isArray(j.beds) ? j.beds[0] : j.beds
  if (!beds || beds.garden_id !== gardenId) return { error: 'not-found' }
  return {
    supabase,
    gardenId,
    plantingId: j.id,
    plantId: j.plant_id,
  }
}

// Derive garden_plants.planted_at from the per-bed states. Source of truth
// for the global Mein-Garten status is now the bed_plantings table.
async function deriveGlobalPlantedAt(
  supabase: ReturnType<typeof adminClient>,
  gardenId: string,
  plantId: string
): Promise<void> {
  const yearNow = currentYear()
  const { data, error } = await supabase
    .from('bed_plantings')
    .select('planted_at, beds!inner(garden_id)')
    .eq('plant_id', plantId)
    .eq('season_year', yearNow)
    .not('planted_at', 'is', null)
  if (error) {
    console.error('deriveGlobalPlantedAt query failed:', error)
    return
  }
  type Row = {
    planted_at: string | null
    beds:
      | { garden_id: string }
      | Array<{ garden_id: string }>
      | null
  }
  const dates: string[] = []
  for (const row of (data ?? []) as Row[]) {
    const b = Array.isArray(row.beds) ? row.beds[0] : row.beds
    if (!b || b.garden_id !== gardenId) continue
    if (row.planted_at) dates.push(row.planted_at)
  }
  // ISO YYYY-MM-DD strings sort lexicographically the same as chronologically.
  dates.sort()
  const minDate = dates.length > 0 ? dates[0] : null

  const { error: upError } = await supabase
    .from('garden_plants')
    .update({ planted_at: minDate })
    .eq('garden_id', gardenId)
    .eq('plant_id', plantId)
  if (upError) {
    console.error('deriveGlobalPlantedAt update failed:', upError)
  }
}

export async function markBedPlantingAsPlanted(
  plantingId: string
): Promise<SetPlantedResult> {
  try {
    const own = await ensureOwnPlanting(plantingId)
    if ('error' in own) return { error: own.error }
    const today = todayISO()
    const { error } = await own.supabase
      .from('bed_plantings')
      .update({ planted_at: today })
      .eq('id', plantingId)
    if (error) {
      console.error('markBedPlantingAsPlanted failed:', error)
      return { error: 'server' }
    }
    await deriveGlobalPlantedAt(own.supabase, own.gardenId, own.plantId)
    revalidatePath('/garten/plan')
    revalidatePath('/')
    revalidatePath(`/plants/${own.plantId}`)
    return { ok: true, plantedAt: today }
  } catch (err) {
    console.error('markBedPlantingAsPlanted threw:', err)
    return { error: 'server' }
  }
}

export async function markBedPlantingAsNotPlanted(
  plantingId: string
): Promise<SetPlantedResult> {
  try {
    const own = await ensureOwnPlanting(plantingId)
    if ('error' in own) return { error: own.error }
    const { error } = await own.supabase
      .from('bed_plantings')
      .update({ planted_at: null })
      .eq('id', plantingId)
    if (error) {
      console.error('markBedPlantingAsNotPlanted failed:', error)
      return { error: 'server' }
    }
    await deriveGlobalPlantedAt(own.supabase, own.gardenId, own.plantId)
    revalidatePath('/garten/plan')
    revalidatePath('/')
    revalidatePath(`/plants/${own.plantId}`)
    return { ok: true, plantedAt: null }
  } catch (err) {
    console.error('markBedPlantingAsNotPlanted threw:', err)
    return { error: 'server' }
  }
}

export async function markBedPlantingAsHarvested(
  plantingId: string
): Promise<SetPlantedResult> {
  try {
    const own = await ensureOwnPlanting(plantingId)
    if ('error' in own) return { error: own.error }
    const today = todayISO()
    const { error } = await own.supabase
      .from('bed_plantings')
      .update({ removed_at: today })
      .eq('id', plantingId)
    if (error) {
      console.error('markBedPlantingAsHarvested failed:', error)
      return { error: 'server' }
    }
    revalidatePath('/garten/plan')
    revalidatePath('/')
    revalidatePath(`/plants/${own.plantId}`)
    return { ok: true, plantedAt: today }
  } catch (err) {
    console.error('markBedPlantingAsHarvested threw:', err)
    return { error: 'server' }
  }
}

export async function unmarkBedPlantingAsHarvested(
  plantingId: string
): Promise<SetPlantedResult> {
  try {
    const own = await ensureOwnPlanting(plantingId)
    if ('error' in own) return { error: own.error }
    const { error } = await own.supabase
      .from('bed_plantings')
      .update({ removed_at: null })
      .eq('id', plantingId)
    if (error) {
      console.error('unmarkBedPlantingAsHarvested failed:', error)
      return { error: 'server' }
    }
    revalidatePath('/garten/plan')
    revalidatePath('/')
    revalidatePath(`/plants/${own.plantId}`)
    return { ok: true, plantedAt: null }
  } catch (err) {
    console.error('unmarkBedPlantingAsHarvested threw:', err)
    return { error: 'server' }
  }
}

export async function updateBedPlantingDate(
  plantingId: string,
  dateISO: string
): Promise<SetPlantedResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return { error: 'invalid' }
  try {
    const own = await ensureOwnPlanting(plantingId)
    if ('error' in own) return { error: own.error }
    const { error } = await own.supabase
      .from('bed_plantings')
      .update({ planted_at: dateISO })
      .eq('id', plantingId)
    if (error) {
      console.error('updateBedPlantingDate failed:', error)
      return { error: 'server' }
    }
    await deriveGlobalPlantedAt(own.supabase, own.gardenId, own.plantId)
    revalidatePath('/garten/plan')
    revalidatePath('/')
    revalidatePath(`/plants/${own.plantId}`)
    return { ok: true, plantedAt: dateISO }
  } catch (err) {
    console.error('updateBedPlantingDate threw:', err)
    return { error: 'server' }
  }
}

export type RemovePlantingResult =
  | { ok: true }
  | { error: 'no-garden' | 'not-found' | 'server' }

export async function removePlantingFromBed(
  plantingId: string
): Promise<RemovePlantingResult> {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) return { error: 'no-garden' }
  const supabase = adminClient()
  // Verify ownership via bed → garden
  const { data: row } = await supabase
    .from('bed_plantings')
    .select('id, beds!inner(garden_id)')
    .eq('id', plantingId)
    .maybeSingle()
  type Joined = {
    id: string
    beds: { garden_id: string } | Array<{ garden_id: string }> | null
  }
  const j = row as Joined | null
  if (!j) return { error: 'not-found' }
  const beds = Array.isArray(j.beds) ? j.beds[0] : j.beds
  if (!beds || beds.garden_id !== gardenId) return { error: 'not-found' }
  const { error } = await supabase
    .from('bed_plantings')
    .delete()
    .eq('id', plantingId)
  if (error) {
    console.error('removePlantingFromBed failed:', error)
    return { error: 'server' }
  }
  revalidatePath('/garten/plan')
  return { ok: true }
}

export type GardenStatus = 'planted' | 'interested' | 'none'

export type AvailablePlant = {
  id: string
  name: string
  category: string
  illustration_url: string | null
  suitable_bed_kinds: string[] | null
  gardenStatus: GardenStatus
}

export async function listAvailablePlants(): Promise<AvailablePlant[]> {
  const supabase = adminClient()
  const gardenId = await getCurrentGardenId()
  const [plantsRes, gpRes] = await Promise.all([
    supabase
      .from('plants')
      .select('id, name, category, illustration_url, suitable_bed_kinds')
      .order('name'),
    gardenId
      ? supabase
          .from('garden_plants')
          .select('plant_id, planted_at')
          .eq('garden_id', gardenId)
      : Promise.resolve({ data: [], error: null }),
  ])

  type GP = { plant_id: string; planted_at: string | null }
  const status = new Map<string, GardenStatus>()
  for (const row of ((gpRes.data ?? []) as GP[])) {
    status.set(row.plant_id, row.planted_at ? 'planted' : 'interested')
  }

  type PRow = {
    id: string
    name: string
    category: string
    illustration_url: string | null
    suitable_bed_kinds: string[] | null
  }
  return ((plantsRes.data ?? []) as PRow[]).map((p) => ({
    ...p,
    gardenStatus: status.get(p.id) ?? 'none',
  }))
}

export type BedForPlant = {
  bedId: string
  bedLabel: string
  bedKind: string
  plantingId: string
  plantedAt: string | null
}

/**
 * Read-only fetch of `plants.suitable_bed_kinds`. Used by AssignBedSheet
 * for live polling — when a freshly created plant's bed-kind suggestions
 * arrive from background Gemini enrichment, the sheet re-sorts the bed
 * list. Returns null while still pending.
 */
export async function getPlantSuitableBedKinds(
  plantId: string
): Promise<string[] | null> {
  if (!plantId) return null
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('plants')
    .select('suitable_bed_kinds')
    .eq('id', plantId)
    .maybeSingle()
  if (error) {
    console.error('getPlantSuitableBedKinds failed:', error)
    return null
  }
  const v = (data as { suitable_bed_kinds: string[] | null } | null)
    ?.suitable_bed_kinds
  return v ?? null
}

export async function listBedsContainingPlant(
  plantId: string
): Promise<BedForPlant[]> {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) return []
  const supabase = adminClient()
  const yearNow = currentYear()
  const { data } = await supabase
    .from('bed_plantings')
    .select(
      'id, planted_at, season_year, beds!inner(id, label, kind, garden_id)'
    )
    .eq('plant_id', plantId)
    .eq('season_year', yearNow)
    .order('created_at', { ascending: true })
  type Row = {
    id: string
    planted_at: string | null
    season_year: number
    beds:
      | { id: string; label: string; kind: string; garden_id: string }
      | Array<{ id: string; label: string; kind: string; garden_id: string }>
      | null
  }
  const out: BedForPlant[] = []
  for (const row of ((data ?? []) as Row[])) {
    const b = Array.isArray(row.beds) ? row.beds[0] : row.beds
    if (!b || b.garden_id !== gardenId) continue
    out.push({
      bedId: b.id,
      bedLabel: b.label,
      bedKind: b.kind,
      plantingId: row.id,
      plantedAt: row.planted_at,
    })
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────
// Stage 8.1 — Skizzen-Hintergrund (curated themes, per-garden)
// ─────────────────────────────────────────────────────────────────────────

export async function getGardenBackgroundKey(): Promise<string | null> {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) return null
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('gardens')
    .select('background_key')
    .eq('id', gardenId)
    .single()
  if (error || !data) return null
  return (data as { background_key: string | null }).background_key
}

export type SetBackgroundResult =
  | { ok: true }
  | { error: 'no-garden' | 'invalid' | 'server' }

export async function setGardenBackground(
  key: string | null
): Promise<SetBackgroundResult> {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) return { error: 'no-garden' }
  let stored: string | null = null
  if (key !== null) {
    if (typeof key !== 'string') return { error: 'invalid' }
    if (!isValidBackgroundKey(key)) return { error: 'invalid' }
    // 'default' is the no-image option; persist as NULL so the column reflects it.
    stored = key === 'default' ? null : key
  }
  const supabase = adminClient()
  const { error } = await supabase
    .from('gardens')
    .update({ background_key: stored })
    .eq('id', gardenId)
  if (error) {
    console.error('setGardenBackground failed:', error)
    return { error: 'server' }
  }
  revalidatePath('/garten/plan')
  return { ok: true }
}

