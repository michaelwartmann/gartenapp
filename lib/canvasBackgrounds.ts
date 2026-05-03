/**
 * Stage 8.1 — Skizzen-Hintergründe.
 *
 * Single source of truth for the curated background themes. Keys are
 * stored in `gardens.background_key` (NULL = `default`). Adding a new
 * theme: drop the PNG into `public/garten-bg/`, add an entry here.
 *
 * `path` is a public Next.js asset path. `opacity` lets each theme have
 * its own visual weight on the canvas (busier patterns = lower opacity).
 */

export type CanvasBackgroundKey =
  | 'default'
  | 'erde'
  | 'wiese'
  | 'holz'
  | 'aquarell'
  | 'stein'
  | 'botanik'
  /** Stage 5C — User-uploaded photo, URL + opacity stored on the garden row. */
  | 'custom'

export type CanvasBackground = {
  key: CanvasBackgroundKey
  label: string
  emoji: string
  /** null = no image, render the canvas in solid #FAFAF7 (Stage 5B default). */
  path: string | null
  /** Visual weight 0–1. Beds always need to stand out, so we stay subtle. */
  opacity: number
}

export const CANVAS_BACKGROUNDS: CanvasBackground[] = [
  {
    key: 'default',
    label: 'Standard',
    emoji: '⬜',
    path: null,
    opacity: 0,
  },
  {
    key: 'erde',
    label: 'Erde',
    emoji: '🟫',
    path: '/garten-bg/erde.webp',
    opacity: 0.45,
  },
  {
    key: 'wiese',
    label: 'Wiese',
    emoji: '🌱',
    path: '/garten-bg/wiese.webp',
    opacity: 0.45,
  },
  {
    key: 'holz',
    label: 'Holzdielen',
    emoji: '🪵',
    path: '/garten-bg/holz.webp',
    opacity: 0.4,
  },
  {
    key: 'aquarell',
    label: 'Pastell',
    emoji: '🎨',
    path: '/garten-bg/aquarell.webp',
    opacity: 0.55,
  },
  {
    key: 'stein',
    label: 'Steingarten',
    emoji: '🪨',
    path: '/garten-bg/stein.webp',
    opacity: 0.4,
  },
  {
    key: 'botanik',
    label: 'Botanik',
    emoji: '🌿',
    path: '/garten-bg/botanik.webp',
    opacity: 0.35,
  },
]

const BG_BY_KEY = new Map<CanvasBackgroundKey, CanvasBackground>(
  CANVAS_BACKGROUNDS.map((b) => [b.key, b])
)

const VALID_KEYS = new Set<string>(CANVAS_BACKGROUNDS.map((b) => b.key))

/** Stage 5C — runtime-only fallback opacity for custom photos. */
export const CUSTOM_BACKGROUND_DEFAULT_OPACITY = 0.55

export function isValidBackgroundKey(s: string): s is CanvasBackgroundKey {
  return VALID_KEYS.has(s) || s === 'custom'
}

export function backgroundFor(key: string | null | undefined): CanvasBackground {
  if (!key) return BG_BY_KEY.get('default')!
  const bg = BG_BY_KEY.get(key as CanvasBackgroundKey)
  return bg ?? BG_BY_KEY.get('default')!
}

/**
 * Stage 5C — assemble a CanvasBackground for a user-uploaded photo.
 * The image lives in Supabase Storage; URL + opacity come from the
 * `gardens` row. Used by CanvasBackground when key === 'custom'.
 */
export function customBackground(
  url: string,
  opacity: number | null | undefined
): CanvasBackground {
  const op =
    typeof opacity === 'number' && opacity >= 0 && opacity <= 1
      ? opacity
      : CUSTOM_BACKGROUND_DEFAULT_OPACITY
  return {
    key: 'custom',
    label: 'Eigenes Foto',
    emoji: '📸',
    path: url,
    opacity: op,
  }
}
