'use client'

import { useState } from 'react'
import {
  MONTHS,
  LIFECYCLES,
  NUTRIENTS,
  LIGHTS,
  activeSmartCount,
  EMPTY_FILTERS,
  type SmartFilters,
  type Month,
} from '@/lib/plantFilters'

type Props = {
  filters: SmartFilters
  onChange: (next: SmartFilters) => void
}

/**
 * Stage 12.1 — collapsible smart-filter panel + active-chip strip.
 * Reused on `/browse` (catalog) and `/` (Mein Garten home).
 */
export default function PlantFilterPanel({ filters, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const count = activeSmartCount(filters)

  function patch<K extends keyof SmartFilters>(key: K, value: SmartFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  function clear<K extends keyof SmartFilters>(key: K) {
    onChange({ ...filters, [key]: null as SmartFilters[K] })
  }

  function clearAll() {
    onChange(EMPTY_FILTERS)
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium px-3 py-1.5 rounded-full border touch-manipulation flex items-center gap-1.5"
        style={{
          color: '#4A7C59',
          borderColor: '#C9DCC9',
          backgroundColor: count > 0 ? '#F0F5F0' : '#FFFFFF',
        }}
        aria-expanded={open}
      >
        🔍 Filter{count > 0 ? ` (${count})` : ''}{' '}
        <span style={{ color: '#888780' }}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div
          className="rounded-xl border bg-white p-3 space-y-3"
          style={{ borderColor: '#E8E6DF' }}
        >
          <FilterMonthPicker
            label="🌱 Saatzeit"
            value={filters.seedMonth}
            onChange={(v) => patch('seedMonth', v)}
          />
          <FilterMonthPicker
            label="🌾 Erntezeit"
            value={filters.harvestMonth}
            onChange={(v) => patch('harvestMonth', v)}
          />
          <FilterPillRow
            label="Lebenszyklus"
            options={LIFECYCLES}
            value={filters.lifecycle}
            onChange={(v) => patch('lifecycle', v)}
          />
          <FilterPillRow
            label="Zehrertyp"
            options={NUTRIENTS}
            value={filters.nutrient}
            onChange={(v) => patch('nutrient', v)}
          />
          <FilterPillRow
            label="Standort"
            options={LIGHTS}
            value={filters.light}
            onChange={(v) => patch('light', v)}
          />
        </div>
      )}

      {count > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.seedMonth && (
            <ActiveChip
              label={`Saat: ${filters.seedMonth}`}
              onRemove={() => clear('seedMonth')}
            />
          )}
          {filters.harvestMonth && (
            <ActiveChip
              label={`Ernte: ${filters.harvestMonth}`}
              onRemove={() => clear('harvestMonth')}
            />
          )}
          {filters.lifecycle && (
            <ActiveChip
              label={filters.lifecycle}
              onRemove={() => clear('lifecycle')}
            />
          )}
          {filters.nutrient && (
            <ActiveChip
              label={filters.nutrient}
              onRemove={() => clear('nutrient')}
            />
          )}
          {filters.light && (
            <ActiveChip
              label={filters.light}
              onRemove={() => clear('light')}
            />
          )}
          <button
            onClick={clearAll}
            className="text-xs px-2 py-1 touch-manipulation"
            style={{ color: '#888780' }}
          >
            alle zurücksetzen
          </button>
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
