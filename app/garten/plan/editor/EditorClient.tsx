'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { BedShape } from '@/lib/supabase'
import type { BedView } from '../actions'
import { updateBedLayout } from '../actions'
import {
  assignDefaultPositions,
  effectiveShape,
  kindDefaultShape,
  type BedLayout,
} from './autoLayout'
import BedInlineView from './BedInlineView'
import type { ThumbPlanting } from './PlantThumbnails'
import BackgroundPicker from '../BackgroundPicker'
import AddBedForm from '../AddBedForm'

const BedCanvas = dynamic(() => import('./BedCanvas'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full rounded-xl border flex items-center justify-center"
      style={{
        borderColor: '#E8E6DF',
        backgroundColor: '#FAFAF7',
        height: 360,
        color: '#888780',
      }}
    >
      Skizze wird geladen…
    </div>
  ),
})

type Props = {
  views: BedView[]
  backgroundKey: string | null
}

export default function EditorClient({ views, backgroundKey }: Props) {
  const router = useRouter()
  const beds = useMemo(() => views.map((v) => v.bed), [views])
  const initial = useMemo(() => assignDefaultPositions(beds), [beds])
  const [layouts, setLayouts] = useState<BedLayout[]>(initial)
  const [dirty, setDirty] = useState<boolean>(initial.some((l) => l.autoLaid))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [locked, setLocked] = useState<boolean>(true)
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false)
  const [pendingNewBedId, setPendingNewBedId] = useState<string | null>(null)
  const inlineDetailRef = useRef<HTMLDivElement | null>(null)

  // If beds prop changes (e.g. after add/delete via router.refresh),
  // re-seed layouts so canvas stays in sync. Drops in-flight unsaved drag.
  useEffect(() => {
    setLayouts(initial)
    setDirty(initial.some((l) => l.autoLaid))
  }, [initial])

  // Stage 8.2 — after AddBedForm creates a new bed, the page revalidates and
  // `views` arrives with the new bed in it. Auto-select it so the user sees
  // it on the sketch + in the inline detail (not lost in the cascade).
  useEffect(() => {
    if (!pendingNewBedId) return
    const exists = views.some((v) => v.bed.id === pendingNewBedId)
    if (!exists) return
    setSelectedId(pendingNewBedId)
    setLocked(true)
    setPendingNewBedId(null)
    requestAnimationFrame(() => {
      inlineDetailRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })
  }, [views, pendingNewBedId])

  // Build bedId → ThumbPlanting[] for the canvas (this season's plantings).
  // Greyed if not yet planted (planted_at NULL) or harvested.
  const bedPlantings = useMemo(() => {
    const m = new Map<string, ThumbPlanting[]>()
    for (const v of views) {
      m.set(
        v.bed.id,
        v.current.map((p) => ({
          id: p.id,
          plant_id: p.plant_id,
          plant_name: p.plant_name,
          plant_illustration_url: p.plant_illustration_url,
          dim: !p.planted_at || !!p.removed_at,
        }))
      )
    }
    return m
  }, [views])

  const selected = selectedId
    ? layouts.find((l) => l.id === selectedId) ?? null
    : null

  const selectedView = selectedId
    ? views.find((v) => v.bed.id === selectedId) ?? null
    : null

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    if (!dirty) return
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  function handleChange(next: BedLayout[]) {
    setLayouts(next)
    setDirty(true)
    setSavedFlash(false)
  }

  function setShape(id: string, shape: BedShape) {
    setLayouts((prev) =>
      prev.map((l) => (l.id === id ? { ...l, shape, autoLaid: false } : l))
    )
    setDirty(true)
    setSavedFlash(false)
  }

  function resetRotation(id: string) {
    setLayouts((prev) =>
      prev.map((l) => (l.id === id ? { ...l, rotation: 0, autoLaid: false } : l))
    )
    setDirty(true)
    setSavedFlash(false)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const updates = layouts.map((l) => ({
        id: l.id,
        x: Math.round(l.x),
        y: Math.round(l.y),
        w: Math.round(l.w),
        h: Math.round(l.h),
        shape: l.shape,
        rotation: Math.round(l.rotation),
      }))
      const res = await updateBedLayout(updates)
      if ('error' in res) {
        setError(
          res.error === 'no-garden'
            ? 'Bitte erneut anmelden.'
            : 'Konnte nicht speichern. Versuch es nochmal.'
        )
        return
      }
      setDirty(false)
      setSavedFlash(true)
      setLocked(true)
      setTimeout(() => setSavedFlash(false), 1500)
      router.refresh()
    })
  }

  function handleDiscard() {
    setLayouts(initial)
    setDirty(initial.some((l) => l.autoLaid))
    setError(null)
    setLocked(true)
  }

  function handleToggleLock() {
    if (locked) {
      setLocked(false)
      return
    }
    if (dirty) {
      // Don't silently throw away edits — surface a confirm via discard button.
      return
    }
    setLocked(true)
  }

  return (
    <div
      className="min-h-screen px-4 py-6 pb-12"
      style={{ backgroundColor: '#FAFAF7' }}
    >
      <div className="w-full max-w-md mx-auto">
        <header className="mb-3 flex items-center justify-between gap-2">
          <Link
            href="/"
            className="text-sm font-medium shrink-0"
            style={{ color: '#4A7C59' }}
          >
            ← Mein Garten
          </Link>
          <h1
            className="text-base font-medium text-center flex-1"
            style={{ color: '#2C2C2A' }}
          >
            Garten-Plan
          </h1>
          {locked ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setShowBackgroundPicker(true)}
                className="px-2 py-2 rounded-lg text-base touch-manipulation min-h-[40px] border"
                style={{
                  color: '#4A7C59',
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E8E6DF',
                }}
                aria-label="Hintergrund wählen"
                title="Hintergrund"
              >
                🎨
              </button>
              <button
                onClick={handleToggleLock}
                className="px-3 py-2 rounded-lg text-sm font-medium touch-manipulation min-h-[40px] border"
                style={{
                  color: '#4A7C59',
                  backgroundColor: '#F0F5F0',
                  borderColor: '#C9DCC9',
                }}
                aria-label="Skizze bearbeiten"
              >
                ✏️
              </button>
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={pending || !dirty}
              className="px-3 py-2 rounded-lg text-sm font-medium text-white touch-manipulation disabled:opacity-40 shrink-0 min-h-[40px]"
              style={{ backgroundColor: '#4A7C59' }}
            >
              {pending ? '…' : savedFlash ? '✓' : '✓ Speichern'}
            </button>
          )}
        </header>

        {!locked && (
          <p className="text-xs mb-3 leading-relaxed" style={{ color: '#888780' }}>
            Beete antippen, ziehen, am Eck-Griff größer/kleiner. Nochmal antippen
            öffnet die Bearbeitung.
          </p>
        )}

        {error && (
          <div
            className="text-sm mb-3 px-3 py-2 rounded-lg"
            style={{ color: '#C17B5C', backgroundColor: '#FBF2EE' }}
          >
            {error}
          </div>
        )}

        {!locked && dirty && initial.some((l) => l.autoLaid) && (
          <div
            className="text-xs mb-3 px-3 py-2 rounded-lg"
            style={{ color: '#4A7C59', backgroundColor: '#F0F5F0' }}
          >
            Beete wurden automatisch angeordnet — auf „✓ Speichern" tippen, um
            die Skizze zu sichern.
          </div>
        )}

        {!locked && selected && (
          <div className="mb-3 px-3 py-2 rounded-lg flex items-center justify-between gap-2"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E6DF' }}
          >
            <div className="flex items-center gap-1.5 text-xs flex-1 min-w-0">
              <span className="font-medium truncate" style={{ color: '#2C2C2A' }}>
                {selected.label}
              </span>
              <span style={{ color: '#888780' }}>·</span>
              <ShapeToggle
                value={effectiveShape(selected)}
                kindDefault={kindDefaultShape(selected.kind)}
                onChange={(s) => setShape(selected.id, s)}
              />
            </div>
            {Math.round(selected.rotation) !== 0 && (
              <button
                type="button"
                onClick={() => resetRotation(selected.id)}
                className="text-xs px-2 py-1 rounded touch-manipulation shrink-0"
                style={{ color: '#4A7C59', backgroundColor: '#F0F5F0' }}
                title="Drehung zurücksetzen"
              >
                ↺ {Math.round(selected.rotation)}°
              </button>
            )}
          </div>
        )}

        <BedCanvas
          beds={layouts}
          onChange={handleChange}
          onTapBed={(id) => setSelectedId(id)}
          selectedId={selectedId}
          onSelect={setSelectedId}
          locked={locked}
          bedPlantings={bedPlantings}
          backgroundKey={backgroundKey}
        />

        {!locked && dirty && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleDiscard}
              disabled={pending}
              className="text-xs px-3 py-2 rounded touch-manipulation"
              style={{ color: '#888780', backgroundColor: '#F0EFEA' }}
            >
              Verwerfen
            </button>
          </div>
        )}

        {locked && selectedView && (
          <div className="mt-3" ref={inlineDetailRef}>
            <BedInlineView
              key={selectedView.bed.id}
              view={selectedView}
              onDeleted={() => setSelectedId(null)}
            />
          </div>
        )}

        {locked && !selectedId && (
          <p className="text-xs mt-3 text-center" style={{ color: '#888780' }}>
            Tipp ein Beet an, um zu sehen, was darin steht.
          </p>
        )}

        {locked && (
          <div className="mt-6">
            <AddBedForm onAdded={(bedId) => setPendingNewBedId(bedId)} />
          </div>
        )}
      </div>

      {showBackgroundPicker && (
        <BackgroundPicker
          currentKey={backgroundKey}
          onClose={() => setShowBackgroundPicker(false)}
        />
      )}
    </div>
  )
}

function ShapeToggle({
  value,
  kindDefault,
  onChange,
}: {
  value: BedShape
  kindDefault: BedShape
  onChange: (s: BedShape) => void
}) {
  const opts: Array<{ value: BedShape; label: string; icon: string }> = [
    { value: 'rect', label: 'Rechteck', icon: '▭' },
    { value: 'ellipse', label: 'Oval', icon: '◯' },
  ]
  return (
    <div className="flex gap-1">
      {opts.map((o) => {
        const active = o.value === value
        const isDefault = o.value === kindDefault
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="px-2 py-1 rounded text-xs touch-manipulation flex items-center gap-1"
            style={{
              backgroundColor: active ? '#4A7C59' : '#FFFFFF',
              color: active ? '#FFFFFF' : '#888780',
              border: `1px solid ${active ? '#4A7C59' : '#E8E6DF'}`,
            }}
            title={isDefault ? `${o.label} (Standard)` : o.label}
            aria-label={o.label}
            aria-pressed={active}
          >
            <span>{o.icon}</span>
          </button>
        )
      })}
    </div>
  )
}
