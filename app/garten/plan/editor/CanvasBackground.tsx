'use client'

import { Group, Image as KonvaImage, Rect } from 'react-konva'
import useImage from 'use-image'
import { CANVAS_W, CANVAS_H } from './autoLayout'
import { backgroundFor } from '@/lib/canvasBackgrounds'

type Props = {
  /** Stored key from `gardens.background_key` (NULL → 'default'). */
  backgroundKey: string | null
}

/**
 * Stage 8.1 — bottom Konva layer that paints the curated theme behind
 * the beds. Uses `cover`-style fitting (canvas is taller than the source
 * square; we crop the sides instead of stretching).
 */
export default function CanvasBackground({ backgroundKey }: Props) {
  const bg = backgroundFor(backgroundKey)
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
    // Solid base while the WebP loads, so the canvas isn't transparent
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
