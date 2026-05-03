'use client'

import { useState, useTransition } from 'react'
import type { BedView, PlantingWithPlant, AddPlantingSeason } from '../actions'
import {
  deleteBed,
  removePlantingFromBed,
  markBedPlantingAsPlanted,
  markBedPlantingAsNotPlanted,
  unmarkBedPlantingAsHarvested,
} from '../actions'
import AddPlantSheet from '../AddPlantSheet'
import EditBedSheet from '../EditBedSheet'
import { CurrentChip, LastYearChip } from '../PlantChips'
import { bedKindIcon, bedKindLabel } from '@/lib/bedKinds'

type Props = {
  view: BedView
  /** Called after a delete completes so parent can clear selection. */
  onDeleted?: () => void
}

export default function BedInlineView({ view, onDeleted }: Props) {
  const { bed, current, lastYear } = view
  const [sheetSeason, setSheetSeason] = useState<AddPlantingSeason | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showLastYear, setShowLastYear] = useState(false)
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  function doDelete() {
    startTransition(async () => {
      await deleteBed(bed.id)
      onDeleted?.()
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
      className="rounded-xl border bg-white p-3 space-y-3"
      style={{ borderColor: '#E8E6DF' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">{bedKindIcon(bed.kind)}</span>
          <div className="min-w-0">
            <p
              className="text-sm font-medium leading-tight truncate"
              style={{ color: '#2C2C2A' }}
            >
              {bed.label}
            </p>
            <p className="text-[11px]" style={{ color: '#888780' }}>
              {bedKindLabel(bed.kind)}
            </p>
          </div>
        </div>
        {!confirmDelete ? (
          <div className="flex items-center gap-1 shrink-0">
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
          <div className="flex items-center gap-2 shrink-0">
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

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p
            className="text-[11px] uppercase tracking-wide font-medium"
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
          <p className="text-xs" style={{ color: '#888780' }}>
            Noch nichts geplant. Tipp das + an.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {current.map((p) => (
              <CurrentChip
                key={p.id}
                p={p}
                onToggle={() => doToggleState(p)}
                onRemove={() => doRemovePlanting(p.id)}
                onUnharvest={() => doUnharvest(p.id)}
                busy={busyId === p.id}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setShowLastYear((v) => !v)}
          className="w-full flex items-center justify-between text-left touch-manipulation"
          aria-expanded={showLastYear}
        >
          <p
            className="text-[11px] uppercase tracking-wide font-medium"
            style={{ color: '#888780' }}
          >
            Letztes Jahr {lastYear.length > 0 && `(${lastYear.length})`}
          </p>
          <span className="text-[11px]" style={{ color: '#888780' }}>
            {showLastYear ? '▴' : '▾'}
          </span>
        </button>
        {showLastYear && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5 flex-1">
              {lastYear.length === 0 ? (
                <p className="text-[11px]" style={{ color: '#C8C5BA' }}>
                  Trag ein, was hier letztes Jahr stand — die App nutzt das für
                  Fruchtfolge-Tipps.
                </p>
              ) : (
                lastYear.map((p) => (
                  <LastYearChip
                    key={p.id}
                    p={p}
                    onRemove={() => doRemovePlanting(p.id)}
                    busy={busyId === p.id}
                  />
                ))
              )}
            </div>
            <button
              onClick={() => setSheetSeason('last_year')}
              className="text-xs font-medium touch-manipulation shrink-0"
              style={{ color: '#888780' }}
            >
              + ergänzen
            </button>
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
