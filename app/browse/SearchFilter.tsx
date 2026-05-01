'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Plant } from '@/lib/supabase'
import { addToGarden, removeFromGarden } from './actions'

const CATEGORIES = [
  'Alle',
  'Gemüse',
  'Kraut',
  'Blume',
  'Obst',
  'Baum',
  'Strauch',
  'Nuss',
] as const
type Category = (typeof CATEGORIES)[number]

function categoryColor(cat: string): string {
  switch (cat) {
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

function plantMatchesCategory(p: Plant, category: Category): boolean {
  if (category === 'Alle') return true
  // Multi-cat lookup with legacy fallback for plants whose array hasn't
  // been backfilled yet (categories === null).
  if (p.categories && p.categories.length > 0) {
    return p.categories.includes(category)
  }
  return p.category === category
}

type Props = {
  plants: Plant[]
  inGardenIds: string[]
}

export default function SearchFilter({ plants, inGardenIds }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('Alle')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [optimisticIn, setOptimisticIn] = useState<Set<string>>(
    new Set(inGardenIds)
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return plants.filter((p) => {
      if (!plantMatchesCategory(p, category)) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.latin_name.toLowerCase().includes(q)
      )
    })
  }, [plants, query, category])

  function toggle(plant: Plant) {
    const isIn = optimisticIn.has(plant.id)
    setPendingId(plant.id)
    const next = new Set(optimisticIn)
    if (isIn) next.delete(plant.id)
    else next.add(plant.id)
    setOptimisticIn(next)

    startTransition(async () => {
      const result = isIn
        ? await removeFromGarden(plant.id)
        : await addToGarden(plant.id)
      if ('error' in result) {
        // revert on failure
        const revert = new Set(optimisticIn)
        setOptimisticIn(revert)
      }
      setPendingId(null)
    })
  }

  return (
    <div>
      <div className="space-y-3 mb-6">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pflanze suchen…"
          className="w-full px-4 py-3 rounded-xl border bg-white text-base focus:outline-none min-h-[48px]"
          style={{ borderColor: '#E8E6DF', color: '#2C2C2A' }}
        />
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const active = cat === category
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap touch-manipulation"
                style={{
                  backgroundColor: active ? '#4A7C59' : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#2C2C2A',
                  border: `1px solid ${active ? '#4A7C59' : '#E8E6DF'}`,
                }}
              >
                {cat}
              </button>
            )
          })}
        </div>
        <p className="text-xs" style={{ color: '#888780' }}>
          {filtered.length} {filtered.length === 1 ? 'Pflanze' : 'Pflanzen'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {filtered.map((plant) => {
          const isIn = optimisticIn.has(plant.id)
          const isPending = pendingId === plant.id
          return (
            <div
              key={plant.id}
              className="bg-white rounded-xl border overflow-hidden flex flex-col"
              style={{ borderColor: '#E8E6DF' }}
            >
              <Link href={`/plants/${plant.id}`} className="block">
                <div className="aspect-square relative" style={{ backgroundColor: '#FAFAF7' }}>
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
                      className="absolute inset-0 flex items-center justify-center text-3xl"
                      style={{ backgroundColor: categoryColor(plant.category) + '22', color: categoryColor(plant.category) }}
                    >
                      🌱
                    </div>
                  )}
                </div>
                <div className="px-3 pt-3">
                  <h2 className="font-medium text-sm leading-tight" style={{ color: '#2C2C2A' }}>
                    {plant.name}
                  </h2>
                  <p className="text-xs mt-0.5 leading-tight italic" style={{ color: '#888780' }}>
                    {plant.latin_name}
                  </p>
                </div>
              </Link>
              <div className="px-3 pb-3 pt-2 mt-auto">
                <button
                  onClick={() => toggle(plant)}
                  disabled={isPending}
                  className="w-full text-xs py-2 rounded-lg font-medium touch-manipulation disabled:opacity-60"
                  style={{
                    backgroundColor: isIn ? '#FFFFFF' : '#4A7C59',
                    color: isIn ? '#888780' : '#FFFFFF',
                    border: `1px solid ${isIn ? '#E8E6DF' : '#4A7C59'}`,
                  }}
                >
                  {isPending ? '…' : isIn ? '✓ Im Garten' : '+ Hinzufügen'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8" style={{ color: '#888780' }}>
          <p className="text-base">Keine Pflanzen gefunden.</p>
        </div>
      )}

      <div className="mt-6">
        <Link
          href={
            query.trim()
              ? `/browse/add?name=${encodeURIComponent(query.trim())}`
              : '/browse/add'
          }
          className="block w-full text-center py-4 rounded-xl border-2 border-dashed text-sm font-medium"
          style={{ borderColor: '#C8C5BA', color: '#4A7C59' }}
        >
          {filtered.length === 0 && query.trim()
            ? `„${query.trim()}" selbst hinzufügen →`
            : '+ Pflanze fehlt? Selbst hinzufügen'}
        </Link>
      </div>
    </div>
  )
}
