import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Plant = {
  id: string
  name: string
  latin_name: string
  category: 'Gemüse' | 'Kraut' | 'Blume' | 'Obst'
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
  created_at: string
}

export type Garden = {
  id: string
  owner_name: string
  created_at: string
}

export type GardenPlant = {
  id: string
  garden_id: string
  plant_id: string
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