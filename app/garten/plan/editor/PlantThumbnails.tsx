'use client'

import { Group, Image as KonvaImage, Rect, Text } from 'react-konva'
import useImage from 'use-image'

export type ThumbPlanting = {
  id: string
  plant_id: string
  plant_name: string
  plant_illustration_url: string | null
  /** Greyed out (harvested or not yet planted). */
  dim?: boolean
}

type Props = {
  bedW: number
  bedH: number
  plantings: ThumbPlanting[]
}

const MAX_VISIBLE = 3
const MAX_THUMB = 44
const MIN_THUMB = 22
/** Vertical anchor inside the bed (0 = top, 1 = bottom). */
const ROW_Y_FRAC = 0.62
const PADDING_X = 6

/**
 * Renders 1–3 plant thumbnails in a horizontal row centered in the bed.
 * Hides itself when the bed is too small to render at MIN_THUMB px.
 */
export default function PlantThumbnails({ bedW, bedH, plantings }: Props) {
  if (plantings.length === 0) return null

  const visible = plantings.slice(0, MAX_VISIBLE)
  const overflow = plantings.length - visible.length

  // Compute thumb size that fits inside the bed
  const slots = visible.length + (overflow > 0 ? 1 : 0)
  const innerW = Math.max(0, bedW - PADDING_X * 2)
  const sizeByWidth = innerW / slots - 4
  const sizeByHeight = bedH * 0.32
  const size = Math.max(0, Math.min(MAX_THUMB, sizeByWidth, sizeByHeight))

  if (size < MIN_THUMB) return null

  const totalW = size * slots + 4 * (slots - 1)
  const startX = (bedW - totalW) / 2
  const y = bedH * ROW_Y_FRAC - size / 2

  return (
    <Group listening={false}>
      {visible.map((p, i) => (
        <PlantThumbnail
          key={p.id}
          src={p.plant_illustration_url}
          name={p.plant_name}
          dim={p.dim}
          x={startX + i * (size + 4)}
          y={y}
          size={size}
        />
      ))}
      {overflow > 0 && (
        <OverflowBadge
          x={startX + visible.length * (size + 4)}
          y={y}
          size={size}
          count={overflow}
        />
      )}
    </Group>
  )
}

function PlantThumbnail({
  src,
  name,
  dim,
  x,
  y,
  size,
}: {
  src: string | null
  name: string
  dim?: boolean
  x: number
  y: number
  size: number
}) {
  const [img] = useImage(src ?? '', 'anonymous')

  if (!src || !img) {
    return (
      <Group x={x} y={y} listening={false} opacity={dim ? 0.45 : 1}>
        <Rect
          width={size}
          height={size}
          cornerRadius={size / 4}
          fill="#FFFFFF"
          stroke="#E8E6DF"
          strokeWidth={1}
        />
        <Text
          text={initials(name)}
          width={size}
          height={size}
          align="center"
          verticalAlign="middle"
          fontSize={Math.max(10, size * 0.4)}
          fontStyle="600"
          fill="#888780"
        />
      </Group>
    )
  }

  return (
    <Group x={x} y={y} listening={false} opacity={dim ? 0.45 : 1}>
      <Rect
        width={size}
        height={size}
        cornerRadius={size / 4}
        fill="#FFFFFF"
        stroke="#E8E6DF"
        strokeWidth={1}
      />
      <KonvaImage
        image={img}
        x={1}
        y={1}
        width={size - 2}
        height={size - 2}
        cornerRadius={size / 4 - 1}
      />
    </Group>
  )
}

function OverflowBadge({
  x,
  y,
  size,
  count,
}: {
  x: number
  y: number
  size: number
  count: number
}) {
  return (
    <Group x={x} y={y} listening={false}>
      <Rect
        width={size}
        height={size}
        cornerRadius={size / 4}
        fill="#FFFFFF"
        stroke="#E8E6DF"
        strokeWidth={1}
      />
      <Text
        text={`+${count}`}
        width={size}
        height={size}
        align="center"
        verticalAlign="middle"
        fontSize={Math.max(11, size * 0.42)}
        fontStyle="600"
        fill="#4A7C59"
      />
    </Group>
  )
}

function initials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return trimmed.slice(0, 2).toUpperCase()
}
