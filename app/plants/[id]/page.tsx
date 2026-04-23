'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase, Plant, GardenPlant } from '@/lib/supabase'

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
  const router = useRouter()
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
  }, [id, gardenId])

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

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF7' }}>
      {/* Header image */}
      <div className="relative h-64">
        <Image
          src={plant.illustration_url}
          alt={plant.name}
          fill
          className="object-cover rounded-b-xl"
          sizes="(max-width: 480px) 100vw, 480px"
        />
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