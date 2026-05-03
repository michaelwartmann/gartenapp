'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Plant } from '@/lib/supabase'
import {
  EMPTY_FILTERS,
  plantMatchesSmart,
  type SmartFilters,
} from '@/lib/plantFilters'
import PlantFilterPanel from './PlantFilterPanel'

type BedRef = { kind: string; label: string }

const KIND_ICON: Record<string, string> = {
  beet: '🟫',
  hochbeet: '📦',
  gewaechshaus: '🏠',
  topf: '🪴',
}

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

type Props = {
  planted: Plant[]
  interested: Plant[]
  /** bedId → bed-ref array, serialized to plain object across the RSC boundary */
  bedsByPlant: Record<string, BedRef[]>
}

/**
 * Stage 12.1 — wraps the two Mein-Garten plant sections (Im Garten + Meine
 * Samen) with the same smart-filter UI as /browse. Filter applies to BOTH
 * sections independently — when nothing matches, that section gets a small
 * "kein Treffer" hint.
 */
export default function MyGardenSections({
  planted,
  interested,
  bedsByPlant,
}: Props) {
  const [smart, setSmart] = useState<SmartFilters>(EMPTY_FILTERS)

  const filteredPlanted = useMemo(
    () => planted.filter((p) => plantMatchesSmart(p, smart)),
    [planted, smart]
  )
  const filteredInterested = useMemo(
    () => interested.filter((p) => plantMatchesSmart(p, smart)),
    [interested, smart]
  )

  return (
    <>
      <div className="mb-4">
        <PlantFilterPanel filters={smart} onChange={setSmart} />
      </div>

      <div className="space-y-8">
        {planted.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: '#888780' }}
              >
                Im Garten 🌱
              </h2>
              {filteredPlanted.length !== planted.length && (
                <span className="text-xs" style={{ color: '#888780' }}>
                  {filteredPlanted.length} / {planted.length}
                </span>
              )}
            </div>
            {filteredPlanted.length === 0 ? (
              <p className="text-sm" style={{ color: '#888780' }}>
                Keine deiner gepflanzten Pflanzen passt zum Filter.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredPlanted.map((p) => (
                  <PlantCard
                    key={p.id}
                    plant={p}
                    beds={bedsByPlant[p.id] ?? []}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {interested.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: '#888780' }}
              >
                Meine Samen
              </h2>
              {filteredInterested.length !== interested.length && (
                <span className="text-xs" style={{ color: '#888780' }}>
                  {filteredInterested.length} / {interested.length}
                </span>
              )}
            </div>
            {filteredInterested.length === 0 ? (
              <p className="text-sm" style={{ color: '#888780' }}>
                Keine deiner Samen passt zum Filter.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredInterested.map((p) => (
                  <PlantCard
                    key={p.id}
                    plant={p}
                    beds={bedsByPlant[p.id] ?? []}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  )
}

function BedLine({ beds }: { beds: BedRef[] }) {
  if (beds.length === 0) return null
  const first = beds[0]
  const extra = beds.length - 1
  const icon = KIND_ICON[first.kind] ?? '🟫'
  return (
    <p
      className="text-xs mt-1 leading-tight truncate"
      style={{ color: '#4A7C59' }}
    >
      {icon} {first.label}
      {extra > 0 ? ` · +${extra}` : ''}
    </p>
  )
}

function PlantCard({ plant, beds }: { plant: Plant; beds: BedRef[] }) {
  return (
    <Link href={`/plants/${plant.id}`} className="block">
      <div
        className="bg-white rounded-xl border overflow-hidden transition-all duration-200 active:scale-95 min-h-[200px]"
        style={{ borderColor: '#E8E6DF' }}
      >
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
        <div className="p-4">
          <h2 className="font-medium text-base leading-tight" style={{ color: '#2C2C2A' }}>
            {plant.name}
          </h2>
          <p className="text-sm mt-1 leading-tight italic" style={{ color: '#888780' }}>
            {plant.latin_name}
          </p>
          <BedLine beds={beds} />
        </div>
      </div>
    </Link>
  )
}
