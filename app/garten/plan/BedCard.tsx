'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { BedView, PlantingWithPlant } from './actions'
import {
  deleteBed,
  removePlantingFromBed,
  markBedPlantingAsPlanted,
  markBedPlantingAsNotPlanted,
  markBedPlantingAsHarvested,
  unmarkBedPlantingAsHarvested,
} from './actions'
import AddPlantSheet from './AddPlantSheet'
import EditBedSheet from './EditBedSheet'
import type { AddPlantingSeason } from './actions'
import { bedKindIcon, bedKindLabel } from '@/lib/bedKinds'

const CATEGORY_BG: Record<string, string> = {
  Gemüse: '#4A7C59',
  Kraut: '#C17B5C',
  Blume: '#8B5A95',
  Obst: '#D49C3D',
  Baum: '#5C7C4A',
  Strauch: '#8FA376',
  Nuss: '#A37D5C',
}

function formatISODate(iso: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
}

function CurrentChip({
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

function LastYearChip({
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

export default function BedCard({ view }: { view: BedView }) {
  const { bed, current, lastYear } = view
  const [sheetSeason, setSheetSeason] = useState<AddPlantingSeason | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  function doDelete() {
    startTransition(async () => {
      await deleteBed(bed.id)
    })
  }

  function doToggleState(p: PlantingWithPlant) {
    setBusyId(p.id)
    startTransition(async () => {
      if (p.planted_at) {
        await markBedPlantingAsNotPlanted(p.id)
      } else {
        await markBedPlantingAsPlanted(p.id)
      }
      setBusyId(null)
    })
  }

  function doHarvest(id: string) {
    setBusyId(id)
    startTransition(async () => {
      await markBedPlantingAsHarvested(id)
      setBusyId(null)
    })
  }

  function doUnharvest(id: string) {
    setBusyId(id)
    startTransition(async () => {
      await unmarkBedPlantingAsHarvested(id)
      setBusyId(null)
    })
  }

  function doRemovePlanting(id: string) {
    setBusyId(id)
    startTransition(async () => {
      await removePlantingFromBed(id)
      setBusyId(null)
    })
  }

  return (
    <div
      className="bg-white rounded-xl border p-4 space-y-4"
      style={{ borderColor: '#E8E6DF' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl shrink-0">
            {bedKindIcon(bed.kind)}
          </span>
          <div className="min-w-0">
            <p
              className="text-base font-medium leading-tight truncate"
              style={{ color: '#2C2C2A' }}
            >
              {bed.label}
            </p>
            <p className="text-xs" style={{ color: '#888780' }}>
              {bedKindLabel(bed.kind)}
            </p>
          </div>
        </div>
        {!confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditOpen(true)}
              className="text-sm px-2 py-1 touch-manipulation"
              style={{ color: '#888780' }}
              aria-label="Beet bearbeiten"
            >
              ✏️
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-sm px-2 py-1 touch-manipulation"
              style={{ color: '#888780' }}
              aria-label="Beet löschen"
            >
              🗑️
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={doDelete}
              disabled={pending}
              className="text-xs px-2 py-1 rounded touch-manipulation"
              style={{ backgroundColor: '#FDE8E2', color: '#C17B5C' }}
            >
              {pending ? '…' : 'Löschen'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs px-2 py-1 rounded touch-manipulation"
              style={{ color: '#888780' }}
            >
              Abbrechen
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p
            className="text-xs uppercase tracking-wide font-medium"
            style={{ color: '#888780' }}
          >
            Diese Saison
          </p>
          <button
            onClick={() => setSheetSeason('current')}
            className="text-xs font-medium touch-manipulation"
            style={{ color: '#4A7C59' }}
          >
            + Pflanze
          </button>
        </div>
        {current.length === 0 ? (
          <p className="text-sm" style={{ color: '#888780' }}>
            Noch nichts geplant. Tipp das + an.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {current.map((p) => (
              <CurrentChip
                key={p.id}
                p={p}
                onToggle={() => doToggleState(p)}
                onRemove={() => doRemovePlanting(p.id)}
                onHarvest={() => doHarvest(p.id)}
                onUnharvest={() => doUnharvest(p.id)}
                busy={busyId === p.id}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p
            className="text-xs uppercase tracking-wide font-medium"
            style={{ color: '#888780' }}
          >
            Letztes Jahr
          </p>
          <button
            onClick={() => setSheetSeason('last_year')}
            className="text-xs font-medium touch-manipulation"
            style={{ color: '#888780' }}
          >
            + ergänzen
          </button>
        </div>
        {lastYear.length === 0 ? (
          <p className="text-xs" style={{ color: '#C8C5BA' }}>
            Trag ein, was hier letztes Jahr stand — die App nutzt das für
            Fruchtfolge-Tipps.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {lastYear.map((p) => (
              <LastYearChip
                key={p.id}
                p={p}
                onRemove={() => doRemovePlanting(p.id)}
                busy={busyId === p.id}
              />
            ))}
          </div>
        )}
      </div>

      {sheetSeason && (
        <AddPlantSheet
          bedId={bed.id}
          bedLabel={bed.label}
          bedKind={bed.kind}
          season={sheetSeason}
          onClose={() => setSheetSeason(null)}
        />
      )}

      {editOpen && (
        <EditBedSheet
          bedId={bed.id}
          initialLabel={bed.label}
          initialKind={bed.kind}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  )
}
