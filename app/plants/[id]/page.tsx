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
  const [kimGardenId, setKimGardenId] = useState<string | null>(null)
  const router = useRouter()
  const { id } = use(params)

  useEffect(() => {
    async function loadPlantData() {
      // Get plant data
      const { data: plantData } = await supabase
        .from('plants')
        .select('*')
        .eq('id', id)
        .single()

      if (plantData) {
        setPlant(plantData)
      }

      // Get Kim's garden ID
      const { data: kimGarden } = await supabase
        .from('gardens')
        .select('id')
        .eq('owner_name', 'Kim')
        .single()

      if (kimGarden) {
        setKimGardenId(kimGarden.id)

        // Check if Kim has custom data for this plant
        const { data: gardenPlantData } = await supabase
          .from('garden_plants')
          .select('*')
          .eq('garden_id', kimGarden.id)
          .eq('plant_id', id)
          .single()

        if (gardenPlantData) {
          setGardenPlant(gardenPlantData)
        }
      }
    }

    loadPlantData()
  }, [id])

  const handleFieldClick = (field: string, currentValue: string) => {
    setEditingField(field)
    setEditValue(currentValue || '')
  }

  const handleSaveField = async () => {
    if (!kimGardenId || !editingField) return

    try {
      if (gardenPlant) {
        // Update existing garden plant
        const { error } = await supabase
          .from('garden_plants')
          .update({ [editingField]: editValue })
          .eq('id', gardenPlant.id)

        if (!error) {
          setGardenPlant({ ...gardenPlant, [editingField]: editValue })
        }
      } else {
        // Create new garden plant record
        const { data, error } = await supabase
          .from('garden_plants')
          .insert({
            garden_id: kimGardenId,
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

  if (!plant) {
    return <div>Lädt...</div>
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