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

// Stage 12 — smart filter sets
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
] as const
type Month = (typeof MONTHS)[number]

const LIFECYCLES = ['einjährig', 'zweijährig', 'mehrjährig'] as const
type Lifecycle = (typeof LIFECYCLES)[number]

const NUTRIENTS = ['Starkzehrer', 'Mittelzehrer', 'Schwachzehrer'] as const
type Nutrient = (typeof NUTRIENTS)[number]

const LIGHTS = ['sonnig', 'halbschattig', 'schattig'] as const
type Light = (typeof LIGHTS)[number]

type SmartFilters = {
  seedMonth: Month | null
  harvestMonth: Month | null
  lifecycle: Lifecycle | null
  nutrient: Nutrient | null
  light: Light | null
}

const EMPTY_FILTERS: SmartFilters = {
  seedMonth: null,
  harvestMonth: null,
  lifecycle: null,
  nutrient: null,
  light: null,
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

function plantMatchesCategory(p: Plant, category: Category): boolean {
  if (category === 'Alle') return true
  if (p.categories && p.categories.length > 0) {
    return p.categories.includes(category)
  }
  return p.category === category
}

function lower(s: string | null | undefined): string {
  return (s ?? '').toLowerCase()
}

function plantMatchesSmart(p: Plant, f: SmartFilters): boolean {
  if (f.seedMonth && !lower(p.saatzeit).includes(f.seedMonth.toLowerCase())) {
    return false
  }
  if (f.harvestMonth && !lower(p.ernte).includes(f.harvestMonth.toLowerCase())) {
    return false
  }
  if (f.lifecycle) {
    const v = lower(p.einjaehrig_oder_mehrjaehrig)
    if (!v.includes(f.lifecycle.toLowerCase())) return false
  }
  if (f.nutrient) {
    const v = lower(p.stark_oder_schwachzehrer)
    if (!v.includes(f.nutrient.toLowerCase())) return false
  }
  if (f.light) {
    const v = lower(p.pflanzort) + ' ' + lower(p.witterung)
    if (!v.includes(f.light.toLowerCase())) return false
  }
  return true
}

function activeSmartCount(f: SmartFilters): number {
  return (
    (f.seedMonth ? 1 : 0) +
    (f.harvestMonth ? 1 : 0) +
    (f.lifecycle ? 1 : 0) +
    (f.nutrient ? 1 : 0) +
    (f.light ? 1 : 0)
  )
}

type Props = {
  plants: Plant[]
  inGardenIds: string[]
}

export default function SearchFilter({ plants, inGardenIds }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('Alle')
  const [smart, setSmart] = useState<SmartFilters>(EMPTY_FILTERS)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [optimisticIn, setOptimisticIn] = useState<Set<string>>(
    new Set(inGardenIds)
  )

  const smartCount = activeSmartCount(smart)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return plants.filter((p) => {
      if (!plantMatchesCategory(p, category)) return false
      if (!plantMatchesSmart(p, smart)) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.latin_name.toLowerCase().includes(q)
      )
    })
  }, [plants, query, category, smart])

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
        const revert = new Set(optimisticIn)
        setOptimisticIn(revert)
      }
      setPendingId(null)
    })
  }

  function clearSmart<K extends keyof SmartFilters>(key: K) {
    setSmart((s) => ({ ...s, [key]: null }))
  }

  function clearAllSmart() {
    setSmart(EMPTY_FILTERS)
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

        {/* Stage 12 — Smart-Filter Panel (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setFilterPanelOpen((v) => !v)}
            className="text-xs font-medium px-3 py-1.5 rounded-full border touch-manipulation flex items-center gap-1.5"
            style={{
              color: '#4A7C59',
              borderColor: '#C9DCC9',
              backgroundColor: smartCount > 0 ? '#F0F5F0' : '#FFFFFF',
            }}
            aria-expanded={filterPanelOpen}
          >
            🔍 Filter{smartCount > 0 ? ` (${smartCount})` : ''}{' '}
            <span style={{ color: '#888780' }}>
              {filterPanelOpen ? '▴' : '▾'}
            </span>
          </button>

          {filterPanelOpen && (
            <div
              className="mt-2 rounded-xl border bg-white p-3 space-y-3"
              style={{ borderColor: '#E8E6DF' }}
            >
              <FilterMonthPicker
                label="🌱 Saatzeit"
                value={smart.seedMonth}
                onChange={(v) => setSmart((s) => ({ ...s, seedMonth: v }))}
              />
              <FilterMonthPicker
                label="🌾 Erntezeit"
                value={smart.harvestMonth}
                onChange={(v) => setSmart((s) => ({ ...s, harvestMonth: v }))}
              />
              <FilterPillRow
                label="Lebenszyklus"
                options={LIFECYCLES}
                value={smart.lifecycle}
                onChange={(v) => setSmart((s) => ({ ...s, lifecycle: v }))}
              />
              <FilterPillRow
                label="Zehrertyp"
                options={NUTRIENTS}
                value={smart.nutrient}
                onChange={(v) => setSmart((s) => ({ ...s, nutrient: v }))}
              />
              <FilterPillRow
                label="Standort"
                options={LIGHTS}
                value={smart.light}
                onChange={(v) => setSmart((s) => ({ ...s, light: v }))}
              />
            </div>
          )}
        </div>

        {/* Active-filter chips */}
        {smartCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {smart.seedMonth && (
              <ActiveChip
                label={`Saat: ${smart.seedMonth}`}
                onRemove={() => clearSmart('seedMonth')}
              />
            )}
            {smart.harvestMonth && (
              <ActiveChip
                label={`Ernte: ${smart.harvestMonth}`}
                onRemove={() => clearSmart('harvestMonth')}
              />
            )}
            {smart.lifecycle && (
              <ActiveChip
                label={smart.lifecycle}
                onRemove={() => clearSmart('lifecycle')}
              />
            )}
            {smart.nutrient && (
              <ActiveChip
                label={smart.nutrient}
                onRemove={() => clearSmart('nutrient')}
              />
            )}
            {smart.light && (
              <ActiveChip
                label={smart.light}
                onRemove={() => clearSmart('light')}
              />
            )}
            <button
              onClick={clearAllSmart}
              className="text-xs px-2 py-1 touch-manipulation"
              style={{ color: '#888780' }}
            >
              alle zurücksetzen
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs" style={{ color: '#888780' }}>
            {filtered.length} {filtered.length === 1 ? 'Pflanze' : 'Pflanzen'}
          </p>
          <Link
            href={
              query.trim()
                ? `/browse/add?name=${encodeURIComponent(query.trim())}`
                : '/browse/add'
            }
            className="text-xs font-medium px-3 py-1.5 rounded-full border touch-manipulation whitespace-nowrap"
            style={{
              color: '#4A7C59',
              borderColor: '#C9DCC9',
              backgroundColor: '#F0F5F0',
            }}
          >
            {query.trim()
              ? `+ „${query.trim()}" anlegen`
              : '+ Pflanze fehlt?'}
          </Link>
        </div>
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
        <div className="text-center py-8 space-y-3" style={{ color: '#888780' }}>
          <p className="text-base">Keine Pflanzen gefunden.</p>
          <Link
            href={
              query.trim()
                ? `/browse/add?name=${encodeURIComponent(query.trim())}`
                : '/browse/add'
            }
            className="inline-block px-4 py-3 rounded-xl border-2 border-dashed text-sm font-medium"
            style={{ borderColor: '#C8C5BA', color: '#4A7C59' }}
          >
            {query.trim()
              ? `„${query.trim()}" selbst hinzufügen →`
              : '+ Pflanze selbst hinzufügen'}
          </Link>
        </div>
      )}
    </div>
  )
}

function FilterMonthPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: Month | null
  onChange: (v: Month | null) => void
}) {
  return (
    <div>
      <p
        className="text-[11px] uppercase tracking-wide font-medium mb-1.5"
        style={{ color: '#888780' }}
      >
        {label}
      </p>
      <select
        value={value ?? ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? null : (e.target.value as Month))
        }
        className="w-full px-3 py-2 rounded-lg border bg-white text-sm min-h-[40px] focus:outline-none"
        style={{ borderColor: '#E8E6DF', color: value ? '#2C2C2A' : '#888780' }}
      >
        <option value="">— alle Monate —</option>
        {MONTHS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  )
}

function FilterPillRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly T[]
  value: T | null
  onChange: (v: T | null) => void
}) {
  return (
    <div>
      <p
        className="text-[11px] uppercase tracking-wide font-medium mb-1.5"
        style={{ color: '#888780' }}
      >
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = opt === value
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(active ? null : opt)}
              className="px-3 py-1.5 rounded-full text-xs font-medium touch-manipulation"
              style={{
                backgroundColor: active ? '#4A7C59' : '#FFFFFF',
                color: active ? '#FFFFFF' : '#2C2C2A',
                border: `1px solid ${active ? '#4A7C59' : '#E8E6DF'}`,
              }}
              aria-pressed={active}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ActiveChip({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full pl-2.5 pr-1 py-1 text-xs"
      style={{ backgroundColor: '#F0F5F0', color: '#4A7C59' }}
    >
      {label}
      <button
        onClick={onRemove}
        className="w-5 h-5 rounded-full flex items-center justify-center text-xs touch-manipulation"
        style={{ color: '#4A7C59' }}
        aria-label={`Filter ${label} entfernen`}
      >
        ✕
      </button>
    </span>
  )
}
