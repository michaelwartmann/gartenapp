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
import { isValidHarvestUnit } from '@/lib/harvestUnits'
import { isValidRemovedReason } from '@/lib/removedReasons'
import type { Harvest } from '@/lib/supabase'

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

export type PlantingHarvestSummary = {
  count: number
  /** Sum of amounts when all events share a unit; null if mixed. */
  totalAmount: number | null
  totalUnit: string | null
  lastDate: string | null
  lastAmount: number | null
  lastUnit: string | null
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
  /** Stage 9 — default harvest unit suggested for this plant (NULL = no harvest UI). */
  plant_harvest_unit: string | null
  /** Stage 9 — aggregated harvest log for this planting. NULL if no harvests yet. */
  harvest_summary: PlantingHarvestSummary | null
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
      'id, bed_id, plant_id, season_year, planted_at, removed_at, plants(name, category, illustration_url, family, stark_oder_schwachzehrer, harvest_unit)'
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
      harvest_unit: string | null
    } | Array<{
      name: string
      category: string
      illustration_url: string | null
      family: string | null
      stark_oder_schwachzehrer: string | null
      harvest_unit: string | null
    }> | null
  }

  // Stage 9 — fetch harvest events for every planting in one query and
  // aggregate per-planting summaries (count, total if uniform unit, last
  // event). Cheap: one extra round-trip, no per-row N+1.
  const plantingRows = (plantings ?? []) as PRow[]
  const plantingIds = plantingRows.map((r) => r.id)
  const harvestsByPlanting = new Map<string, PlantingHarvestSummary>()
  if (plantingIds.length > 0) {
    const { data: harvests, error: hError } = await supabase
      .from('harvests')
      .select('bed_planting_id, amount, unit, harvested_at, created_at')
      .in('bed_planting_id', plantingIds)
      .order('harvested_at', { ascending: false })
      .order('created_at', { ascending: false })
    if (hError) {
      // Schema not migrated yet, or other error — silently fall through with
      // empty summaries so the page still renders. UI will show no totals.
      console.error('listBedsForGarden harvests query failed:', hError)
    } else {
      type HRow = {
        bed_planting_id: string
        amount: number | string
        unit: string
        harvested_at: string
      }
      const grouped = new Map<string, HRow[]>()
      for (const h of (harvests ?? []) as HRow[]) {
        const arr = grouped.get(h.bed_planting_id) ?? []
        arr.push(h)
        grouped.set(h.bed_planting_id, arr)
      }
      for (const [pid, events] of grouped) {
        const units = new Set(events.map((e) => e.unit))
        const last = events[0]
        harvestsByPlanting.set(pid, {
          count: events.length,
          totalAmount:
            units.size === 1
              ? events.reduce((s, e) => s + Number(e.amount), 0)
              : null,
          totalUnit: units.size === 1 ? last.unit : null,
          lastDate: last.harvested_at,
          lastAmount: Number(last.amount),
          lastUnit: last.unit,
        })
      }
    }
  }

  const flat: PlantingWithPlant[] = []
  for (const row of plantingRows) {
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
      plant_harvest_unit: p.harvest_unit ?? null,
      harvest_summary: harvestsByPlanting.get(row.id) ?? null,
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


// ─────────────────────────────────────────────────────────────────────────
// Stage 9 — Ernte-Tracking (event log + per-planting summary)
// ─────────────────────────────────────────────────────────────────────────

export type RecordHarvestInput = {
  plantingId: string
  amount: number
  unit: string
  /** ISO YYYY-MM-DD; defaults to today on the server if omitted/invalid. */
  date?: string | null
  notes?: string | null
  /** When true, also set bed_plantings.removed_at = harvest date ("Pflanze raus"). */
  endPlanting?: boolean
  /**
   * Stage 10 — required when endPlanting=true. One of REMOVED_REASONS keys.
   * Defaults to 'saison_ende' if endPlanting=true and no reason given.
   * Ignored when endPlanting=false.
   */
  removedReason?: string | null
}

export type RecordHarvestResult =
  | { ok: true; harvest: Harvest }
  | { error: 'no-garden' | 'not-found' | 'invalid' | 'server' }

function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))
}

export async function recordHarvest(
  input: RecordHarvestInput
): Promise<RecordHarvestResult> {
  if (!input || typeof input.plantingId !== 'string') return { error: 'invalid' }
  if (!Number.isFinite(input.amount) || input.amount < 0) return { error: 'invalid' }
  if (typeof input.unit !== 'string' || !isValidHarvestUnit(input.unit)) {
    return { error: 'invalid' }
  }
  const harvestedAt =
    input.date && isValidISODate(input.date) ? input.date : todayISO()
  const cleanNotes =
    typeof input.notes === 'string' && input.notes.trim()
      ? input.notes.trim().slice(0, 500)
      : null

  const own = await ensureOwnPlanting(input.plantingId)
  if ('error' in own) return { error: own.error }
  const { supabase, gardenId, plantId } = own

  const { data: inserted, error: insErr } = await supabase
    .from('harvests')
    .insert({
      bed_planting_id: input.plantingId,
      garden_id: gardenId,
      amount: input.amount,
      unit: input.unit,
      harvested_at: harvestedAt,
      notes: cleanNotes,
    })
    .select('*')
    .single()
  if (insErr || !inserted) {
    console.error('recordHarvest insert failed:', insErr)
    return { error: 'server' }
  }

  if (input.endPlanting) {
    // Stage 10 — also persist the removed_reason. Default to 'saison_ende'
    // when not specified or invalid (= matches the historical 1-tap flow).
    const reasonRaw = input.removedReason
    const removedReason =
      typeof reasonRaw === 'string' && isValidRemovedReason(reasonRaw)
        ? reasonRaw
        : 'saison_ende'
    const { error: upErr } = await supabase
      .from('bed_plantings')
      .update({ removed_at: harvestedAt, removed_reason: removedReason })
      .eq('id', input.plantingId)
    if (upErr) {
      console.error('recordHarvest end-planting update failed:', upErr)
      // The harvest event was inserted successfully — return ok so the user
      // doesn't lose their entry. Their next "Pflanze raus" tap will retry.
    }
  }

  revalidatePath('/garten/plan')
  revalidatePath('/')
  revalidatePath(`/plants/${plantId}`)
  return { ok: true, harvest: inserted as Harvest }
}

export type DeleteHarvestResult =
  | { ok: true }
  | { error: 'no-garden' | 'not-found' | 'server' }

export async function deleteHarvest(
  harvestId: string
): Promise<DeleteHarvestResult> {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) return { error: 'no-garden' }
  const supabase = adminClient()
  const { data: row, error: selErr } = await supabase
    .from('harvests')
    .select('id, bed_planting_id, garden_id')
    .eq('id', harvestId)
    .maybeSingle()
  if (selErr || !row) return { error: 'not-found' }
  if ((row as { garden_id: string }).garden_id !== gardenId) {
    return { error: 'not-found' }
  }
  const { error: delErr } = await supabase
    .from('harvests')
    .delete()
    .eq('id', harvestId)
  if (delErr) {
    console.error('deleteHarvest failed:', delErr)
    return { error: 'server' }
  }
  // Look up the plantId for revalidate so the plant detail page refreshes.
  const planting = await supabase
    .from('bed_plantings')
    .select('plant_id')
    .eq('id', (row as { bed_planting_id: string }).bed_planting_id)
    .maybeSingle()
  const plantId = (planting.data as { plant_id?: string } | null)?.plant_id
  revalidatePath('/garten/plan')
  if (plantId) revalidatePath(`/plants/${plantId}`)
  return { ok: true }
}

export type HarvestSummary = {
  /** Total of harvests for this planting in the current season, only if
   *  all events use the same unit. NULL if unit is mixed (display falls
   *  back to "X Einträge"). */
  totalAmount: number | null
  totalUnit: string | null
  count: number
  /** ISO YYYY-MM-DD of the most recent harvest event, NULL if none. */
  lastDate: string | null
  /** Last event's amount + unit, for the "↩ Letzte: 1 Bund" hint. */
  lastAmount: number | null
  lastUnit: string | null
}

export async function getHarvestSummaryForPlanting(
  plantingId: string
): Promise<HarvestSummary | null> {
  const own = await ensureOwnPlanting(plantingId)
  if ('error' in own) return null
  const { supabase } = own

  const { data, error } = await supabase
    .from('harvests')
    .select('amount, unit, harvested_at')
    .eq('bed_planting_id', plantingId)
    .order('harvested_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) {
    console.error('getHarvestSummaryForPlanting failed:', error)
    return null
  }
  const rows = (data ?? []) as Array<{
    amount: number | string
    unit: string
    harvested_at: string
  }>
  if (rows.length === 0) {
    return {
      totalAmount: null,
      totalUnit: null,
      count: 0,
      lastDate: null,
      lastAmount: null,
      lastUnit: null,
    }
  }
  const units = new Set(rows.map((r) => r.unit))
  let total: number | null = null
  let totalUnit: string | null = null
  if (units.size === 1) {
    totalUnit = rows[0].unit
    total = rows.reduce((s, r) => s + Number(r.amount), 0)
  }
  const last = rows[0]
  return {
    totalAmount: total,
    totalUnit,
    count: rows.length,
    lastDate: last.harvested_at,
    lastAmount: Number(last.amount),
    lastUnit: last.unit,
  }
}

export async function listHarvestsForPlanting(
  plantingId: string
): Promise<Harvest[]> {
  const own = await ensureOwnPlanting(plantingId)
  if ('error' in own) return []
  const { supabase } = own
  const { data, error } = await supabase
    .from('harvests')
    .select('*')
    .eq('bed_planting_id', plantingId)
    .order('harvested_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) {
    console.error('listHarvestsForPlanting failed:', error)
    return []
  }
  return (data ?? []) as Harvest[]
}

/**
 * Aggregated harvest history for a plant across ALL plantings it has had
 * in the user's garden — for the Plant-Detail "Ernte-Verlauf" section.
 * Returns events newest-first, plus a season total for the current year.
 */
export type PlantHarvestHistory = {
  events: Array<
    Harvest & { bedLabel: string; seasonYear: number }
  >
  /** Per-year totals, only filled when all events that year share a unit. */
  byYear: Array<{
    year: number
    count: number
    totalAmount: number | null
    totalUnit: string | null
  }>
}

export async function getPlantHarvestHistory(
  plantId: string
): Promise<PlantHarvestHistory> {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) return { events: [], byYear: [] }
  const supabase = adminClient()

  // Two-step: get plantings of this plant in this garden, then their harvests.
  const { data: plantings, error: pErr } = await supabase
    .from('bed_plantings')
    .select(
      'id, season_year, beds!inner(garden_id, label)'
    )
    .eq('plant_id', plantId)
  if (pErr) {
    console.error('getPlantHarvestHistory plantings failed:', pErr)
    return { events: [], byYear: [] }
  }
  type PRow = {
    id: string
    season_year: number
    beds:
      | { garden_id: string; label: string }
      | Array<{ garden_id: string; label: string }>
      | null
  }
  const ownedPlantings = new Map<
    string,
    { bedLabel: string; seasonYear: number }
  >()
  for (const row of (plantings ?? []) as PRow[]) {
    const b = Array.isArray(row.beds) ? row.beds[0] : row.beds
    if (!b || b.garden_id !== gardenId) continue
    ownedPlantings.set(row.id, {
      bedLabel: b.label,
      seasonYear: row.season_year,
    })
  }
  if (ownedPlantings.size === 0) return { events: [], byYear: [] }

  const { data: harvests, error: hErr } = await supabase
    .from('harvests')
    .select('*')
    .in('bed_planting_id', Array.from(ownedPlantings.keys()))
    .order('harvested_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (hErr) {
    console.error('getPlantHarvestHistory harvests failed:', hErr)
    return { events: [], byYear: [] }
  }
  const events = ((harvests ?? []) as Harvest[]).map((h) => {
    const meta = ownedPlantings.get(h.bed_planting_id)!
    return { ...h, bedLabel: meta.bedLabel, seasonYear: meta.seasonYear }
  })

  // Per-year aggregates
  const byYearMap = new Map<
    number,
    { count: number; units: Set<string>; sum: number }
  >()
  for (const e of events) {
    const y = new Date(e.harvested_at).getFullYear()
    if (!byYearMap.has(y)) {
      byYearMap.set(y, { count: 0, units: new Set(), sum: 0 })
    }
    const a = byYearMap.get(y)!
    a.count++
    a.units.add(e.unit)
    a.sum += Number(e.amount)
  }
  const byYear = Array.from(byYearMap.entries())
    .map(([year, a]) => ({
      year,
      count: a.count,
      totalAmount: a.units.size === 1 ? a.sum : null,
      totalUnit: a.units.size === 1 ? Array.from(a.units)[0] : null,
    }))
    .sort((a, b) => b.year - a.year)

  return { events, byYear }
}

// HarvestUnit is re-exported from `lib/harvestUnits` directly — re-exporting
// types from a 'use server' module is rejected by the RSC compiler.

// ─────────────────────────────────────────────────────────────────────────
// Stage 10 — Garten-Bilanz (per-plant, per-bed, per-week, highlights, losses)
// ─────────────────────────────────────────────────────────────────────────

export type BilanzPlantRow = {
  plantId: string
  plantName: string
  plantCategory: string
  plantIllustrationUrl: string | null
  count: number
  /** sum per unit (since plants can mix units across plantings) */
  byUnit: Array<{ unit: string; total: number }>
}

export type BilanzBedRow = {
  bedId: string
  bedLabel: string
  bedKind: string
  count: number
  byUnit: Array<{ unit: string; total: number }>
}

export type BilanzWeekRow = {
  /** ISO week label like "KW 22" */
  weekLabel: string
  /** Year + week, used for sort */
  weekKey: string
  /** Sum of all amounts that week, ignoring unit (raw measure of activity) */
  totalAmount: number
  count: number
}

export type BilanzHighlight =
  | { kind: 'first'; date: string; plantName: string; amount: number; unit: string }
  | { kind: 'biggest'; date: string; plantName: string; amount: number; unit: string }
  | { kind: 'most_consistent'; plantName: string; count: number; totalAmount: number; unit: string }
  | { kind: 'busiest_week'; weekLabel: string; count: number }

export type BilanzLoss = {
  plantingId: string
  plantId: string
  plantName: string
  plantCategory: string
  bedLabel: string
  bedKind: string
  removedAt: string
  reasonKey: string
}

export type GardenBilanz = {
  year: number
  availableYears: number[]
  plantedCount: number
  harvestedPlantCount: number
  harvestEventCount: number
  lossCount: number
  perPlant: BilanzPlantRow[]
  perBed: BilanzBedRow[]
  perWeek: BilanzWeekRow[]
  highlights: BilanzHighlight[]
  losses: BilanzLoss[]
}

function isoWeekLabel(iso: string): { label: string; key: string } {
  // Compute ISO week (Mon–Sun) for a YYYY-MM-DD date.
  const d = new Date(`${iso}T00:00:00Z`)
  const target = new Date(d.valueOf())
  const dayNr = (d.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setUTCMonth(0, 1)
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7)
  }
  const weekNo = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
  const year = new Date(`${iso}T00:00:00Z`).getUTCFullYear()
  const wk = String(weekNo).padStart(2, '0')
  return { label: `KW ${weekNo}`, key: `${year}-${wk}` }
}

export async function getGardenBilanz(year?: number): Promise<GardenBilanz | null> {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) return null
  const supabase = adminClient()
  const targetYear = year && Number.isFinite(year) ? year : currentYear()
  const yearStart = `${targetYear}-01-01`
  const yearEnd = `${targetYear}-12-31`

  // 1) All harvests in the year, joined to planting → bed + plant
  const { data: harvests, error: hErr } = await supabase
    .from('harvests')
    .select(
      'id, amount, unit, harvested_at, bed_planting_id, ' +
        'bed_plantings!inner(id, plant_id, ' +
        'beds!inner(id, label, kind, garden_id), ' +
        'plants(id, name, category, illustration_url))'
    )
    .eq('garden_id', gardenId)
    .gte('harvested_at', yearStart)
    .lte('harvested_at', yearEnd)
    .order('harvested_at', { ascending: true })
  if (hErr) {
    console.error('getGardenBilanz harvests query failed:', hErr)
    return null
  }

  // 2) Plantings ended that year (for losses + plantedCount), via bed_plantings
  const { data: removedRows, error: rErr } = await supabase
    .from('bed_plantings')
    .select(
      'id, plant_id, removed_at, removed_reason, season_year, ' +
        'beds!inner(id, label, kind, garden_id), ' +
        'plants(id, name, category)'
    )
    .gte('removed_at', yearStart)
    .lte('removed_at', yearEnd)
  if (rErr) {
    console.error('getGardenBilanz removed query failed:', rErr)
  }

  // 3) Determine availableYears (any year with ≥1 harvest OR ≥1 removed)
  const { data: allYearsHarv } = await supabase
    .from('harvests')
    .select('harvested_at')
    .eq('garden_id', gardenId)
  const { data: allYearsBeds } = await supabase
    .from('bed_plantings')
    .select('removed_at, planted_at, season_year, beds!inner(garden_id)')
    .not('season_year', 'is', null)
  const yearSet = new Set<number>()
  for (const h of (allYearsHarv ?? []) as { harvested_at: string }[]) {
    yearSet.add(new Date(`${h.harvested_at}T00:00:00Z`).getUTCFullYear())
  }
  type YBRow = {
    removed_at: string | null
    planted_at: string | null
    season_year: number | null
    beds: { garden_id: string } | Array<{ garden_id: string }> | null
  }
  for (const r of (allYearsBeds ?? []) as YBRow[]) {
    const b = Array.isArray(r.beds) ? r.beds[0] : r.beds
    if (!b || b.garden_id !== gardenId) continue
    if (r.season_year) yearSet.add(r.season_year)
    if (r.removed_at) {
      yearSet.add(new Date(`${r.removed_at}T00:00:00Z`).getUTCFullYear())
    }
  }
  yearSet.add(targetYear)
  const availableYears = [...yearSet].sort((a, b) => b - a)

  // 4) Aggregate from harvests
  type HRow = {
    id: string
    amount: number | string
    unit: string
    harvested_at: string
    bed_planting_id: string
    bed_plantings: {
      id: string
      plant_id: string
      beds:
        | { id: string; label: string; kind: string; garden_id: string }
        | Array<{ id: string; label: string; kind: string; garden_id: string }>
        | null
      plants:
        | { id: string; name: string; category: string; illustration_url: string | null }
        | Array<{ id: string; name: string; category: string; illustration_url: string | null }>
        | null
    } | Array<{
      id: string
      plant_id: string
      beds:
        | { id: string; label: string; kind: string; garden_id: string }
        | Array<{ id: string; label: string; kind: string; garden_id: string }>
        | null
      plants:
        | { id: string; name: string; category: string; illustration_url: string | null }
        | Array<{ id: string; name: string; category: string; illustration_url: string | null }>
        | null
    }> | null
  }

  type Bucket = {
    plantId: string
    plantName: string
    plantCategory: string
    plantIllustrationUrl: string | null
    bedId: string
    bedLabel: string
    bedKind: string
    amount: number
    unit: string
    harvested_at: string
  }

  const events: Bucket[] = []
  for (const row of (harvests ?? []) as unknown as HRow[]) {
    const bp = Array.isArray(row.bed_plantings) ? row.bed_plantings[0] : row.bed_plantings
    if (!bp) continue
    const b = Array.isArray(bp.beds) ? bp.beds[0] : bp.beds
    if (!b || b.garden_id !== gardenId) continue
    const p = Array.isArray(bp.plants) ? bp.plants[0] : bp.plants
    if (!p) continue
    events.push({
      plantId: p.id,
      plantName: p.name,
      plantCategory: p.category,
      plantIllustrationUrl: p.illustration_url,
      bedId: b.id,
      bedLabel: b.label,
      bedKind: b.kind,
      amount: Number(row.amount),
      unit: row.unit,
      harvested_at: row.harvested_at,
    })
  }

  // Per-plant
  const perPlantMap = new Map<string, BilanzPlantRow & { _byUnit: Map<string, number> }>()
  for (const e of events) {
    let row = perPlantMap.get(e.plantId)
    if (!row) {
      row = {
        plantId: e.plantId,
        plantName: e.plantName,
        plantCategory: e.plantCategory,
        plantIllustrationUrl: e.plantIllustrationUrl,
        count: 0,
        byUnit: [],
        _byUnit: new Map(),
      }
      perPlantMap.set(e.plantId, row)
    }
    row.count++
    row._byUnit.set(e.unit, (row._byUnit.get(e.unit) ?? 0) + e.amount)
  }
  const perPlant: BilanzPlantRow[] = [...perPlantMap.values()]
    .map(({ _byUnit, ...r }) => ({
      ...r,
      byUnit: [..._byUnit.entries()]
        .map(([unit, total]) => ({ unit, total }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.count - a.count)

  // Per-bed
  const perBedMap = new Map<string, BilanzBedRow & { _byUnit: Map<string, number> }>()
  for (const e of events) {
    let row = perBedMap.get(e.bedId)
    if (!row) {
      row = {
        bedId: e.bedId,
        bedLabel: e.bedLabel,
        bedKind: e.bedKind,
        count: 0,
        byUnit: [],
        _byUnit: new Map(),
      }
      perBedMap.set(e.bedId, row)
    }
    row.count++
    row._byUnit.set(e.unit, (row._byUnit.get(e.unit) ?? 0) + e.amount)
  }
  const perBed: BilanzBedRow[] = [...perBedMap.values()]
    .map(({ _byUnit, ...r }) => ({
      ...r,
      byUnit: [..._byUnit.entries()]
        .map(([unit, total]) => ({ unit, total }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.count - a.count)

  // Per-week (raw activity, ignores unit because we just want a sense of "when")
  const perWeekMap = new Map<string, BilanzWeekRow>()
  for (const e of events) {
    const { label, key } = isoWeekLabel(e.harvested_at)
    let row = perWeekMap.get(key)
    if (!row) {
      row = { weekLabel: label, weekKey: key, totalAmount: 0, count: 0 }
      perWeekMap.set(key, row)
    }
    row.count++
    row.totalAmount += e.amount
  }
  const perWeek = [...perWeekMap.values()].sort((a, b) =>
    a.weekKey.localeCompare(b.weekKey)
  )

  // Highlights
  const highlights: BilanzHighlight[] = []
  if (events.length > 0) {
    const first = events[0] // events are ordered ascending by date
    highlights.push({
      kind: 'first',
      date: first.harvested_at,
      plantName: first.plantName,
      amount: first.amount,
      unit: first.unit,
    })
    const biggest = events.reduce((a, b) => (b.amount > a.amount ? b : a))
    if (biggest !== first || events.length > 1) {
      highlights.push({
        kind: 'biggest',
        date: biggest.harvested_at,
        plantName: biggest.plantName,
        amount: biggest.amount,
        unit: biggest.unit,
      })
    }
    const mostConsistent = perPlant[0]
    if (mostConsistent && mostConsistent.count >= 2) {
      const top = mostConsistent.byUnit[0]
      if (top) {
        highlights.push({
          kind: 'most_consistent',
          plantName: mostConsistent.plantName,
          count: mostConsistent.count,
          totalAmount: top.total,
          unit: top.unit,
        })
      }
    }
    if (perWeek.length >= 1) {
      const busiest = perWeek.reduce((a, b) => (b.count > a.count ? b : a))
      if (busiest.count >= 2) {
        highlights.push({
          kind: 'busiest_week',
          weekLabel: busiest.weekLabel,
          count: busiest.count,
        })
      }
    }
  }

  // Losses (only loss/event tone — saison_ende and umgepflanzt aren't losses)
  type RRow = {
    id: string
    plant_id: string
    removed_at: string | null
    removed_reason: string | null
    season_year: number | null
    beds:
      | { id: string; label: string; kind: string; garden_id: string }
      | Array<{ id: string; label: string; kind: string; garden_id: string }>
      | null
    plants:
      | { id: string; name: string; category: string }
      | Array<{ id: string; name: string; category: string }>
      | null
  }
  const losses: BilanzLoss[] = []
  for (const row of (removedRows ?? []) as unknown as RRow[]) {
    const b = Array.isArray(row.beds) ? row.beds[0] : row.beds
    if (!b || b.garden_id !== gardenId) continue
    const p = Array.isArray(row.plants) ? row.plants[0] : row.plants
    if (!p) continue
    if (!row.removed_at || !row.removed_reason) continue
    if (
      row.removed_reason === 'saison_ende' ||
      row.removed_reason === 'umgepflanzt' ||
      row.removed_reason === 'anderes'
    ) {
      continue
    }
    losses.push({
      plantingId: row.id,
      plantId: p.id,
      plantName: p.name,
      plantCategory: p.category,
      bedLabel: b.label,
      bedKind: b.kind,
      removedAt: row.removed_at,
      reasonKey: row.removed_reason,
    })
  }
  losses.sort((a, b) => (a.removedAt < b.removedAt ? 1 : -1))

  // plantedCount (any planting that was active in the year — planted_at <= year-end and (removed_at is null OR removed_at >= year-start))
  const { data: activePlantings } = await supabase
    .from('bed_plantings')
    .select('plant_id, season_year, planted_at, removed_at, beds!inner(garden_id)')
    .or(`season_year.eq.${targetYear},planted_at.lte.${yearEnd}`)
  const plantedSet = new Set<string>()
  type APRow = {
    plant_id: string
    season_year: number | null
    planted_at: string | null
    removed_at: string | null
    beds: { garden_id: string } | Array<{ garden_id: string }> | null
  }
  for (const r of (activePlantings ?? []) as APRow[]) {
    const b = Array.isArray(r.beds) ? r.beds[0] : r.beds
    if (!b || b.garden_id !== gardenId) continue
    if (r.season_year && r.season_year === targetYear) plantedSet.add(r.plant_id)
  }

  return {
    year: targetYear,
    availableYears,
    plantedCount: plantedSet.size,
    harvestedPlantCount: perPlant.length,
    harvestEventCount: events.length,
    lossCount: losses.length,
    perPlant,
    perBed,
    perWeek,
    highlights,
    losses,
  }
}
