import { createClient } from '@supabase/supabase-js'
import type { BedKind } from './bedKinds'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

export function supabaseAdmin() {
  return createClient(supabaseUrl, process.env.SUPABASE_SECRET_KEY!)
}

export type PlantCategory =
  | 'Gemüse'
  | 'Kraut'
  | 'Blume'
  | 'Obst'
  | 'Baum'
  | 'Strauch'
  | 'Nuss'

export const PLANT_CATEGORIES: PlantCategory[] = [
  'Gemüse',
  'Kraut',
  'Blume',
  'Obst',
  'Baum',
  'Strauch',
  'Nuss',
]

export type Plant = {
  id: string
  name: string
  latin_name: string
  category: PlantCategory
  /**
   * Multi-category array. `category` is the primary (display + color);
   * `categories` is what filters search against. Always contains at least
   * the primary. Stage 7.1 backfilled secondaries from Gemini.
   */
  categories: string[] | null
  illustration_url: string | null
  sorte: string
  saatzeit: string
  saattiefe: string
  nachbarn: string
  erde: string
  witterung: string
  bodenmilieu: string
  duenger: string
  vorzucht: string
  schneiden: string
  einwintern: string
  ernte: string
  einjaehrig_oder_mehrjaehrig: string
  pflanzort: string
  wirkung: string
  stark_oder_schwachzehrer: string
  family: string | null
  suitable_bed_kinds: string[] | null
  created_at: string
}

export type { BedKind }

export type BedShape = 'rect' | 'ellipse'

export type Bed = {
  id: string
  garden_id: string
  label: string
  kind: BedKind
  x: number | null
  y: number | null
  w: number | null
  h: number | null
  /**
   * Stage 5B.1 — explicit shape override. NULL means derive from kind
   * (topf + kuebel → ellipse, all others → rect).
   */
  shape: BedShape | null
  /** Stage 5B.1 — rotation in degrees, 0 if untouched. */
  rotation: number | null
  created_at: string
}

export type BedPlanting = {
  id: string
  bed_id: string
  plant_id: string
  season_year: number
  planted_at: string | null
  removed_at: string | null
  notes: string | null
  created_at: string
}

export type Garden = {
  id: string
  owner_name: string
  created_at: string
  weekly_tasks_cache: unknown
  weekly_tasks_cache_date: string | null
  /** Stage 8.1 — curated Skizzen-Hintergrund. NULL = Standard (off-white). */
  background_key: string | null
}

export type GardenPlant = {
  id: string
  garden_id: string
  plant_id: string
  planted_at: string | null
  notes?: string
  sorte?: string
  saatzeit?: string
  saattiefe?: string
  nachbarn?: string
  erde?: string
  witterung?: string
  bodenmilieu?: string
  duenger?: string
  vorzucht?: string
  schneiden?: string
  einwintern?: string
  ernte?: string
  einjaehrig_oder_mehrjaehrig?: string
  pflanzort?: string
  wirkung?: string
  stark_oder_schwachzehrer?: string
  created_at: string
}