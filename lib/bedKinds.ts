// Single source of truth for the 8 supported Beet-Arten.
// Used by AddBedForm, BedCard, EditBedSheet, AssignBedSheet, and the
// VALID_KINDS validator in app/garten/plan/actions.ts.

export type BedKind =
  | 'beet'         // Freiland, normaler Boden
  | 'hochbeet'
  | 'gewaechshaus' // inkl. Folientunnel + Frühbeet
  | 'topf'         // Topf außen (Balkon, Terrasse)
  | 'topf_innen'   // Fensterbank, Indoor-Topf
  | 'hydroponik'   // substratlos, oft indoor
  | 'rasen'        // Streuobstwiese, freistehende Bäume/Sträucher
  | 'kuebel'       // Großgefäß (Olive, Zitrus)

export type BedKindOption = {
  value: BedKind
  label: string
  icon: string
}

export const BED_KINDS: ReadonlyArray<BedKindOption> = [
  { value: 'beet',         label: 'Beet',          icon: '🟫' },
  { value: 'hochbeet',     label: 'Hochbeet',      icon: '📦' },
  { value: 'gewaechshaus', label: 'Gewächshaus',   icon: '🏠' },
  { value: 'topf',         label: 'Topf außen',    icon: '🪴' },
  { value: 'topf_innen',   label: 'Fensterbank',   icon: '🪟' },
  { value: 'hydroponik',   label: 'Hydroponik',    icon: '💧' },
  { value: 'rasen',        label: 'Rasen / Wiese', icon: '🌳' },
  { value: 'kuebel',       label: 'Kübel',         icon: '🏺' },
]

export const VALID_BED_KINDS: BedKind[] = BED_KINDS.map((k) => k.value)

export function isBedKind(value: string): value is BedKind {
  return (VALID_BED_KINDS as string[]).includes(value)
}

export function bedKindLabel(value: string): string {
  return BED_KINDS.find((k) => k.value === value)?.label ?? value
}

export function bedKindIcon(value: string): string {
  return BED_KINDS.find((k) => k.value === value)?.icon ?? '🟫'
}
