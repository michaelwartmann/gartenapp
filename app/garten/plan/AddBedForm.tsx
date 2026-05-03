'use client'

import { useState, useTransition } from 'react'
import { createBed } from './actions'
import { BED_KINDS } from '@/lib/bedKinds'

type Props = {
  /** Stage 8.2 — called with the new bed's id after createBed succeeds.
   *  EditorClient uses this to auto-select the new bed so the user sees it. */
  onAdded?: (bedId: string) => void
}

export default function AddBedForm({ onAdded }: Props = {}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<string>('beet')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setLabel('')
    setKind('beet')
    setError(null)
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await createBed(label, kind)
      if ('error' in res) {
        setError(
          res.error === 'invalid'
            ? 'Bitte einen Namen angeben.'
            : 'Konnte nicht speichern.'
        )
        return
      }
      reset()
      setOpen(false)
      if (onAdded) onAdded(res.bed.id)
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="block w-full text-center py-4 rounded-xl border-2 border-dashed text-sm font-medium touch-manipulation"
        style={{ borderColor: '#C8C5BA', color: '#4A7C59' }}
      >
        + Beet hinzufügen
      </button>
    )
  }

  return (
    <div
      className="bg-white rounded-xl border p-4 space-y-3"
      style={{ borderColor: '#E8E6DF' }}
    >
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Bezeichnung (z.B. Hochbeet hinten)"
        className="w-full px-4 py-3 rounded-lg border bg-white text-base min-h-[48px]"
        style={{ borderColor: '#E8E6DF', color: '#2C2C2A' }}
        autoFocus
      />
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
      {error && (
        <p className="text-sm" style={{ color: '#C17B5C' }}>
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending || !label.trim()}
          className="flex-1 px-4 py-3 rounded-lg text-white text-base font-medium min-h-[48px] touch-manipulation disabled:opacity-60"
          style={{ backgroundColor: '#4A7C59' }}
        >
          {pending ? '…' : 'Anlegen'}
        </button>
        <button
          onClick={() => {
            reset()
            setOpen(false)
          }}
          disabled={pending}
          className="flex-1 px-4 py-3 rounded-lg text-base font-medium border min-h-[48px] touch-manipulation"
          style={{ borderColor: '#E8E6DF', color: '#888780' }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}
