'use client'

import { useState, useTransition } from 'react'
import { updateBed } from './actions'
import { BED_KINDS } from '@/lib/bedKinds'

type Props = {
  bedId: string
  initialLabel: string
  initialKind: string
  onClose: () => void
}

export default function EditBedSheet({
  bedId,
  initialLabel,
  initialKind,
  onClose,
}: Props) {
  const [label, setLabel] = useState(initialLabel)
  const [kind, setKind] = useState<string>(initialKind)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await updateBed(bedId, label, kind)
      if ('error' in res) {
        setError(
          res.error === 'invalid'
            ? 'Bitte einen Namen angeben.'
            : 'Konnte nicht speichern.'
        )
        return
      }
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(44, 44, 42, 0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{ borderColor: '#E8E6DF' }}
        >
          <p className="text-base font-medium" style={{ color: '#2C2C2A' }}>
            Beet bearbeiten
          </p>
          <button
            onClick={onClose}
            className="text-2xl px-2 py-1 touch-manipulation shrink-0"
            style={{ color: '#888780' }}
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label
              className="block text-xs font-medium uppercase tracking-wide"
              style={{ color: '#888780' }}
            >
              Bezeichnung
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border bg-white text-base min-h-[48px]"
              style={{ borderColor: '#E8E6DF', color: '#2C2C2A' }}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label
              className="block text-xs font-medium uppercase tracking-wide"
              style={{ color: '#888780' }}
            >
              Art
            </label>
            <div className="grid grid-cols-3 gap-2">
              {BED_KINDS.map((opt) => {
                const active = opt.value === kind
                return (
                  <button
                    key={opt.value}
                    onClick={() => setKind(opt.value)}
                    className="flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-lg text-xs font-medium min-h-[64px] touch-manipulation"
                    style={{
                      backgroundColor: active ? '#4A7C59' : '#FFFFFF',
                      color: active ? '#FFFFFF' : '#2C2C2A',
                      border: `1px solid ${active ? '#4A7C59' : '#E8E6DF'}`,
                    }}
                  >
                    <span className="text-xl leading-none">{opt.icon}</span>
                    <span className="text-center leading-tight">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <p className="text-sm" style={{ color: '#C17B5C' }}>
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={submit}
              disabled={pending || !label.trim()}
              className="flex-1 px-4 py-3 rounded-lg text-white text-base font-medium min-h-[48px] touch-manipulation disabled:opacity-60"
              style={{ backgroundColor: '#4A7C59' }}
            >
              {pending ? '…' : 'Speichern'}
            </button>
            <button
              onClick={onClose}
              disabled={pending}
              className="flex-1 px-4 py-3 rounded-lg text-base font-medium border min-h-[48px] touch-manipulation"
              style={{ borderColor: '#E8E6DF', color: '#888780' }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
