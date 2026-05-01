'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  addPlantingToBed,
  getRotationAdvice,
  listAvailablePlants,
  type AvailablePlant,
  type GardenStatus,
  type AddPlantingSeason,
} from './actions'
import type { RotationAdvice } from '@/lib/recommendRotation'

type Props = {
  bedId: string
  bedLabel: string
  season: AddPlantingSeason
  onClose: () => void
}

const CATEGORY_BG: Record<string, string> = {
  Gemüse: '#4A7C59',
  Kraut: '#C17B5C',
  Blume: '#8B5A95',
  Obst: '#D49C3D',
}

function statusBadge(s: GardenStatus): { bg: string; fg: string; label: string } {
  if (s === 'interested')
    return { bg: '#F0EDE4', fg: '#4A7C59', label: '📦 Hab Samen' }
  if (s === 'planted')
    return { bg: '#E8F1EA', fg: '#4A7C59', label: '🌱 Im Garten' }
  return { bg: '#F0EFEA', fg: '#888780', label: '🛒 Kaufe Samen' }
}

function statusRank(s: GardenStatus): number {
  if (s === 'interested') return 0
  if (s === 'planted') return 1
  return 2
}

function verdictPill(v: RotationAdvice['verdict']) {
  if (v === 'gut') return { bg: '#E8F1EA', fg: '#4A7C59', label: 'PASST GUT' }
  if (v === 'schlecht')
    return { bg: '#FDE8E2', fg: '#C17B5C', label: 'LIEBER NICHT' }
  return { bg: '#F0EFEA', fg: '#888780', label: 'OKAY' }
}

export default function AddPlantSheet({
  bedId,
  bedLabel,
  season,
  onClose,
}: Props) {
  const [plants, setPlants] = useState<AvailablePlant[] | null>(null)
  const [query, setQuery] = useState('')
  const [hideOthers, setHideOthers] = useState(true)
  const [selected, setSelected] = useState<AvailablePlant | null>(null)
  const [advice, setAdvice] = useState<RotationAdvice | null>(null)
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isLastYear = season === 'last_year'

  useEffect(() => {
    let cancelled = false
    listAvailablePlants().then((rows) => {
      if (!cancelled) setPlants(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // No rotation advice for last-year inserts — that's just history.
    if (isLastYear || !selected) {
      setAdvice(null)
      return
    }
    let cancelled = false
    setAdvice(null)
    setAdviceLoading(true)
    getRotationAdvice(bedId, selected.id)
      .then((res) => {
        if (cancelled) return
        if ('ok' in res) setAdvice(res.advice)
        else
          setAdvice({
            verdict: 'okay',
            reason: 'Konnte gerade keine Einschätzung laden.',
          })
      })
      .finally(() => {
        if (!cancelled) setAdviceLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [bedId, selected, isLastYear])

  const filtered = useMemo(() => {
    if (!plants) return []
    const q = query.trim().toLowerCase()
    let list = plants
    if (q) {
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    } else if (hideOthers && !isLastYear) {
      list = list.filter((p) => p.gardenStatus !== 'none')
    }
    return [...list].sort((a, b) => {
      const r = statusRank(a.gardenStatus) - statusRank(b.gardenStatus)
      if (r !== 0) return r
      return a.name.localeCompare(b.name, 'de')
    })
  }, [plants, query, hideOthers, isLastYear])

  function confirmAdd() {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      const res = await addPlantingToBed(bedId, selected.id, season)
      if ('error' in res) {
        setError('Konnte nicht hinzufügen.')
        return
      }
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(44, 44, 42, 0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col"
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
              {isLastYear ? 'Letztes Jahr im Beet' : 'Pflanze ins Beet'}
            </p>
            <p
              className="text-base font-medium truncate"
              style={{ color: '#2C2C2A' }}
            >
              {bedLabel}
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

        {selected ? (
          <div className="p-4 space-y-4 overflow-y-auto">
            <div
              className="rounded-xl border p-3 flex items-center gap-3"
              style={{ borderColor: '#E8E6DF', backgroundColor: '#FAFAF7' }}
            >
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl shrink-0"
                style={{
                  backgroundColor:
                    (CATEGORY_BG[selected.category] ?? '#888780') + '22',
                }}
              >
                🌱
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-base" style={{ color: '#2C2C2A' }}>
                  {selected.name}
                </p>
                <p className="text-xs" style={{ color: '#888780' }}>
                  {selected.category}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-sm underline touch-manipulation"
                style={{ color: '#888780' }}
              >
                ändern
              </button>
            </div>

            {!isLastYear && (
              <div
                className="rounded-xl border p-3"
                style={{ borderColor: '#E8E6DF' }}
              >
                <p
                  className="text-xs uppercase tracking-wide font-medium mb-2"
                  style={{ color: '#888780' }}
                >
                  Fruchtfolge-Tipp
                </p>
                {adviceLoading || !advice ? (
                  <p className="text-sm" style={{ color: '#888780' }}>
                    Wird geprüft …
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      const pill = verdictPill(advice.verdict)
                      return (
                        <span
                          className="inline-block text-[10px] font-semibold uppercase tracking-wide rounded px-2 py-1"
                          style={{ backgroundColor: pill.bg, color: pill.fg }}
                        >
                          {pill.label}
                        </span>
                      )
                    })()}
                    <p
                      className="text-sm leading-snug"
                      style={{ color: '#2C2C2A' }}
                    >
                      {advice.reason}
                    </p>
                  </div>
                )}
              </div>
            )}

            {selected.gardenStatus === 'none' && !isLastYear && (
              <p
                className="text-xs leading-snug"
                style={{ color: '#888780' }}
              >
                Du hast {selected.name} noch nicht im Garten — wenn du ihn ins
                Beet planst, landet er automatisch auch in „Meine Samen".
              </p>
            )}

            {error && (
              <p className="text-sm" style={{ color: '#C17B5C' }}>
                {error}
              </p>
            )}

            <button
              onClick={confirmAdd}
              disabled={pending}
              className="w-full py-4 rounded-xl text-white font-medium text-base min-h-[56px] touch-manipulation disabled:opacity-60"
              style={{ backgroundColor: '#4A7C59' }}
            >
              {pending
                ? '…'
                : isLastYear
                ? 'Als Vorjahres-Pflanze hinzufügen'
                : 'Ins Beet planen'}
            </button>
          </div>
        ) : (
          <>
            <div className="p-4 pb-2 space-y-3">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pflanze suchen …"
                className="w-full px-4 py-3 rounded-lg border bg-white text-base min-h-[48px]"
                style={{ borderColor: '#E8E6DF', color: '#2C2C2A' }}
                autoFocus
              />
              {!isLastYear && !query.trim() && (
                <button
                  onClick={() => setHideOthers((v) => !v)}
                  className="text-xs underline touch-manipulation"
                  style={{ color: '#888780' }}
                >
                  {hideOthers
                    ? 'Auch Pflanzen aus dem Katalog zeigen'
                    : 'Nur meine Samen + Garten zeigen'}
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1 px-4 pb-4">
              {!plants ? (
                <p
                  className="text-sm text-center py-8"
                  style={{ color: '#888780' }}
                >
                  Lade Pflanzen …
                </p>
              ) : filtered.length === 0 ? (
                <p
                  className="text-sm text-center py-8"
                  style={{ color: '#888780' }}
                >
                  Keine Treffer.
                </p>
              ) : (
                <div className="space-y-2">
                  {filtered.map((p) => {
                    const badge = statusBadge(p.gardenStatus)
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelected(p)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border bg-white touch-manipulation"
                        style={{ borderColor: '#E8E6DF' }}
                      >
                        <div
                          className="w-10 h-10 rounded-md flex items-center justify-center text-lg shrink-0"
                          style={{
                            backgroundColor:
                              (CATEGORY_BG[p.category] ?? '#888780') + '22',
                          }}
                        >
                          🌱
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p
                            className="text-sm font-medium leading-tight"
                            style={{ color: '#2C2C2A' }}
                          >
                            {p.name}
                          </p>
                          <p
                            className="text-xs leading-tight"
                            style={{ color: '#888780' }}
                          >
                            {p.category}
                          </p>
                        </div>
                        <span
                          className="text-[10px] font-medium rounded px-2 py-1 whitespace-nowrap shrink-0"
                          style={{
                            backgroundColor: badge.bg,
                            color: badge.fg,
                          }}
                        >
                          {badge.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
