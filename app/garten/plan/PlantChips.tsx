'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { PlantingWithPlant } from './actions'
import HarvestSheet from './HarvestSheet'
import { formatHarvest } from '@/lib/harvestUnits'

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
  onUnharvest,
  busy,
}: {
  p: PlantingWithPlant
  onToggle: () => void
  onRemove: () => void
  /** Stage 9: 🌾 onHarvest is now opening the HarvestSheet (handled inside).
   *  onUnharvest stays for the ↶ undo button on already-removed plantings. */
  onUnharvest: () => void
  busy: boolean
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const planted = !!p.planted_at
  const harvested = !!p.removed_at
  const bg = CATEGORY_BG[p.plant_category] ?? '#888780'
  // Stage 9 — Pflanzen ohne harvest_unit (Blumen) bekommen keinen 🌾-Button.
  const supportsHarvest = !!p.plant_harvest_unit
  const summary = p.harvest_summary

  return (
    <>
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
        {planted && p.planted_at && !harvested && !summary && (
          <span className="text-[10px]" style={{ color: '#888780' }}>
            {formatISODate(p.planted_at).slice(0, 5)}
          </span>
        )}
        {summary && summary.totalUnit && summary.totalAmount !== null && (
          <span
            className="text-[10px] px-1.5 rounded-full"
            style={{
              backgroundColor: harvested ? '#FFFFFF' : bg + '33',
              color: harvested ? '#888780' : '#2C2C2A',
            }}
            title={`${summary.count} Ernte${summary.count > 1 ? 'n' : ''} bisher`}
          >
            🌾 {formatHarvest(summary.totalAmount, summary.totalUnit)}
          </span>
        )}
        {summary && summary.totalUnit === null && summary.count > 0 && (
          <span
            className="text-[10px] px-1.5 rounded-full"
            style={{ backgroundColor: bg + '33', color: '#2C2C2A' }}
            title="Mehrere Einheiten — siehe Plant-Detail für Verlauf"
          >
            🌾 {summary.count}×
          </span>
        )}
        {planted && !harvested && supportsHarvest && (
          <button
            onClick={() => setSheetOpen(true)}
            disabled={busy}
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs touch-manipulation disabled:opacity-60"
            style={{ color: '#888780' }}
            aria-label={`${p.plant_name} ernten`}
            title="Ernte erfassen"
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
            aria-label="Wieder als aktiv markieren"
            title="Pflanze wieder aktiv"
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
      {sheetOpen && (
        <HarvestSheet
          plantingId={p.id}
          plantName={p.plant_name}
          defaultUnit={p.plant_harvest_unit}
          summary={summary}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
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
