'use client'

import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Group, Rect, Ellipse, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { BedKind } from '@/lib/supabase'
import { bedKindIcon } from '@/lib/bedKinds'
import {
  CANVAS_W,
  CANVAS_H,
  MIN_BED,
  clampToCanvas,
  effectiveShape,
  normalizeRotation,
  type BedLayout,
} from './autoLayout'
import PlantThumbnails, { type ThumbPlanting } from './PlantThumbnails'
import CanvasBackground from './CanvasBackground'

type Props = {
  beds: BedLayout[]
  onChange: (next: BedLayout[]) => void
  /** Called when user taps a selected bed in unlocked mode (e.g. open EditBedSheet). */
  onTapBed: (bedId: string) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** When true (default for plan view): no drag, no resize, single tap selects. */
  locked?: boolean
  /** Map bedId → plantings to render as thumbnails on the bed. */
  bedPlantings?: Map<string, ThumbPlanting[]>
  /** Stored garden background key (NULL → no theme). */
  backgroundKey?: string | null
  /** Stage 5C — when key='custom', the photo URL to render. */
  customBackgroundUrl?: string | null
  /** Stage 5C — user-controlled opacity for custom photo (0..1). */
  customBackgroundOpacity?: number | null
}

const BED_FILL: Record<BedKind, string> = {
  beet: '#E8DCC8',
  hochbeet: '#D4C4A8',
  gewaechshaus: '#DCE8DC',
  topf: '#E8D4C4',
  topf_innen: '#F0E8DC',
  hydroponik: '#C8DCE8',
  rasen: '#C8E0C8',
  kuebel: '#D8C8B8',
}

const BED_STROKE = '#4A7C59'
const BED_STROKE_SELECTED = '#C17B5C'

/**
 * Size-adaptive label + kind-icon rendering. Small beds get a smaller
 * font and drop the icon entirely so the label still reads. Tiny beds
 * (≤ ~50 px on either side) fall back to a single character so something
 * shows; the inline detail below the canvas carries the full label.
 */
function BedLabelStack({
  bed,
  hasThumbs,
  thumbs,
}: {
  bed: BedLayout
  hasThumbs: boolean
  thumbs: ThumbPlanting[]
}) {
  const minSide = Math.min(bed.w, bed.h)
  // Hide the kind icon on small beds — it eats space the label needs.
  const showIcon = minSide >= 70
  // Drop label font size as bed shrinks.
  const labelFs = minSide < 60 ? 10 : minSide < 90 ? 12 : 14
  // Use the planting count as a quick visual hint when label is tiny.
  const tooSmallForLabel = bed.w < 50 || bed.h < 36

  if (tooSmallForLabel) {
    // Just a tiny indicator — full label sits in the inline detail below
    return (
      <Text
        text={bed.label.slice(0, 2)}
        x={0}
        y={bed.h / 2 - 6}
        width={bed.w}
        align="center"
        fontSize={10}
        fontStyle="600"
        fill="#888780"
      />
    )
  }

  if (hasThumbs) {
    // Label at top (next to icon if room), thumbs render below in a sibling node
    const labelX = showIcon ? 32 : 6
    const labelW = showIcon ? bed.w - 40 : bed.w - 12
    return (
      <>
        {showIcon && (
          <Text
            text={bedKindIcon(bed.kind)}
            x={8}
            y={6}
            fontSize={18}
            listening={false}
          />
        )}
        <Text
          text={bed.label}
          x={labelX}
          y={showIcon ? 10 : 8}
          width={labelW}
          ellipsis
          wrap="none"
          fontSize={Math.min(13, labelFs)}
          fontStyle="500"
          fill="#2C2C2A"
        />
      </>
    )
  }

  // No thumbs — center the label vertically; icon top-left if there's room
  return (
    <>
      {showIcon && (
        <Text
          text={bedKindIcon(bed.kind)}
          x={8}
          y={6}
          fontSize={18}
          listening={false}
        />
      )}
      <Text
        text={bed.label}
        x={0}
        y={bed.h / 2 - labelFs / 2 - 1}
        width={bed.w}
        align="center"
        ellipsis
        wrap="none"
        fontSize={labelFs}
        fontStyle="500"
        fill="#2C2C2A"
      />
    </>
  )
}

export default function BedCanvas({
  beds,
  onChange,
  onTapBed,
  selectedId,
  onSelect,
  locked = false,
  bedPlantings,
  backgroundKey = null,
  customBackgroundUrl = null,
  customBackgroundOpacity = null,
}: Props) {
  const transformerRef = useRef<Konva.Transformer | null>(null)
  const groupRefs = useRef<Map<string, Konva.Group>>(new Map())
  const stageRef = useRef<Konva.Stage | null>(null)
  const [scale, setScale] = useState(1)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  // Responsive scale: keep CANVAS_W as the logical width but shrink for narrow screens
  useEffect(() => {
    function recompute() {
      const wrap = wrapperRef.current
      if (!wrap) return
      const available = wrap.clientWidth
      const next = Math.min(1, available / CANVAS_W)
      setScale(next > 0 ? next : 1)
    }
    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [])

  // Wire transformer to selected node (only mounted in unlocked mode)
  useEffect(() => {
    const tr = transformerRef.current
    if (!tr) return
    if (locked || !selectedId) {
      tr.nodes([])
      tr.getLayer()?.batchDraw()
      return
    }
    const node = groupRefs.current.get(selectedId)
    if (node) {
      tr.nodes([node])
      tr.getLayer()?.batchDraw()
    } else {
      tr.nodes([])
    }
  }, [selectedId, beds, locked])

  function patchBed(id: string, patch: Partial<BedLayout>) {
    onChange(
      beds.map((b) => {
        if (b.id !== id) return b
        const merged = { ...b, ...patch, autoLaid: false }
        const clamped = clampToCanvas(merged)
        return { ...merged, ...clamped }
      })
    )
  }

  return (
    <div
      ref={wrapperRef}
      className="w-full"
      style={{ touchAction: locked ? 'manipulation' : 'none' }}
    >
      <Stage
        ref={(node) => {
          stageRef.current = node
        }}
        width={CANVAS_W * scale}
        height={CANVAS_H * scale}
        scaleX={scale}
        scaleY={scale}
        onMouseDown={(e) => {
          // Click on empty stage → deselect
          if (e.target === e.target.getStage()) onSelect(null)
        }}
        onTouchStart={(e) => {
          if (e.target === e.target.getStage()) onSelect(null)
        }}
        style={{
          border: '1px solid #E8E6DF',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <Layer listening={false}>
          <CanvasBackground
            backgroundKey={backgroundKey}
            customUrl={customBackgroundUrl}
            customOpacity={customBackgroundOpacity}
          />
        </Layer>
        <Layer>
          {beds.map((bed) => {
            const shape = effectiveShape(bed)
            const isSel = bed.id === selectedId
            const thumbs = bedPlantings?.get(bed.id) ?? []
            const hasThumbs = thumbs.length > 0
            return (
              <Group
                key={bed.id}
                ref={(node) => {
                  if (node) groupRefs.current.set(bed.id, node)
                  else groupRefs.current.delete(bed.id)
                }}
                x={bed.x}
                y={bed.y}
                rotation={bed.rotation}
                draggable={!locked}
                dragDistance={4}
                dragBoundFunc={(pos) => {
                  // pos is in stage (scaled) coords; convert via scale.
                  // Rotation makes precise bounds tricky — clamp the
                  // top-left of the (still axis-aligned) bounding box.
                  const lx = pos.x / scale
                  const ly = pos.y / scale
                  const cx = Math.max(0, Math.min(CANVAS_W - bed.w, lx))
                  const cy = Math.max(0, Math.min(CANVAS_H - bed.h, ly))
                  return { x: cx * scale, y: cy * scale }
                }}
                onDragStart={() => {
                  onSelect(bed.id)
                }}
                onDragEnd={(e) => {
                  patchBed(bed.id, { x: e.target.x(), y: e.target.y() })
                }}
                onClick={() => {
                  if (locked) {
                    onSelect(bed.id)
                  } else if (selectedId === bed.id) {
                    onTapBed(bed.id)
                  } else {
                    onSelect(bed.id)
                  }
                }}
                onTap={() => {
                  if (locked) {
                    onSelect(bed.id)
                  } else if (selectedId === bed.id) {
                    onTapBed(bed.id)
                  } else {
                    onSelect(bed.id)
                  }
                }}
                onTransformEnd={(e) => {
                  const node = e.target as Konva.Group
                  const sx = node.scaleX()
                  const sy = node.scaleY()
                  const newW = Math.max(MIN_BED, bed.w * sx)
                  const newH = Math.max(MIN_BED, bed.h * sy)
                  const newRot = normalizeRotation(node.rotation())
                  // Reset scale, persist as w/h + rotation
                  node.scaleX(1)
                  node.scaleY(1)
                  patchBed(bed.id, {
                    x: node.x(),
                    y: node.y(),
                    w: newW,
                    h: newH,
                    rotation: newRot,
                  })
                }}
              >
                {shape === 'ellipse' ? (
                  <Ellipse
                    x={bed.w / 2}
                    y={bed.h / 2}
                    radiusX={bed.w / 2}
                    radiusY={bed.h / 2}
                    fill={BED_FILL[bed.kind]}
                    stroke={isSel ? BED_STROKE_SELECTED : BED_STROKE}
                    strokeWidth={isSel ? 2.5 : 1.5}
                  />
                ) : (
                  <Rect
                    width={bed.w}
                    height={bed.h}
                    fill={BED_FILL[bed.kind]}
                    stroke={isSel ? BED_STROKE_SELECTED : BED_STROKE}
                    strokeWidth={isSel ? 2.5 : 1.5}
                    cornerRadius={8}
                  />
                )}
                <BedLabelStack
                  bed={bed}
                  hasThumbs={hasThumbs}
                  thumbs={thumbs}
                />
                {hasThumbs && (
                  <PlantThumbnails
                    bedW={bed.w}
                    bedH={bed.h}
                    plantings={thumbs}
                  />
                )}
              </Group>
            )
          })}
          {!locked && (
            <Transformer
              ref={(node) => {
                transformerRef.current = node
              }}
              enabledAnchors={['bottom-right']}
              rotateEnabled
              rotateAnchorOffset={28}
              anchorSize={22}
              anchorCornerRadius={4}
              anchorStroke={BED_STROKE_SELECTED}
              anchorFill="#FFFFFF"
              borderStroke={BED_STROKE_SELECTED}
              borderDash={[4, 4]}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < MIN_BED || newBox.height < MIN_BED) return oldBox
                if (newBox.x < 0 || newBox.y < 0) return oldBox
                if (newBox.x + newBox.width > CANVAS_W * scale) return oldBox
                if (newBox.y + newBox.height > CANVAS_H * scale) return oldBox
                return newBox
              }}
            />
          )}
        </Layer>
      </Stage>
    </div>
  )
}
