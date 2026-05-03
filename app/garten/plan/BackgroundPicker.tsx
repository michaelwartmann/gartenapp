'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CANVAS_BACKGROUNDS, type CanvasBackgroundKey } from '@/lib/canvasBackgrounds'
import { setGardenBackground } from './actions'

type Props = {
  currentKey: string | null
  onClose: () => void
}

export default function BackgroundPicker({ currentKey, onClose }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const activeKey = currentKey ?? 'default'

  function pick(key: CanvasBackgroundKey) {
    setError(null)
    setBusyKey(key)
    startTransition(async () => {
      const res = await setGardenBackground(key)
      setBusyKey(null)
      if ('error' in res) {
        setError(
          res.error === 'no-garden'
            ? 'Bitte erneut anmelden.'
            : 'Konnte Hintergrund nicht setzen.'
        )
        return
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-2xl p-4 pb-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: '#FAFAF7' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium" style={{ color: '#2C2C2A' }}>
            🎨 Hintergrund
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

        <p className="text-xs mb-4" style={{ color: '#888780' }}>
          Wähle eine Stimmung für deine Skizze. Wirkt nur auf diesen Garten.
        </p>

        {error && (
          <div
            className="text-sm mb-3 px-3 py-2 rounded-lg"
            style={{ color: '#C17B5C', backgroundColor: '#FBF2EE' }}
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {CANVAS_BACKGROUNDS.map((bg) => {
            const active = bg.key === activeKey
            const isBusy = busyKey === bg.key
            return (
              <button
                key={bg.key}
                type="button"
                disabled={pending}
                onClick={() => pick(bg.key)}
                className="relative rounded-xl overflow-hidden border touch-manipulation flex flex-col disabled:opacity-60"
                style={{
                  borderColor: active ? '#4A7C59' : '#E8E6DF',
                  borderWidth: active ? 2 : 1,
                  backgroundColor: '#FFFFFF',
                  aspectRatio: '2 / 3',
                  minHeight: 140,
                }}
                aria-pressed={active}
              >
                {bg.path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bg.path}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center text-3xl"
                    style={{ backgroundColor: '#FAFAF7', color: '#C8C5BA' }}
                  >
                    {bg.emoji}
                  </div>
                )}
                <div
                  className="absolute bottom-0 inset-x-0 px-2 py-1.5 text-xs font-medium flex items-center justify-between"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.92)',
                    color: '#2C2C2A',
                  }}
                >
                  <span className="flex items-center gap-1">
                    <span>{bg.emoji}</span>
                    <span>{bg.label}</span>
                  </span>
                  {active && <span style={{ color: '#4A7C59' }}>✓</span>}
                  {isBusy && <span style={{ color: '#888780' }}>…</span>}
                </div>
              </button>
            )
          })}
        </div>

        <p className="text-[11px] mt-4" style={{ color: '#888780' }}>
          Eigenes Foto hochladen kommt später (Stage 5C).
        </p>
      </div>
    </div>
  )
}
