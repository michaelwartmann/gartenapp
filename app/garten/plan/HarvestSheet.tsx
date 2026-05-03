'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { recordHarvest } from './actions'
import type { PlantingHarvestSummary } from './actions'
import {
  HARVEST_UNITS,
  formatHarvest,
  harvestUnitMeta,
  type HarvestUnit,
} from '@/lib/harvestUnits'
import { REMOVED_REASONS, type RemovedReasonKey } from '@/lib/removedReasons'

type Props = {
  plantingId: string
  plantName: string
  /** Default unit suggested by the catalog (`plants.harvest_unit`). */
  defaultUnit: string | null
  /** Current season aggregate, used for the "Letzte … / Bisher …" hint. */
  summary: PlantingHarvestSummary | null
  onClose: () => void
}

function formatISODateShort(iso: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${m[3]}.${m[2]}.`
}

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

export default function HarvestSheet({
  plantingId,
  plantName,
  defaultUnit,
  summary,
  onClose,
}: Props) {
  const router = useRouter()
  const initialUnit: HarvestUnit =
    defaultUnit && HARVEST_UNITS.some((u) => u.key === defaultUnit)
      ? (defaultUnit as HarvestUnit)
      : 'kg'

  const [unit, setUnit] = useState<HarvestUnit>(initialUnit)
  const [amountText, setAmountText] = useState<string>('')
  const [date, setDate] = useState<string>(todayISO())
  const [notes, setNotes] = useState<string>('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Stage 10 — when "Pflanze raus" is tapped, expand a reason picker.
  const [reasonPickerOpen, setReasonPickerOpen] = useState(false)

  const meta = harvestUnitMeta(unit)

  function submit(
    amount: number,
    opts: { endPlanting: boolean; removedReason?: RemovedReasonKey }
  ) {
    setError(null)
    startTransition(async () => {
      const res = await recordHarvest({
        plantingId,
        amount,
        unit,
        date,
        notes: notes.trim() || null,
        endPlanting: opts.endPlanting,
        removedReason: opts.removedReason ?? null,
      })
      if ('error' in res) {
        setError(
          res.error === 'no-garden'
            ? 'Bitte erneut anmelden.'
            : res.error === 'invalid'
            ? 'Menge oder Einheit nicht gültig.'
            : 'Konnte nicht speichern. Versuch es nochmal.'
        )
        return
      }
      router.refresh()
      onClose()
    })
  }

  function quickAdd(amount: number) {
    submit(amount, { endPlanting: false })
  }

  function manualSave() {
    const n = Number(amountText.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) {
      setError('Bitte eine gültige Menge eintragen.')
      return
    }
    submit(n, { endPlanting: false })
  }

  function endPlantingWithReason(reasonKey: RemovedReasonKey) {
    const n = Number(amountText.replace(',', '.'))
    const amount = Number.isFinite(n) && n >= 0 ? n : 0
    submit(amount, { endPlanting: true, removedReason: reasonKey })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl p-4 pb-6 max-h-[90vh] overflow-y-auto space-y-4"
        style={{ backgroundColor: '#FAFAF7' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium" style={{ color: '#2C2C2A' }}>
            🌾 {plantName} · Ernte
          </h2>
          <button
            onClick={onClose}
            className="text-sm px-2 py-1 touch-manipulation"
            style={{ color: '#888780' }}
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        {summary && summary.count > 0 && (
          <div
            className="rounded-lg p-2.5 text-xs leading-relaxed"
            style={{ backgroundColor: '#F0F5F0', color: '#4A7C59' }}
          >
            {summary.lastAmount !== null && summary.lastUnit && (
              <p>
                ↩ Letzte:{' '}
                <span className="font-medium">
                  {formatHarvest(summary.lastAmount, summary.lastUnit)}
                </span>{' '}
                · {formatISODateShort(summary.lastDate)}
              </p>
            )}
            <p>
              {summary.totalUnit && summary.totalAmount !== null ? (
                <>
                  Bisher diese Saison:{' '}
                  <span className="font-medium">
                    {formatHarvest(summary.totalAmount, summary.totalUnit)}
                  </span>{' '}
                  ({summary.count})
                </>
              ) : (
                <>{summary.count} Einträge bisher</>
              )}
            </p>
          </div>
        )}

        <div>
          <label
            className="block text-[11px] uppercase tracking-wide font-medium mb-1.5"
            style={{ color: '#888780' }}
          >
            Schnell
          </label>
          <div className="flex flex-wrap gap-2">
            {meta.quickAmounts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => quickAdd(q)}
                disabled={pending}
                className="px-3 py-2 rounded-lg text-sm font-medium border touch-manipulation min-h-[40px] disabled:opacity-60"
                style={{
                  backgroundColor: '#4A7C59',
                  color: '#FFFFFF',
                  borderColor: '#4A7C59',
                }}
              >
                + {formatHarvest(q, unit)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            className="block text-[11px] uppercase tracking-wide font-medium mb-1.5"
            style={{ color: '#888780' }}
          >
            Oder manuell
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="Menge"
              className="flex-1 px-3 py-2 rounded-lg border bg-white text-base min-h-[44px] focus:outline-none"
              style={{ borderColor: '#E8E6DF', color: '#2C2C2A' }}
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as HarvestUnit)}
              className="px-3 py-2 rounded-lg border bg-white text-sm min-h-[44px] focus:outline-none"
              style={{ borderColor: '#E8E6DF', color: '#2C2C2A' }}
              aria-label="Einheit"
            >
              {HARVEST_UNITS.map((u) => (
                <option key={u.key} value={u.key}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          {defaultUnit && initialUnit !== unit && (
            <p className="text-[11px] mt-1" style={{ color: '#888780' }}>
              Standard für {plantName}: {harvestUnitMeta(defaultUnit).label}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="harvest-date"
            className="block text-[11px] uppercase tracking-wide font-medium mb-1.5"
            style={{ color: '#888780' }}
          >
            Datum
          </label>
          <input
            id="harvest-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border bg-white text-base min-h-[44px] focus:outline-none"
            style={{ borderColor: '#E8E6DF', color: '#2C2C2A' }}
          />
        </div>

        <div>
          <label
            htmlFor="harvest-notes"
            className="block text-[11px] uppercase tracking-wide font-medium mb-1.5"
            style={{ color: '#888780' }}
          >
            Notiz (optional)
          </label>
          <input
            id="harvest-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="z.B. erste reife, sehr süß"
            maxLength={200}
            className="w-full px-3 py-2 rounded-lg border bg-white text-base min-h-[44px] focus:outline-none"
            style={{ borderColor: '#E8E6DF', color: '#2C2C2A' }}
          />
        </div>

        {error && (
          <div
            className="rounded-lg p-2.5 text-sm"
            style={{ backgroundColor: '#FDE8E2', color: '#C17B5C' }}
          >
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={manualSave}
            disabled={pending || amountText.trim() === '' || reasonPickerOpen}
            className="flex-1 px-3 py-3 rounded-lg text-white text-sm font-medium min-h-[48px] touch-manipulation disabled:opacity-40"
            style={{ backgroundColor: '#4A7C59' }}
          >
            {pending ? '…' : '✓ Sichern'}
          </button>
          <button
            type="button"
            onClick={() => setReasonPickerOpen((v) => !v)}
            disabled={pending}
            className="flex-1 px-3 py-3 rounded-lg text-sm font-medium border min-h-[48px] touch-manipulation disabled:opacity-60"
            style={{
              color: '#C17B5C',
              borderColor: reasonPickerOpen ? '#C17B5C' : '#F2D8CD',
              backgroundColor: reasonPickerOpen ? '#FBF2EE' : '#FFFFFF',
            }}
            title="Letzte Ernte für diese Pflanze + raus aus dem Beet"
            aria-expanded={reasonPickerOpen}
          >
            🪦 Pflanze raus{reasonPickerOpen ? ' ▴' : ' ▾'}
          </button>
        </div>

        {reasonPickerOpen && (
          <div
            className="rounded-lg border p-3 space-y-2"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E6DF' }}
          >
            <p className="text-xs leading-relaxed" style={{ color: '#888780' }}>
              Warum geht die Pflanze raus? Tap = sofort speichern.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {REMOVED_REASONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => endPlantingWithReason(r.key)}
                  disabled={pending}
                  className="px-2 py-2 rounded-lg text-xs font-medium border touch-manipulation min-h-[40px] flex items-center justify-center gap-1.5 disabled:opacity-60"
                  style={{
                    borderColor:
                      r.tone === 'positive'
                        ? '#C9DCC9'
                        : r.tone === 'loss'
                        ? '#F2D8CD'
                        : r.tone === 'event'
                        ? '#DDE3EA'
                        : '#E8E6DF',
                    backgroundColor:
                      r.tone === 'positive'
                        ? '#F0F5F0'
                        : r.tone === 'loss'
                        ? '#FBF2EE'
                        : r.tone === 'event'
                        ? '#F4F6F9'
                        : '#FAFAF7',
                    color: '#2C2C2A',
                  }}
                >
                  <span>{r.emoji}</span>
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] leading-relaxed" style={{ color: '#888780' }}>
          „Sichern" loggt die Ernte und die Pflanze bleibt aktiv.
          „Pflanze raus" beendet die Saison mit Grund.
        </p>
      </div>
    </div>
  )
}
