'use client'

import { Group, Image as KonvaImage, Rect } from 'react-konva'
import useImage from 'use-image'
import { CANVAS_W, CANVAS_H } from './autoLayout'
import { backgroundFor, customBackground } from '@/lib/canvasBackgrounds'

type Props = {
  /** Stored key from `gardens.background_key` (NULL → 'default'). */
  backgroundKey: string | null
  /** Stage 5C — when key='custom', this URL is used. */
  customUrl?: string | null
  /** Stage 5C — user-controlled opacity for custom photo (0..1). */
  customOpacity?: number | null
}

/**
 * Bottom Konva layer that paints the chosen theme — Stage 8.1 added the
 * 6 curated themes; Stage 5C added user-uploaded photos under key='custom'
 * (URL + opacity sit on the garden row instead of the static lookup).
 *
 * Uses `cover`-style fitting (canvas is taller than the source square; we
 * crop the sides instead of stretching).
 */
export default function CanvasBackground({
  backgroundKey,
  customUrl,
  customOpacity,
}: Props) {
  const bg =
    backgroundKey === 'custom' && customUrl
      ? customBackground(customUrl, customOpacity ?? null)
      : backgroundFor(backgroundKey)
  const [img] = useImage(bg.path ?? '', 'anonymous')

  if (!bg.path) {
    return (
      <Rect
        width={CANVAS_W}
        height={CANVAS_H}
        fill="#FAFAF7"
        listening={false}
      />
    )
  }

  if (!img) {
    // Solid base while the image loads, so the canvas isn't transparent
    return (
      <Rect
        width={CANVAS_W}
        height={CANVAS_H}
        fill="#FAFAF7"
        listening={false}
      />
    )
  }

  const ratio = Math.max(CANVAS_W / img.width, CANVAS_H / img.height)
  const drawW = img.width * ratio
  const drawH = img.height * ratio
  const offX = (CANVAS_W - drawW) / 2
  const offY = (CANVAS_H - drawH) / 2

  return (
    <Group listening={false}>
      <Rect width={CANVAS_W} height={CANVAS_H} fill="#FAFAF7" />
      <KonvaImage
        image={img}
        x={offX}
        y={offY}
        width={drawW}
        height={drawH}
        opacity={bg.opacity}
      />
    </Group>
  )
}
