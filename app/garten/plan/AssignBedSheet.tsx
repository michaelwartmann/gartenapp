'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import {
  addPlantingToBed,
  getPlantSuitableBedKinds,
  listBedsForGarden,
  markBedPlantingAsPlanted,
  type BedView,
} from './actions'
import { bedKindIcon, bedKindLabel } from '@/lib/bedKinds'

type Props = {
  plantId: string
  plantName: string
  /**
   * Bed-kinds that suit this plant. Used only for sorting + visual hint —
   * any bed can still be picked. `null` means "we don't know yet" (e.g.
   * Gemini hasn't run for this freshly-added plant), in which case all
   * beds are shown neutrally.
   */
  suitableBedKinds: string[] | null
  /** Called after assign or skip. */
  onClose: () => void
}

type SortedBed = {
  id: string
  label: string
  kind: string
  fits: boolean
}

export default function AssignBedSheet({
  plantId,
  plantName,
  suitableBedKinds,
  onClose,
}: Props) {
  const [bedsLoading, setBedsLoading] = useState(true)
  const [bedsRaw, setBedsRaw] = useState<BedView[] | null>(null)
  const [pending, startTransition] = useTransition()
  const [busyBedId, setBusyBedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Live-tracked. If we open with null (fresh plant — Gemini still running
  // in the after()-hook on the server), poll the row until kinds appear.
  const [effectiveKinds, setEffectiveKinds] = useState<string[] | null>(
    suitableBedKinds
  )
  const [polling, setPolling] = useState(false)

  // Load beds once.
  useEffect(() => {
    let cancelled = false
    listBedsForGarden().then((views: BedView[]) => {
      if (cancelled) return
      setBedsRaw(views)
      setBedsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Polling for suitable_bed_kinds when starting null. Up to 12 attempts
  // every 2.5 s (~30 s window). Stops as soon as a non-null result comes
  // back, or on unmount.
  useEffect(() => {
    if (effectiveKinds !== null) return
    let cancelled = false
    let attempts = 0
    const maxAttempts = 12
    setPolling(true)

    async function tick() {
      if (cancelled) return
      attempts += 1
      try {
        const kinds = await getPlantSuitableBedKinds(plantId)
        if (cancelled) return
        if (kinds && kinds.length > 0) {
          setEffectiveKinds(kinds)
          setPolling(false)
          return
        }
      } catch (err) {
        console.error('AssignBedSheet polling failed:', err)
      }
      if (attempts >= maxAttempts) {
        setPolling(false)
        return
      }
      setTimeout(tick, 2500)
    }

    // First poll after a short delay so Gemini has a moment to start.
    const t0 = setTimeout(tick, 1500)
    return () => {
      cancelled = true
      clearTimeout(t0)
      setPolling(false)
    }
    // We deliberately depend only on plantId. Re-running on
    // effectiveKinds changes would cancel mid-poll once we set it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantId])

  const beds: SortedBed[] = (() => {
    if (!bedsRaw) return []
    const list: SortedBed[] = bedsRaw.map((v) => ({
      id: v.bed.id,
      label: v.bed.label,
      kind: v.bed.kind,
      fits:
        !!effectiveKinds && effectiveKinds.length > 0
          ? effectiveKinds.includes(v.bed.kind)
          : false,
    }))
    if (effectiveKinds && effectiveKinds.length > 0) {
      list.sort((a, b) => {
        if (a.fits === b.fits) return a.label.localeCompare(b.label, 'de')
        return a.fits ? -1 : 1
      })
    }
    return list
  })()

  function assign(bedId: string) {
    setError(null)
    setBusyBedId(bedId)
    startTransition(async () => {
      try {
        const res = await addPlantingToBed(bedId, plantId, 'current')
        if ('error' in res) {
          setError('Konnte nicht zuordnen.')
          setBusyBedId(null)
          return
        }
        // Mark as planted today, so the bed shows ✓ + Mein Garten flips to
        // "Im Garten 🌱" via deriveGlobalPlantedAt.
        await markBedPlantingAsPlanted(res.plantingId)
        onClose()
      } catch (err) {
        console.error('AssignBedSheet assign failed:', err)
        setError('Konnte nicht zuordnen.')
        setBusyBedId(null)
      }
    })
  }

  const showFitMarkers = !!effectiveKinds && effectiveKinds.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(44, 44, 42, 0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{ borderColor: '#E8E6DF' }}
        >
          <div className="min-w-0">
            <p
              className="text-xs uppercase tracking-wide"
              style={{ color: '#888780' }}
            >
              🌿 Wo kommt das hin?
            </p>
            <p
              className="text-base font-medium truncate"
              style={{ color: '#2C2C2A' }}
            >
              {plantName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl px-2 py-1 touch-manipulation shrink-0"
            style={{ color: '#888780' }}
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {bedsLoading ? (
            <p className="text-sm text-center py-6" style={{ color: '#888780' }}>
              Lade Beete …
            </p>
          ) : beds.length === 0 ? (
            <div
              className="rounded-xl border p-4 space-y-2 text-sm leading-snug"
              style={{ borderColor: '#E8E6DF', backgroundColor: '#FAFAF7', color: '#2C2C2A' }}
            >
              <p>Du hast noch keine Beete angelegt.</p>
              <p style={{ color: '#888780' }}>
                <Link
                  href="/garten/plan"
                  className="underline"
                  style={{ color: '#4A7C59' }}
                >
                  → In den Garten-Plan wechseln und ein Beet anlegen
                </Link>
              </p>
              <p style={{ color: '#888780' }}>
                {plantName} bleibt erstmal in deinem Samenvorrat.
              </p>
            </div>
          ) : (
            <>
              {polling && !showFitMarkers && (
                <div
                  className="rounded-lg p-3 text-xs leading-snug flex items-center gap-2"
                  style={{ backgroundColor: '#F0EDE4', color: '#4A7C59' }}
                >
                  <span className="text-base leading-none">✨</span>
                  <span>
                    KI sortiert die Beete gerade nach Eignung — gleich passt&apos;s.
                  </span>
                </div>
              )}
              {showFitMarkers && (
                <p className="text-xs leading-snug" style={{ color: '#888780' }}>
                  Beete mit ✓ passen am besten zu {plantName}.
                </p>
              )}
              {beds.map((b) => (
                <button
                  key={b.id}
                  onClick={() => assign(b.id)}
                  disabled={pending}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border bg-white touch-manipulation disabled:opacity-60"
                  style={{
                    borderColor: '#E8E6DF',
                    opacity: showFitMarkers && !b.fits ? 0.65 : 1,
                  }}
                >
                  <span className="text-2xl shrink-0">{bedKindIcon(b.kind)}</span>
                  <div className="min-w-0 flex-1 text-left">
                    <p
                      className="text-sm font-medium leading-tight"
                      style={{ color: '#2C2C2A' }}
                    >
                      {b.label}
                    </p>
                    <p className="text-xs leading-tight" style={{ color: '#888780' }}>
                      {bedKindLabel(b.kind)}
                    </p>
                  </div>
                  {showFitMarkers && (
                    <span
                      className="text-[10px] font-medium rounded px-2 py-1 whitespace-nowrap shrink-0"
                      style={{
                        backgroundColor: b.fits ? '#E8F1EA' : '#F0EFEA',
                        color: b.fits ? '#4A7C59' : '#888780',
                      }}
                    >
                      {b.fits ? '✓ passt' : '⚠ unüblich'}
                    </span>
                  )}
                  {busyBedId === b.id && pending && (
                    <span className="text-xs" style={{ color: '#888780' }}>
                      …
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
          {error && (
            <p className="text-sm" style={{ color: '#C17B5C' }}>
              {error}
            </p>
          )}
        </div>

        <div
          className="border-t p-3"
          style={{ borderColor: '#E8E6DF' }}
        >
          <button
            onClick={onClose}
            disabled={pending}
            className="w-full py-3 rounded-lg text-base font-medium border min-h-[48px] touch-manipulation"
            style={{ borderColor: '#E8E6DF', color: '#888780', backgroundColor: '#FFFFFF' }}
          >
            Nur in Samenvorrat
          </button>
        </div>
      </div>
    </div>
  )
}
