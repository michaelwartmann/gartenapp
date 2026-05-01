'use client'

import { useState, useTransition } from 'react'
import { setupGardenLocation } from './actions'

const COUNTRIES: Array<{ code: 'DE' | 'AT' | 'CH' | 'NL'; flag: string; label: string }> = [
  { code: 'DE', flag: '🇩🇪', label: 'DE' },
  { code: 'AT', flag: '🇦🇹', label: 'AT' },
  { code: 'CH', flag: '🇨🇭', label: 'CH' },
  { code: 'NL', flag: '🇳🇱', label: 'NL' },
]

export default function WeatherSetup() {
  const [open, setOpen] = useState(false)
  const [zip, setZip] = useState('')
  const [country, setCountry] = useState<'DE' | 'AT' | 'CH' | 'NL'>('DE')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await setupGardenLocation(zip, country)
      if ('error' in res) {
        setError(
          res.error === 'not-found'
            ? `PLZ ${zip} (${country}) nicht gefunden — stimmt das?`
            : res.error === 'invalid'
            ? 'Bitte eine PLZ eingeben.'
            : 'Konnte den Standort nicht speichern.'
        )
        return
      }
      setOpen(false)
      setZip('')
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="block w-full mb-6 rounded-xl p-4 text-left transition-all duration-200 active:scale-95"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E6DF',
          color: '#2C2C2A',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl shrink-0">📍</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-tight">
              Wetter aktivieren
            </p>
            <p
              className="text-xs leading-tight mt-0.5"
              style={{ color: '#888780' }}
            >
              Gib deine Postleitzahl ein, um 7-Tage-Vorhersage und Wetter-
              Tipps direkt im Garten zu sehen.
            </p>
          </div>
          <span style={{ color: '#4A7C59' }}>›</span>
        </div>
      </button>
    )
  }

  return (
    <div
      className="bg-white rounded-xl border p-4 mb-6 space-y-3"
      style={{ borderColor: '#E8E6DF' }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: '#2C2C2A' }}>
          📍 Standort des Gartens
        </p>
        <button
          onClick={() => setOpen(false)}
          className="text-xs touch-none"
          style={{ color: '#888780' }}
        >
          Abbrechen
        </button>
      </div>
      <div className="flex gap-2">
        {COUNTRIES.map((c) => {
          const active = c.code === country
          return (
            <button
              key={c.code}
              onClick={() => setCountry(c.code)}
              className="px-3 py-2 rounded-full text-sm font-medium touch-none"
              style={{
                backgroundColor: active ? '#4A7C59' : '#FFFFFF',
                color: active ? '#FFFFFF' : '#2C2C2A',
                border: `1px solid ${active ? '#4A7C59' : '#E8E6DF'}`,
              }}
            >
              {c.flag} {c.label}
            </button>
          )
        })}
      </div>
      <input
        type="text"
        value={zip}
        onChange={(e) => setZip(e.target.value)}
        placeholder={
          country === 'DE'
            ? 'PLZ z.B. 70173'
            : country === 'AT'
            ? 'PLZ z.B. 1010'
            : country === 'CH'
            ? 'PLZ z.B. 8001'
            : 'Postcode z.B. 6811'
        }
        className="w-full px-4 py-3 rounded-lg border bg-white text-base min-h-[48px]"
        style={{ borderColor: '#E8E6DF', color: '#2C2C2A' }}
        autoFocus
        inputMode="numeric"
      />
      {error && (
        <p className="text-sm" style={{ color: '#C17B5C' }}>
          {error}
        </p>
      )}
      <button
        onClick={submit}
        disabled={pending || !zip.trim()}
        className="w-full px-4 py-3 rounded-lg text-white text-base font-medium min-h-[48px] touch-none disabled:opacity-60"
        style={{ backgroundColor: '#4A7C59' }}
      >
        {pending ? '…' : 'Speichern'}
      </button>
    </div>
  )
}
