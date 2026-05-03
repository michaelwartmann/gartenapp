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

type Box = { x: number; y: number; w: number; h: number }

function rectsOverlap(a: Box, b: Box): boolean {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  )
}

function findCascadeSlot(
  occupied: Box[],
  w: number,
  h: number
): { x: number; y: number } | null {
  // Try cascade slots in row-major order, take the first that doesn't overlap.
  // 2 cols × N rows; bound by canvas height.
  const maxRows = Math.floor(
    (CANVAS_H - CASCADE.marginY) / (CASCADE.cellH + CASCADE.gapY)
  ) + 1
  for (let i = 0; i < maxRows * CASCADE.cols; i++) {
    const row = Math.floor(i / CASCADE.cols)
    const col = i % CASCADE.cols
    const x = CASCADE.marginX + col * (CASCADE.cellW + CASCADE.gapX)
    const y = CASCADE.marginY + row * (CASCADE.cellH + CASCADE.gapY)
    if (x + w > CANVAS_W || y + h > CANVAS_H) continue
    const candidate = { x, y, w, h }
    if (occupied.every((o) => !rectsOverlap(candidate, o))) {
      return { x, y }
    }
  }
  return null
}

function placeBelowAll(
  occupied: Box[],
  w: number,
  h: number
): { x: number; y: number } {
  // Fallback: stack below the lowest existing bed, centered horizontally.
  const lowest = occupied.reduce((max, o) => Math.max(max, o.y + o.h), 0)
  const y = Math.min(CANVAS_H - h, lowest + 20)
  const x = Math.max(0, Math.min(CANVAS_W - w, (CANVAS_W - w) / 2))
  return { x, y }
}

/**
 * Hydrates `Bed` rows into editor-ready layouts. Beds with NULL coords are
 * placed via overlap-aware cascade (Stage 8.2 fix): we collect all already-
 * positioned beds first, then for each new bed try cascade slots in order,
 * skipping any that would collide. If no slot fits, stack the new bed below
 * everything centered. Round kinds (topf, kuebel) get a square default so
 * the ellipse renders as a circle.
 */
export function assignDefaultPositions(beds: Bed[]): BedLayout[] {
  // Pass 1 — separate beds with vs without coords
  const withCoords: BedLayout[] = []
  const withoutCoords: Bed[] = []
  for (const b of beds) {
    const hasCoords =
      b.x !== null && b.y !== null && b.w !== null && b.h !== null
    if (hasCoords) {
      withCoords.push({
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
      })
    } else {
      withoutCoords.push(b)
    }
  }

  // Pass 2 — place each unpositioned bed where it doesn't collide
  const occupied: Box[] = withCoords.map((l) => ({
    x: l.x,
    y: l.y,
    w: l.w,
    h: l.h,
  }))
  const newlyPlaced: BedLayout[] = []
  for (const b of withoutCoords) {
    const round = (b.shape ?? kindDefaultShape(b.kind)) === 'ellipse'
    const w = round ? Math.min(CASCADE.cellW, CASCADE.cellH) : CASCADE.cellW
    const h = round ? Math.min(CASCADE.cellW, CASCADE.cellH) : CASCADE.cellH
    const slot =
      findCascadeSlot(occupied, w, h) ?? placeBelowAll(occupied, w, h)
    occupied.push({ x: slot.x, y: slot.y, w, h })
    newlyPlaced.push({
      id: b.id,
      label: b.label,
      kind: b.kind,
      x: slot.x,
      y: slot.y,
      w,
      h,
      shape: b.shape ?? null,
      rotation: b.rotation ?? 0,
      autoLaid: true,
    })
  }

  // Preserve original beds order so the canvas/inline-detail listings line up.
  const byId = new Map<string, BedLayout>(
    [...withCoords, ...newlyPlaced].map((l) => [l.id, l])
  )
  return beds.map((b) => byId.get(b.id)!).filter(Boolean)
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
