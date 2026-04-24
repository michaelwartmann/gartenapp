'use client'

import { useState, useEffect, use, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { supabase, Plant, GardenPlant } from '@/lib/supabase'
import {
  markAsPlanted,
  updatePlantedDate,
  markAsNotPlanted,
} from './actions'

function formatISODate(iso: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
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
    default: return '#888780'
  }
}

export default function PlantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [plant, setPlant] = useState<Plant | null>(null)
  const [gardenPlant, setGardenPlant] = useState<GardenPlant | null>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [gardenId, setGardenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadCounter, setReloadCounter] = useState(0)
  const [editingPlantedDate, setEditingPlantedDate] = useState(false)
  const [plantedDateDraft, setPlantedDateDraft] = useState('')
  const [plantedPending, startPlantedTransition] = useTransition()
  const router = useRouter()
  const searchParams = useSearchParams()
  const fresh = searchParams.get('fresh') === '1'
  const resolvedParams = use(params)
  const { id } = resolvedParams

  useEffect(() => {
    // Read the current garden id from the cookie set on login.
    const match = document.cookie.match(/(?:^|;\s*)garten_id=([^;]+)/)
    setGardenId(match ? decodeURIComponent(match[1]) : null)
  }, [])

  useEffect(() => {
    async function loadPlantData() {
      try {
        setLoading(true)
        setError(null)

        const { data: plantData, error: plantError } = await supabase
          .from('plants')
          .select('*')
          .eq('id', id)
          .single()

        if (plantError) {
          throw new Error(`Plant not found: ${plantError.message}`)
        }

        if (plantData) {
          setPlant(plantData)
        }

        if (gardenId) {
          const { data: gardenPlantData } = await supabase
            .from('garden_plants')
            .select('*')
            .eq('garden_id', gardenId)
            .eq('plant_id', id)
            .maybeSingle()

          if (gardenPlantData) {
            setGardenPlant(gardenPlantData)
          }
        }
      } catch (err) {
        console.error('Error loading plant data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load plant data')
      } finally {
        setLoading(false)
      }
    }

    if (id && gardenId !== null) {
      loadPlantData()
    } else if (id && gardenId === null) {
      // No garden cookie yet — load plant data without garden overrides.
      loadPlantData()
    }
  }, [id, gardenId, reloadCounter])

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
    startPlantedTransition(async () => {
      const res = await markAsPlanted(gardenPlant.id)
      if ('ok' in res) {
        setGardenPlant({ ...gardenPlant, planted_at: res.plantedAt })
      }
    })
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

  const handleFieldClick = (field: string, currentValue: string) => {
    setEditingField(field)
    setEditValue(currentValue || '')
  }

  const handleSaveField = async () => {
    if (!gardenId || !editingField) return

    try {
      if (gardenPlant) {
        const { error } = await supabase
          .from('garden_plants')
          .update({ [editingField]: editValue })
          .eq('id', gardenPlant.id)

        if (!error) {
          setGardenPlant({ ...gardenPlant, [editingField]: editValue })
        }
      } else {
        const { data, error } = await supabase
          .from('garden_plants')
          .insert({
            garden_id: gardenId,
            plant_id: id,
            [editingField]: editValue
          })
          .select()
          .single()

        if (!error && data) {
          setGardenPlant(data)
        }
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
          className="absolute top-4 left-4 w-12 h-12 bg-white/90 rounded-full flex items-center justify-center text-lg font-medium touch-none"
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
        </div>

        {/* Gepflanzt state (only when plant is in the user's garden) */}
        {gardenPlant && (
          <div className="mb-6">
            {!gardenPlant.planted_at ? (
              <button
                onClick={handleMarkPlanted}
                disabled={plantedPending}
                className="w-full py-4 rounded-xl text-white font-medium text-lg min-h-[56px] touch-none disabled:opacity-60"
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
                    className="flex-1 px-4 py-3 rounded-lg text-white text-base font-medium min-h-[48px] touch-none disabled:opacity-60"
                    style={{ backgroundColor: '#4A7C59' }}
                  >
                    {plantedPending ? '…' : 'Speichern'}
                  </button>
                  <button
                    onClick={() => setEditingPlantedDate(false)}
                    disabled={plantedPending}
                    className="flex-1 px-4 py-3 rounded-lg text-base font-medium border min-h-[48px] touch-none"
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

        {/* Fields */}
        <div className="space-y-4">
          {Object.entries(fieldLabels).map(([field, label]) => {
            const value = getFieldValue(field)
            const isEditing = editingField === field

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
                        className="flex-1 px-4 py-3 rounded-lg text-white text-base font-medium min-h-[48px] touch-none"
                        style={{ backgroundColor: '#4A7C59' }}
                      >
                        Speichern
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="flex-1 px-4 py-3 rounded-lg text-gray-600 text-base font-medium border min-h-[48px] touch-none"
                        style={{ borderColor: '#E8E6DF' }}
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => handleFieldClick(field, value)}
                    className="p-4 rounded-lg border bg-white cursor-pointer hover:bg-gray-50 transition-colors min-h-[48px] flex items-center touch-none"
                    style={{ borderColor: '#E8E6DF' }}
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
    </div>
  )
}