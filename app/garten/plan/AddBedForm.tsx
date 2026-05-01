'use client'

import { useState, useTransition } from 'react'
import { createBed } from './actions'

const KIND_OPTIONS: Array<{ value: string; label: string; icon: string }> = [
  { value: 'beet', label: 'Beet', icon: '🟫' },
  { value: 'hochbeet', label: 'Hochbeet', icon: '📦' },
  { value: 'gewaechshaus', label: 'Gewächshaus', icon: '🏠' },
  { value: 'topf', label: 'Topf', icon: '🪴' },
]

export default function AddBedForm() {
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
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="block w-full text-center py-4 rounded-xl border-2 border-dashed text-sm font-medium touch-none"
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
      <div className="flex gap-2 overflow-x-auto pb-1">
        {KIND_OPTIONS.map((opt) => {
          const active = opt.value === kind
          return (
            <button
              key={opt.value}
              onClick={() => setKind(opt.value)}
              className="px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap touch-none"
              style={{
                backgroundColor: active ? '#4A7C59' : '#FFFFFF',
                color: active ? '#FFFFFF' : '#2C2C2A',
                border: `1px solid ${active ? '#4A7C59' : '#E8E6DF'}`,
              }}
            >
              {opt.icon} {opt.label}
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
          className="flex-1 px-4 py-3 rounded-lg text-white text-base font-medium min-h-[48px] touch-none disabled:opacity-60"
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
          className="flex-1 px-4 py-3 rounded-lg text-base font-medium border min-h-[48px] touch-none"
          style={{ borderColor: '#E8E6DF', color: '#888780' }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}
