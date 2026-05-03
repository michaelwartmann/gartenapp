'use client'

import Link from 'next/link'
import type { PlantingWithPlant } from './actions'

export const CATEGORY_BG: Record<string, string> = {
  Gemüse: '#4A7C59',
  Kraut: '#C17B5C',
  Blume: '#8B5A95',
  Obst: '#D49C3D',
  Baum: '#5C7C4A',
  Strauch: '#8FA376',
  Nuss: '#A37D5C',
}

export function formatISODate(iso: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
}

export function CurrentChip({
  p,
  onToggle,
  onRemove,
  onHarvest,
  onUnharvest,
  busy,
}: {
  p: PlantingWithPlant
  onToggle: () => void
  onRemove: () => void
  onHarvest: () => void
  onUnharvest: () => void
  busy: boolean
}) {
  const planted = !!p.planted_at
  const harvested = !!p.removed_at
  const bg = CATEGORY_BG[p.plant_category] ?? '#888780'
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full pl-2 pr-1 py-1 text-sm border"
      style={{
        backgroundColor: harvested
          ? '#F0EFEA'
          : planted
          ? bg + '22'
          : '#FFFFFF',
        borderColor: harvested
          ? 'transparent'
          : planted
          ? 'transparent'
          : '#C8C5BA',
        borderStyle: planted || harvested ? 'solid' : 'dashed',
        color: '#2C2C2A',
        opacity: busy ? 0.5 : harvested ? 0.55 : 1,
      }}
    >
      {!harvested && (
        <button
          onClick={onToggle}
          disabled={busy}
          className="w-6 h-6 rounded-full flex items-center justify-center text-sm touch-manipulation disabled:opacity-60"
          style={{
            backgroundColor: planted ? bg : 'transparent',
            color: planted ? '#FFFFFF' : '#888780',
            border: planted ? 'none' : '1.5px solid #C8C5BA',
          }}
          aria-label={planted ? 'Als geplant markieren' : 'Als gepflanzt markieren'}
        >
          {planted ? '✓' : ''}
        </button>
      )}
      <Link
        href={`/plants/${p.plant_id}`}
        className="px-1"
        style={{
          color: '#2C2C2A',
          textDecoration: harvested ? 'line-through' : 'none',
        }}
      >
        {p.plant_name}
      </Link>
      {planted && p.planted_at && !harvested && (
        <span className="text-[10px]" style={{ color: '#888780' }}>
          {formatISODate(p.planted_at).slice(0, 5)}
        </span>
      )}
      {planted && !harvested && (
        <button
          onClick={onHarvest}
          disabled={busy}
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs touch-manipulation disabled:opacity-60"
          style={{ color: '#888780' }}
          aria-label={`${p.plant_name} abgeerntet`}
          title="Als abgeerntet markieren"
        >
          🌾
        </button>
      )}
      {harvested ? (
        <button
          onClick={onUnharvest}
          disabled={busy}
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs touch-manipulation disabled:opacity-60"
          style={{ color: '#888780' }}
          aria-label="Ernte rückgängig"
          title="Doch nicht abgeerntet"
        >
          ↶
        </button>
      ) : (
        <button
          onClick={onRemove}
          disabled={busy}
          className="w-6 h-6 rounded-full flex items-center justify-center text-sm touch-manipulation disabled:opacity-60"
          style={{ color: '#888780' }}
          aria-label={`${p.plant_name} entfernen`}
        >
          ×
        </button>
      )}
    </div>
  )
}

export function LastYearChip({
  p,
  onRemove,
  busy,
}: {
  p: PlantingWithPlant
  onRemove: () => void
  busy: boolean
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full pl-2 pr-1 py-1 text-xs"
      style={{
        backgroundColor: '#F0EFEA',
        color: '#888780',
        opacity: busy ? 0.5 : 1,
      }}
    >
      <Link href={`/plants/${p.plant_id}`} style={{ color: '#888780' }}>
        {p.plant_name}
      </Link>
      <button
        onClick={onRemove}
        disabled={busy}
        className="w-5 h-5 rounded-full flex items-center justify-center text-xs touch-manipulation disabled:opacity-60"
        style={{ color: '#888780' }}
        aria-label={`${p.plant_name} aus Vorjahr entfernen`}
      >
        ×
      </button>
    </span>
  )
}
