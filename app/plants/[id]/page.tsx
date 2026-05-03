'use client'

import { useState, useEffect, use, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Plant, GardenPlant } from '@/lib/supabase'
import {
  markAsPlanted,
  updatePlantedDate,
  markAsNotPlanted,
  loadPlantWithOverrides,
  saveFieldOverride,
} from './actions'
import {
  listBedsContainingPlant,
  listBedsForGarden,
  markBedPlantingAsPlanted,
  markBedPlantingAsNotPlanted,
  updateBedPlantingDate,
  getPlantHarvestHistory,
  type BedForPlant,
  type PlantHarvestHistory,
} from '@/app/garten/plan/actions'
import AssignBedSheet from '@/app/garten/plan/AssignBedSheet'
import { bedKindIcon, bedKindLabel } from '@/lib/bedKinds'
import { formatHarvest } from '@/lib/harvestUnits'

function formatISODate(iso: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
}

function formatAge(iso: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return ''
  const planted = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`).getTime()
  const today = Date.now()
  const days = Math.max(0, Math.floor((today - planted) / 86_400_000))
  if (days === 0) return 'heute gepflanzt'
  if (days === 1) return '1 Tag alt'
  if (days < 14) return `${days} Tage alt`
  const weeks = Math.floor(days / 7)
  if (weeks < 52) return `${weeks} Wochen alt`
  const years = Math.floor(days / 365)
  return years === 1 ? '1 Jahr alt' : `${years} Jahre alt`
}

const fieldLabels = {
  sorte: 'Sorte',
  saatzeit: 'Saatzeit',
  saattiefe: 'Saattiefe',
  nachbarn: 'Nachbarn',
  erde: 'Erde',
  witterung: 'Witterung',
  bodenmilieu: 'Bodenmilieu',
  duenger: 'Dünger',
  vorzucht: 'Vorzucht',
  schneiden: 'Schneiden',
  einwintern: 'Einwintern',
  ernte: 'Ernte',
  einjaehrig_oder_mehrjaehrig: 'Einjährig / Mehrjährig',
  pflanzort: 'Pflanzort',
  wirkung: 'Wirkung auf den Körper',
  stark_oder_schwachzehrer: 'Stark- oder Schwachzehrer'
}

function getCategoryColor(category: string) {
  switch (category) {
    case 'Gemüse': return '#4A7C59'
    case 'Kraut': return '#C17B5C'
    case 'Blume': return '#8B5A95'
    case 'Obst': return '#D49C3D'
    case 'Baum': return '#5C7C4A'
    case 'Strauch': return '#8FA376'
    case 'Nuss': return '#A37D5C'
    default: return '#888780'
  }
}

export default function PlantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [plant, setPlant] = useState<Plant | null>(null)
  const [gardenPlant, setGardenPlant] = useState<GardenPlant | null>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editFieldsMode, setEditFieldsMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadCounter, setReloadCounter] = useState(0)
  const [editingPlantedDate, setEditingPlantedDate] = useState(false)
  const [plantedDateDraft, setPlantedDateDraft] = useState('')
  const [plantedPending, startPlantedTransition] = useTransition()
  const [bedsForPlant, setBedsForPlant] = useState<BedForPlant[]>([])
  const [bedCount, setBedCount] = useState<number>(0)
  const [assignSheetOpen, setAssignSheetOpen] = useState(false)
  const [editingBedDateId, setEditingBedDateId] = useState<string | null>(null)
  const [bedDateDraft, setBedDateDraft] = useState('')
  const [busyBedId, setBusyBedId] = useState<string | null>(null)
  const [bedPending, startBedTransition] = useTransition()
  const [harvestHistory, setHarvestHistory] = useState<PlantHarvestHistory>({
    events: [],
    byYear: [],
  })
  const router = useRouter()
  const searchParams = useSearchParams()
  const fresh = searchParams.get('fresh') === '1'
  const resolvedParams = use(params)
  const { id } = resolvedParams

  useEffect(() => {
    async function loadPlantData() {
      try {
        setLoading(true)
        setError(null)
        const res = await loadPlantWithOverrides(id)
        if ('error' in res) {
          throw new Error(
            res.error === 'not-found' ? 'Pflanze nicht gefunden' : 'Fehler beim Laden'
          )
        }
        setPlant(res.plant)
        setGardenPlant(res.gardenPlant)
        listBedsContainingPlant(id).then(setBedsForPlant).catch(() => {})
        listBedsForGarden()
          .then((views) => setBedCount(views.length))
          .catch(() => {})
        getPlantHarvestHistory(id).then(setHarvestHistory).catch(() => {})
      } catch (err) {
        console.error('Error loading plant data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load plant data')
      } finally {
        setLoading(false)
      }
    }
    if (id) loadPlantData()
  }, [id, reloadCounter])

  // When arriving with ?fresh=1 (just added a new plant), auto-refetch at
  // ~6s and ~14s so the Gemini-enriched fields and kawaii image appear
  // without the user having to pull-to-refresh.
  useEffect(() => {
    if (!fresh) return
    const t1 = setTimeout(() => setReloadCounter((c) => c + 1), 6000)
    const t2 = setTimeout(() => setReloadCounter((c) => c + 1), 14000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [fresh])

  const handleMarkPlanted = () => {
    if (!gardenPlant) return
    // If the user has beds set up, ask "where?" first — the bed-derived
    // global state then lights up Mein Garten via deriveGlobalPlantedAt.
    if (bedCount > 0) {
      setAssignSheetOpen(true)
      return
    }
    startPlantedTransition(async () => {
      const res = await markAsPlanted(gardenPlant.id)
      if ('ok' in res) {
        setGardenPlant({ ...gardenPlant, planted_at: res.plantedAt })
      }
    })
  }

  const handleAssignSheetClose = () => {
    setAssignSheetOpen(false)
    // The sheet may have created a bed_planting + flipped global planted_at.
    // Reload everything so the page reflects the new truth.
    setReloadCounter((c) => c + 1)
  }

  const handleStartEditDate = () => {
    setPlantedDateDraft(gardenPlant?.planted_at ?? '')
    setEditingPlantedDate(true)
  }

  const handleSavePlantedDate = () => {
    if (!gardenPlant || !plantedDateDraft) return
    startPlantedTransition(async () => {
      const res = await updatePlantedDate(gardenPlant.id, plantedDateDraft)
      if ('ok' in res) {
        setGardenPlant({ ...gardenPlant, planted_at: res.plantedAt })
        setEditingPlantedDate(false)
      }
    })
  }

  const handleUnplant = () => {
    if (!gardenPlant) return
    startPlantedTransition(async () => {
      const res = await markAsNotPlanted(gardenPlant.id)
      if ('ok' in res) {
        setGardenPlant({ ...gardenPlant, planted_at: null })
        setEditingPlantedDate(false)
      }
    })
  }

  async function reloadBeds() {
    try {
      const fresh = await listBedsContainingPlant(id)
      setBedsForPlant(fresh)
    } catch {}
    // Also pull garden_plants again so the Mein-Garten-derived state stays
    // in sync when the global planted_at flips after a bed action.
    setReloadCounter((c) => c + 1)
  }

  const handleToggleBed = (b: BedForPlant) => {
    setBusyBedId(b.plantingId)
    startBedTransition(async () => {
      const res = b.plantedAt
        ? await markBedPlantingAsNotPlanted(b.plantingId)
        : await markBedPlantingAsPlanted(b.plantingId)
      if ('ok' in res) {
        await reloadBeds()
      }
      setBusyBedId(null)
    })
  }

  const handleStartEditBedDate = (b: BedForPlant) => {
    setEditingBedDateId(b.plantingId)
    setBedDateDraft(b.plantedAt ?? '')
  }

  const handleSaveBedDate = (b: BedForPlant) => {
    if (!bedDateDraft) return
    setBusyBedId(b.plantingId)
    startBedTransition(async () => {
      const res = await updateBedPlantingDate(b.plantingId, bedDateDraft)
      if ('ok' in res) {
        setEditingBedDateId(null)
        setBedDateDraft('')
        await reloadBeds()
      }
      setBusyBedId(null)
    })
  }

  const handleCancelBedDate = () => {
    setEditingBedDateId(null)
    setBedDateDraft('')
  }

  const handleFieldClick = (field: string, currentValue: string) => {
    setEditingField(field)
    setEditValue(currentValue || '')
  }

  const handleSaveField = async () => {
    if (!editingField) return
    try {
      const res = await saveFieldOverride(id, editingField, editValue)
      if ('ok' in res) {
        setGardenPlant(res.gardenPlant)
      } else {
        console.error('saveFieldOverride error:', res.error)
      }
    } catch (error) {
      console.error('Error saving field:', error)
    }
    setEditingField(null)
    setEditValue('')
  }

  const handleCancelEdit = () => {
    setEditingField(null)
    setEditValue('')
  }

  const getFieldValue = (field: string): string => {
    if (gardenPlant && gardenPlant[field as keyof GardenPlant]) {
      return gardenPlant[field as keyof GardenPlant] as string
    }
    if (plant && plant[field as keyof Plant]) {
      return plant[field as keyof Plant] as string
    }
    return ''
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FAFAF7' }}>
        <div className="text-center">
          <div className="text-2xl mb-2">🌱</div>
          <p style={{ color: '#888780' }}>Lädt...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#FAFAF7' }}>
        <div className="text-center max-w-md">
          <div className="text-2xl mb-4">😕</div>
          <h2 className="text-lg font-medium mb-2" style={{ color: '#2C2C2A' }}>
            Fehler beim Laden
          </h2>
          <p className="text-sm mb-4" style={{ color: '#888780' }}>
            {error}
          </p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 rounded-xl text-white font-medium"
            style={{ backgroundColor: '#4A7C59' }}
          >
            Zurück
          </button>
        </div>
      </div>
    )
  }

  if (!plant) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#FAFAF7' }}>
        <div className="text-center max-w-md">
          <div className="text-2xl mb-4">🤷‍♀️</div>
          <h2 className="text-lg font-medium mb-2" style={{ color: '#2C2C2A' }}>
            Pflanze nicht gefunden
          </h2>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 rounded-xl text-white font-medium"
            style={{ backgroundColor: '#4A7C59' }}
          >
            Zurück
          </button>
        </div>
      </div>
    )
  }

  const hasAnyContent = Object.keys(fieldLabels).some(
    (k) => !!(plant as unknown as Record<string, string>)[k]
  )
  const showFreshBanner = fresh && !hasAnyContent
  const categoryColor = getCategoryColor(plant.category)

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF7' }}>
      {/* Header image */}
      <div className="relative h-64">
        {plant.illustration_url ? (
          <Image
            src={plant.illustration_url}
            alt={plant.name}
            fill
            className="object-cover rounded-b-xl"
            sizes="(max-width: 480px) 100vw, 480px"
          />
        ) : (
          <div
            className="w-full h-full rounded-b-xl flex items-center justify-center"
            style={{ backgroundColor: categoryColor + '22' }}
          >
            <span className="text-6xl">🌱</span>
          </div>
        )}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-12 h-12 bg-white/90 rounded-full flex items-center justify-center text-lg font-medium touch-manipulation"
          style={{ color: '#2C2C2A' }}
        >
          ←
        </button>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 py-6">
        {showFreshBanner && (
          <div
            className="mb-4 rounded-lg p-3 text-xs text-center leading-relaxed"
            style={{ backgroundColor: '#F0EDE4', color: '#4A7C59' }}
          >
            ✨ Wird im Hintergrund mit KI ausgefüllt — gleich automatisch
            neu geladen.
          </div>
        )}
        {/* Plant info */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold mb-2" style={{ color: '#2C2C2A' }}>
            {plant.name}
          </h1>
          <p className="text-base mb-3" style={{ color: '#888780' }}>
            {plant.latin_name}
          </p>
          <div
            className="inline-block px-3 py-1 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: getCategoryColor(plant.category) }}
          >
            {plant.category}
          </div>
          {plant.categories &&
            plant.categories.filter((c) => c !== plant.category).length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {plant.categories
                  .filter((c) => c !== plant.category)
                  .map((c) => (
                    <span
                      key={c}
                      className="inline-block px-2 py-0.5 rounded-md text-xs font-medium"
                      style={{
                        backgroundColor: getCategoryColor(c) + '22',
                        color: getCategoryColor(c),
                      }}
                    >
                      auch {c}
                    </span>
                  ))}
              </div>
            )}
        </div>

        {/* Gepflanzt state — fast path for plants without bed entries.
            When the plant is in ≥1 beds, the Im-Plan section below is the
            canonical control surface and the global state is derived. */}
        {gardenPlant && bedsForPlant.length === 0 && (
          <div className="mb-6">
            {!gardenPlant.planted_at ? (
              <button
                onClick={handleMarkPlanted}
                disabled={plantedPending}
                className="w-full py-4 rounded-xl text-white font-medium text-lg min-h-[56px] touch-manipulation disabled:opacity-60"
                style={{ backgroundColor: '#4A7C59' }}
              >
                {plantedPending ? '…' : '🌱 Gepflanzt'}
              </button>
            ) : editingPlantedDate ? (
              <div className="space-y-2">
                <input
                  type="date"
                  value={plantedDateDraft}
                  onChange={(e) => setPlantedDateDraft(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border bg-white text-base min-h-[48px]"
                  style={{ borderColor: '#E8E6DF', color: '#2C2C2A' }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSavePlantedDate}
                    disabled={plantedPending || !plantedDateDraft}
                    className="flex-1 px-4 py-3 rounded-lg text-white text-base font-medium min-h-[48px] touch-manipulation disabled:opacity-60"
                    style={{ backgroundColor: '#4A7C59' }}
                  >
                    {plantedPending ? '…' : 'Speichern'}
                  </button>
                  <button
                    onClick={() => setEditingPlantedDate(false)}
                    disabled={plantedPending}
                    className="flex-1 px-4 py-3 rounded-lg text-base font-medium border min-h-[48px] touch-manipulation"
                    style={{ borderColor: '#E8E6DF', color: '#888780' }}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="rounded-xl p-4 text-center"
                style={{ backgroundColor: '#F0EDE4' }}
              >
                <p className="text-base" style={{ color: '#4A7C59' }}>
                  🌱 Seit {formatISODate(gardenPlant.planted_at)} im Garten
                </p>
                <div className="mt-2 flex justify-center gap-4 text-sm">
                  <button
                    onClick={handleStartEditDate}
                    disabled={plantedPending}
                    className="underline disabled:opacity-60"
                    style={{ color: '#888780' }}
                  >
                    Datum ändern
                  </button>
                  <span style={{ color: '#E8E6DF' }}>·</span>
                  <button
                    onClick={handleUnplant}
                    disabled={plantedPending}
                    className="underline disabled:opacity-60"
                    style={{ color: '#888780' }}
                  >
                    Nicht mehr gepflanzt
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Im Garten seit — global age, derived from earliest bed planted_at */}
        {bedsForPlant.length > 0 && gardenPlant?.planted_at && (
          <div
            className="mb-4 rounded-xl px-4 py-3 text-sm"
            style={{ backgroundColor: '#F0EDE4', color: '#4A7C59' }}
          >
            🌱 Im Garten seit{' '}
            <span style={{ fontWeight: 500 }}>
              {formatISODate(gardenPlant.planted_at)}
            </span>{' '}
            · {formatAge(gardenPlant.planted_at)}
          </div>
        )}

        {/* Im Plan — interactive per-bed planted state */}
        {bedsForPlant.length > 0 && (
          <div className="mb-6">
            <h2
              className="text-xs font-medium uppercase tracking-wide mb-2"
              style={{ color: '#888780' }}
            >
              🗺️ Im Plan
            </h2>
            <div className="space-y-2">
              {bedsForPlant.map((b) => {
                const planted = !!b.plantedAt
                const icon = bedKindIcon(b.bedKind)
                const isEditing = editingBedDateId === b.plantingId
                const busy = busyBedId === b.plantingId
                return (
                  <div
                    key={b.plantingId}
                    className="rounded-lg border bg-white p-3"
                    style={{ borderColor: '#E8E6DF', opacity: busy ? 0.7 : 1 }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl shrink-0">{icon}</span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href="/garten/plan"
                          className="text-sm font-medium leading-tight truncate block"
                          style={{ color: '#2C2C2A' }}
                        >
                          {b.bedLabel}
                        </Link>
                        {!isEditing && (
                          <p
                            className="text-xs leading-tight mt-0.5"
                            style={{ color: planted ? '#4A7C59' : '#888780' }}
                          >
                            {planted ? (
                              <>
                                gepflanzt seit {formatISODate(b.plantedAt)}
                                {' · '}
                                <button
                                  onClick={() => handleStartEditBedDate(b)}
                                  disabled={bedPending}
                                  className="underline disabled:opacity-60"
                                  style={{ color: '#888780' }}
                                >
                                  Datum ändern
                                </button>
                              </>
                            ) : (
                              'geplant'
                            )}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleToggleBed(b)}
                        disabled={busy || bedPending}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-base touch-manipulation disabled:opacity-60 shrink-0"
                        style={{
                          backgroundColor: planted ? '#4A7C59' : 'transparent',
                          color: planted ? '#FFFFFF' : '#888780',
                          border: planted
                            ? 'none'
                            : '1.5px solid #C8C5BA',
                        }}
                        aria-label={
                          planted
                            ? 'Als geplant markieren'
                            : 'Als gepflanzt markieren'
                        }
                      >
                        {planted ? '✓' : ''}
                      </button>
                    </div>
                    {isEditing && (
                      <div className="space-y-2 mt-3">
                        <input
                          type="date"
                          value={bedDateDraft}
                          onChange={(e) => setBedDateDraft(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border bg-white text-sm min-h-[44px]"
                          style={{ borderColor: '#E8E6DF', color: '#2C2C2A' }}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveBedDate(b)}
                            disabled={busy || !bedDateDraft}
                            className="flex-1 px-3 py-2 rounded-lg text-white text-sm font-medium min-h-[40px] touch-manipulation disabled:opacity-60"
                            style={{ backgroundColor: '#4A7C59' }}
                          >
                            {busy ? '…' : 'Speichern'}
                          </button>
                          <button
                            onClick={handleCancelBedDate}
                            disabled={busy}
                            className="flex-1 px-3 py-2 rounded-lg text-sm font-medium border min-h-[40px] touch-manipulation"
                            style={{ borderColor: '#E8E6DF', color: '#888780' }}
                          >
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Stage 9 — Ernte-Verlauf: per-year totals + event log. */}
        {harvestHistory.events.length > 0 && (
          <div className="mb-6">
            <h2
              className="text-xs font-medium uppercase tracking-wide mb-2"
              style={{ color: '#888780' }}
            >
              🌾 Ernte-Verlauf
            </h2>
            <div className="space-y-2">
              {harvestHistory.byYear.map((y) => (
                <div
                  key={y.year}
                  className="rounded-lg border bg-white px-3 py-2 flex items-center justify-between"
                  style={{ borderColor: '#E8E6DF' }}
                >
                  <span className="text-sm font-medium" style={{ color: '#2C2C2A' }}>
                    {y.year}
                  </span>
                  <span className="text-xs" style={{ color: '#4A7C59' }}>
                    {y.totalUnit && y.totalAmount !== null ? (
                      <>
                        Σ {formatHarvest(y.totalAmount, y.totalUnit)}
                        {' · '}
                        {y.count} {y.count === 1 ? 'Eintrag' : 'Einträge'}
                      </>
                    ) : (
                      <>
                        {y.count} {y.count === 1 ? 'Eintrag' : 'Einträge'} (gemischte
                        Einheiten)
                      </>
                    )}
                  </span>
                </div>
              ))}
              <details className="rounded-lg border bg-white" style={{ borderColor: '#E8E6DF' }}>
                <summary
                  className="px-3 py-2 text-xs cursor-pointer touch-manipulation"
                  style={{ color: '#888780' }}
                >
                  Alle Einträge ({harvestHistory.events.length})
                </summary>
                <div className="px-3 pb-3 space-y-1.5">
                  {harvestHistory.events.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between text-xs gap-2"
                    >
                      <span style={{ color: '#888780' }}>
                        {formatISODate(e.harvested_at)} · {e.bedLabel}
                      </span>
                      <span style={{ color: '#2C2C2A', fontWeight: 500 }}>
                        {formatHarvest(e.amount, e.unit)}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        )}

        {/* Passt zu — which bed kinds suit this plant.
            Read-only chip-row. Empty when Gemini hasn't filled it yet. */}
        {plant.suitable_bed_kinds && plant.suitable_bed_kinds.length > 0 && (
          <div className="mb-6">
            <h2
              className="text-xs font-medium uppercase tracking-wide mb-2"
              style={{ color: '#888780' }}
            >
              🌿 Passt zu
            </h2>
            <div className="flex flex-wrap gap-2">
              {plant.suitable_bed_kinds.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs"
                  style={{
                    backgroundColor: '#F0EFEA',
                    color: '#2C2C2A',
                  }}
                >
                  <span className="text-base leading-none">{bedKindIcon(k)}</span>
                  <span>{bedKindLabel(k)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Fields header with edit-mode toggle.
            Default = read-only so scrolling never gets hijacked into an
            edit. Tap "Bearbeiten" to make all fields tappable. */}
        <div className="flex items-center justify-between mb-3">
          <h2
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: '#888780' }}
          >
            Pflanzen-Details
          </h2>
          <button
            onClick={() => {
              if (editFieldsMode) handleCancelEdit()
              setEditFieldsMode((v) => !v)
            }}
            className="text-xs font-medium px-3 py-1.5 rounded-lg touch-manipulation"
            style={{
              backgroundColor: editFieldsMode ? '#4A7C59' : 'transparent',
              color: editFieldsMode ? '#FFFFFF' : '#4A7C59',
              border: `1px solid #4A7C59`,
            }}
          >
            {editFieldsMode ? '✓ Fertig' : '✏️ Bearbeiten'}
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          {Object.entries(fieldLabels).map(([field, label]) => {
            const value = getFieldValue(field)
            const isEditing = editingField === field
            const tappable = editFieldsMode

            return (
              <div key={field} className="space-y-2">
                <label className="block text-xs font-medium uppercase tracking-wide" style={{ color: '#888780' }}>
                  {label}
                </label>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full p-3 rounded-lg border bg-white resize-none"
                      style={{
                        borderColor: '#E8E6DF',
                        color: '#2C2C2A'
                      }}
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveField}
                        className="flex-1 px-4 py-3 rounded-lg text-white text-base font-medium min-h-[48px] touch-manipulation"
                        style={{ backgroundColor: '#4A7C59' }}
                      >
                        Speichern
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="flex-1 px-4 py-3 rounded-lg text-gray-600 text-base font-medium border min-h-[48px] touch-manipulation"
                        style={{ borderColor: '#E8E6DF' }}
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={
                      tappable ? () => handleFieldClick(field, value) : undefined
                    }
                    className={`p-4 rounded-lg border bg-white min-h-[48px] flex items-center transition-colors ${
                      tappable
                        ? 'cursor-pointer hover:bg-gray-50 touch-manipulation'
                        : ''
                    }`}
                    style={{
                      borderColor: tappable ? '#4A7C59' : '#E8E6DF',
                      borderStyle: tappable ? 'dashed' : 'solid',
                    }}
                  >
                    <p className="text-base leading-relaxed" style={{ color: value ? '#2C2C2A' : '#888780' }}>
                      {value || '—'}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {assignSheetOpen && plant && (
        <AssignBedSheet
          plantId={plant.id}
          plantName={plant.name}
          suitableBedKinds={plant.suitable_bed_kinds}
          onClose={handleAssignSheetClose}
        />
      )}
    </div>
  )
}