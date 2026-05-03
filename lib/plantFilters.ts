/**
 * Stage 12 / 12.1 — pure filter logic + types shared between the catalog
 * (`/browse`) and Mein Garten home (`/`). Five smart-filter axes over
 * the structured Plant fields, all client-side substring/exact matching.
 */

import type { Plant } from '@/lib/supabase'

export const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
] as const
export type Month = (typeof MONTHS)[number]

export const LIFECYCLES = ['einjährig', 'zweijährig', 'mehrjährig'] as const
export type Lifecycle = (typeof LIFECYCLES)[number]

export const NUTRIENTS = ['Starkzehrer', 'Mittelzehrer', 'Schwachzehrer'] as const
export type Nutrient = (typeof NUTRIENTS)[number]

export const LIGHTS = ['sonnig', 'halbschattig', 'schattig'] as const
export type Light = (typeof LIGHTS)[number]

export type SmartFilters = {
  seedMonth: Month | null
  harvestMonth: Month | null
  lifecycle: Lifecycle | null
  nutrient: Nutrient | null
  light: Light | null
}

export const EMPTY_FILTERS: SmartFilters = {
  seedMonth: null,
  harvestMonth: null,
  lifecycle: null,
  nutrient: null,
  light: null,
}

function lower(s: string | null | undefined): string {
  return (s ?? '').toLowerCase()
}

export function plantMatchesSmart(p: Plant, f: SmartFilters): boolean {
  if (f.seedMonth && !lower(p.saatzeit).includes(f.seedMonth.toLowerCase())) {
    return false
  }
  if (f.harvestMonth && !lower(p.ernte).includes(f.harvestMonth.toLowerCase())) {
    return false
  }
  if (f.lifecycle) {
    const v = lower(p.einjaehrig_oder_mehrjaehrig)
    if (!v.includes(f.lifecycle.toLowerCase())) return false
  }
  if (f.nutrient) {
    const v = lower(p.stark_oder_schwachzehrer)
    if (!v.includes(f.nutrient.toLowerCase())) return false
  }
  if (f.light) {
    const v = lower(p.pflanzort) + ' ' + lower(p.witterung)
    if (!v.includes(f.light.toLowerCase())) return false
  }
  return true
}

export function activeSmartCount(f: SmartFilters): number {
  return (
    (f.seedMonth ? 1 : 0) +
    (f.harvestMonth ? 1 : 0) +
    (f.lifecycle ? 1 : 0) +
    (f.nutrient ? 1 : 0) +
    (f.light ? 1 : 0)
  )
}
