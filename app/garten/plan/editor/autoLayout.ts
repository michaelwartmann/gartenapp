import type { Bed, BedKind, BedShape } from '@/lib/supabase'

export const CANVAS_W = 480
export const CANVAS_H = 720
export const MIN_BED = 40

const CASCADE = {
  marginX: 30,
  marginY: 30,
  cellW: 200,
  cellH: 120,
  gapX: 20,
  gapY: 20,
  cols: 2,
} as const

const ROUND_KINDS: ReadonlySet<BedKind> = new Set(['topf', 'kuebel'])

export type BedLayout = {
  id: string
  label: string
  kind: BedKind
  x: number
  y: number
  w: number
  h: number
  /** Explicit shape override; null = derive from kind (kindDefaultShape). */
  shape: BedShape | null
  /** Rotation in degrees, 0–360. */
  rotation: number
  /** True if x/y/w/h came from auto-layout (not from DB). Triggers initial dirty flag. */
  autoLaid: boolean
}

export function kindDefaultShape(kind: BedKind): BedShape {
  return ROUND_KINDS.has(kind) ? 'ellipse' : 'rect'
}

export function effectiveShape(layout: { kind: BedKind; shape: BedShape | null }): BedShape {
  return layout.shape ?? kindDefaultShape(layout.kind)
}

/**
 * Hydrates `Bed` rows into editor-ready layouts. Beds with NULL coords are
 * placed in a 2-column cascade (insertion order = created_at). Round kinds
 * (topf, kuebel) get a square default so the ellipse renders as a circle.
 */
export function assignDefaultPositions(beds: Bed[]): BedLayout[] {
  let cascadeIndex = 0
  return beds.map((b) => {
    const hasCoords =
      b.x !== null && b.y !== null && b.w !== null && b.h !== null
    if (hasCoords) {
      return {
        id: b.id,
        label: b.label,
        kind: b.kind,
        x: b.x as number,
        y: b.y as number,
        w: b.w as number,
        h: b.h as number,
        shape: b.shape ?? null,
        rotation: b.rotation ?? 0,
        autoLaid: false,
      }
    }
    const i = cascadeIndex++
    const row = Math.floor(i / CASCADE.cols)
    const col = i % CASCADE.cols
    const x = CASCADE.marginX + col * (CASCADE.cellW + CASCADE.gapX)
    const y = CASCADE.marginY + row * (CASCADE.cellH + CASCADE.gapY)
    const round = (b.shape ?? kindDefaultShape(b.kind)) === 'ellipse'
    const w = round ? Math.min(CASCADE.cellW, CASCADE.cellH) : CASCADE.cellW
    const h = round ? Math.min(CASCADE.cellW, CASCADE.cellH) : CASCADE.cellH
    return {
      id: b.id,
      label: b.label,
      kind: b.kind,
      x,
      y,
      w,
      h,
      shape: b.shape ?? null,
      rotation: b.rotation ?? 0,
      autoLaid: true,
    }
  })
}

export function clampToCanvas(
  layout: { x: number; y: number; w: number; h: number }
): { x: number; y: number; w: number; h: number } {
  const w = Math.max(MIN_BED, Math.min(CANVAS_W, layout.w))
  const h = Math.max(MIN_BED, Math.min(CANVAS_H, layout.h))
  const x = Math.max(0, Math.min(CANVAS_W - w, layout.x))
  const y = Math.max(0, Math.min(CANVAS_H - h, layout.y))
  return { x, y, w, h }
}

export function isRound(kind: BedKind): boolean {
  return ROUND_KINDS.has(kind)
}

export function normalizeRotation(deg: number): number {
  if (!Number.isFinite(deg)) return 0
  let r = deg % 360
  if (r < 0) r += 360
  return r
}
