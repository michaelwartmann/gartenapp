'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import type { Plant } from '@/lib/supabase'
import { addAsInterested } from './actions'

function categoryColor(cat: string): string {
  switch (cat) {
    case 'Gemüse': return '#4A7C59'
    case 'Kraut': return '#C17B5C'
    case 'Blume': return '#8B5A95'
    case 'Obst': return '#D49C3D'
    default: return '#888780'
  }
}

export default function SuggestionCard({
  plant,
  reason,
}: {
  plant: Plant
  reason: string
}) {
  const [pending, startTransition] = useTransition()
  const [added, setAdded] = useState(false)
  const [errored, setErrored] = useState(false)

  const handleAdd = () => {
    setErrored(false)
    startTransition(async () => {
      const res = await addAsInterested(plant.id)
      if ('ok' in res) setAdded(true)
      else setErrored(true)
    })
  }

  return (
    <div
      className="bg-white rounded-xl border overflow-hidden"
      style={{ borderColor: '#E8E6DF' }}
    >
      <Link href={`/plants/${plant.id}`} className="block">
        <div
          className="aspect-square relative"
          style={{ backgroundColor: '#FAFAF7' }}
        >
          {plant.illustration_url ? (
            <Image
              src={plant.illustration_url}
              alt={plant.name}
              fill
              className="object-cover"
              sizes="(max-width: 480px) 50vw, 200px"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center text-4xl"
              style={{
                backgroundColor: categoryColor(plant.category) + '22',
                color: categoryColor(plant.category),
              }}
            >
              🌱
            </div>
          )}
        </div>
        <div className="p-3">
          <h3
            className="font-medium text-base leading-tight"
            style={{ color: '#2C2C2A' }}
          >
            {plant.name}
          </h3>
          <p
            className="text-xs mt-1 leading-tight italic"
            style={{ color: '#888780' }}
          >
            {plant.latin_name}
          </p>
          <p
            className="text-xs mt-2 leading-snug"
            style={{ color: '#4A7C59' }}
          >
            {reason}
          </p>
        </div>
      </Link>
      <div className="px-3 pb-3">
        <button
          onClick={handleAdd}
          disabled={pending || added}
          className="w-full py-2 rounded-lg text-sm font-medium touch-none transition-colors"
          style={
            added
              ? { backgroundColor: '#F0EDE4', color: '#4A7C59' }
              : errored
                ? { backgroundColor: '#FDE8E2', color: '#C17B5C' }
                : { backgroundColor: '#4A7C59', color: '#FFFFFF' }
          }
        >
          {added
            ? '✓ In Meiner Samen'
            : errored
              ? 'Nochmal versuchen'
              : pending
                ? '…'
                : 'Zum Garten hinzufügen'}
        </button>
      </div>
    </div>
  )
}
