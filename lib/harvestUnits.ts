/**
 * Stage 9 — Single source of truth for the 7 harvest units.
 *
 * Each unit has a label (German), a singular/plural form for display
 * ("1 Bund" vs "3 Bünde"), and a small set of "quick amount" buttons
 * that the HarvestSheet shows as 2-tap shortcuts (Pflücksalat-Realität:
 * the user shouldn't have to type "1" every Sunday).
 */

export type HarvestUnit =
  | 'kg'
  | 'g'
  | 'stueck'
  | 'bund'
  | 'kopf'
  | 'schnitt'
  | 'schale'

export type HarvestUnitMeta = {
  key: HarvestUnit
  label: string
  /** Singular form, used after `1 …` */
  singular: string
  /** Plural form, used after `0` or `>1` */
  plural: string
  /** Quick-amount buttons in the HarvestSheet for this unit. */
  quickAmounts: number[]
  /** How many decimal places to show in the chip total ("0.5 kg" but "12 Bund"). */
  decimals: number
}

export const HARVEST_UNITS: HarvestUnitMeta[] = [
  {
    key: 'kg',
    label: 'kg',
    singular: 'kg',
    plural: 'kg',
    quickAmounts: [0.5, 1, 2],
    decimals: 1,
  },
  {
    key: 'g',
    label: 'g',
    singular: 'g',
    plural: 'g',
    quickAmounts: [50, 100, 200],
    decimals: 0,
  },
  {
    key: 'stueck',
    label: 'Stück',
    singular: 'Stück',
    plural: 'Stück',
    quickAmounts: [1, 5, 10],
    decimals: 0,
  },
  {
    key: 'bund',
    label: 'Bund',
    singular: 'Bund',
    plural: 'Bund',
    quickAmounts: [1, 2],
    decimals: 0,
  },
  {
    key: 'kopf',
    label: 'Kopf',
    singular: 'Kopf',
    plural: 'Köpfe',
    quickAmounts: [1, 2],
    decimals: 0,
  },
  {
    key: 'schnitt',
    label: 'Schnitt',
    singular: 'Schnitt',
    plural: 'Schnitte',
    quickAmounts: [1],
    decimals: 0,
  },
  {
    key: 'schale',
    label: 'Schale',
    singular: 'Schale',
    plural: 'Schalen',
    quickAmounts: [1, 2],
    decimals: 0,
  },
]

const META_BY_KEY = new Map<HarvestUnit, HarvestUnitMeta>(
  HARVEST_UNITS.map((u) => [u.key, u])
)

const VALID_SET = new Set<string>(HARVEST_UNITS.map((u) => u.key))

export function isValidHarvestUnit(s: string): s is HarvestUnit {
  return VALID_SET.has(s)
}

export function harvestUnitMeta(key: string | null | undefined): HarvestUnitMeta {
  if (!key) return META_BY_KEY.get('kg')!
  const m = META_BY_KEY.get(key as HarvestUnit)
  return m ?? META_BY_KEY.get('kg')!
}

/**
 * Format an amount + unit pair for display, e.g. "1.2 kg" / "3 Bünde" / "1 Kopf".
 * Defaults to amount=0 → "0 …".
 */
export function formatHarvest(
  amount: number,
  unit: string | null | undefined
): string {
  const meta = harvestUnitMeta(unit)
  const label = amount === 1 ? meta.singular : meta.plural
  const value = meta.decimals > 0
    ? amount.toFixed(meta.decimals).replace(/\.?0+$/, '')
    : Math.round(amount).toString()
  return `${value} ${label}`
}
