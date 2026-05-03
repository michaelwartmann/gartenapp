'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CANVAS_BACKGROUNDS,
  CUSTOM_BACKGROUND_DEFAULT_OPACITY,
  type CanvasBackgroundKey,
} from '@/lib/canvasBackgrounds'
import {
  setGardenBackground,
  uploadGardenBackground,
  removeCustomGardenBackground,
  setCustomBackgroundOpacity,
} from './actions'

type Props = {
  currentKey: string | null
  customUrl?: string | null
  customOpacity?: number | null
  onClose: () => void
}

const COMPRESS_MAX_DIM = 768
const COMPRESS_QUALITY = 0.78

/**
 * Resize the picked file to ≤ COMPRESS_MAX_DIM on the longer side and
 * re-encode as WebP at COMPRESS_QUALITY. Falls back to the original Blob
 * unchanged if WebP isn't supported (very old iOS, etc.) — the server
 * accepts JPEG/PNG too.
 */
async function compressImage(file: File): Promise<Blob> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(r.error ?? new Error('FileReader failed'))
    r.readAsDataURL(file)
  })
  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('Image decode failed'))
    im.src = dataUrl
  })
  const longest = Math.max(img.width, img.height)
  const ratio = longest > COMPRESS_MAX_DIM ? COMPRESS_MAX_DIM / longest : 1
  const w = Math.max(1, Math.round(img.width * ratio))
  const h = Math.max(1, Math.round(img.height * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, w, h)
  const blob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob(
      (b) => resolve(b),
      'image/webp',
      COMPRESS_QUALITY
    )
  })
  if (blob && blob.size > 0) return blob
  // Fallback: try JPEG, otherwise return original
  const jpeg: Blob | null = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
  })
  return jpeg && jpeg.size > 0 ? jpeg : file
}

export default function BackgroundPicker({
  currentKey,
  customUrl,
  customOpacity,
  onClose,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  // Slider stays controlled locally so dragging is smooth; persists on release.
  const [opacityDraft, setOpacityDraft] = useState<number>(
    customOpacity ?? CUSTOM_BACKGROUND_DEFAULT_OPACITY
  )
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const activeKey = currentKey ?? 'default'
  const customActive = activeKey === 'custom' && !!customUrl
  const hasCustomOnFile = !!customUrl

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

  function openFilePicker() {
    setError(null)
    fileInputRef.current?.click()
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so picking same file twice still triggers
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Bitte ein Bild auswählen.')
      return
    }
    setError(null)
    setUploading(true)
    setBusyKey('custom')
    try {
      const blob = await compressImage(file)
      const fd = new FormData()
      fd.set('file', blob, 'background.webp')
      const res = await uploadGardenBackground(fd)
      if ('error' in res) {
        setError(
          res.error === 'no-garden'
            ? 'Bitte erneut anmelden.'
            : res.error === 'too-large'
            ? 'Bild ist nach Komprimierung zu groß. Versuche ein anderes.'
            : res.error === 'invalid'
            ? 'Bild konnte nicht gelesen werden.'
            : 'Upload fehlgeschlagen. Versuch es nochmal.'
        )
        return
      }
      router.refresh()
      onClose()
    } catch (err) {
      console.error('background upload failed:', err)
      setError('Upload fehlgeschlagen. Versuch es nochmal.')
    } finally {
      setUploading(false)
      setBusyKey(null)
    }
  }

  function commitOpacity(next: number) {
    if (!Number.isFinite(next)) return
    startTransition(async () => {
      const res = await setCustomBackgroundOpacity(next)
      if ('error' in res) {
        setError('Konnte Transparenz nicht speichern.')
        return
      }
      router.refresh()
    })
  }

  function removeCustom() {
    startTransition(async () => {
      const res = await removeCustomGardenBackground()
      if ('error' in res) {
        setError('Konnte Foto nicht entfernen.')
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
        className="bg-white w-full max-w-md rounded-t-2xl p-4 pb-6 max-h-[90vh] overflow-y-auto"
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
                disabled={pending || uploading}
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

          {/* Stage 5C — Custom photo tile (always last in the grid). */}
          <button
            type="button"
            disabled={pending || uploading}
            onClick={openFilePicker}
            className="relative rounded-xl overflow-hidden border touch-manipulation flex flex-col disabled:opacity-60"
            style={{
              borderColor: customActive ? '#4A7C59' : '#E8E6DF',
              borderWidth: customActive ? 2 : 1,
              backgroundColor: '#FFFFFF',
              aspectRatio: '2 / 3',
              minHeight: 140,
            }}
            aria-pressed={customActive}
            aria-label={hasCustomOnFile ? 'Foto ersetzen' : 'Eigenes Foto hochladen'}
          >
            {hasCustomOnFile ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={customUrl ?? ''}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                style={{ backgroundColor: '#FFFFFF', color: '#4A7C59' }}
              >
                <span className="text-3xl">📸</span>
                <span className="text-xs font-medium px-2 text-center">
                  Eigenes Foto<br />hochladen
                </span>
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
                <span>📸</span>
                <span>{hasCustomOnFile ? 'Mein Foto' : 'Foto'}</span>
              </span>
              {customActive && <span style={{ color: '#4A7C59' }}>✓</span>}
              {(busyKey === 'custom' || uploading) && (
                <span style={{ color: '#888780' }}>…</span>
              )}
            </div>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChosen}
        />

        {customActive && (
          <div
            className="mt-4 rounded-xl border bg-white p-3 space-y-3"
            style={{ borderColor: '#E8E6DF' }}
          >
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="bg-opacity"
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: '#888780' }}
              >
                Transparenz · {Math.round(opacityDraft * 100)}%
              </label>
              <button
                type="button"
                onClick={removeCustom}
                disabled={pending}
                className="text-xs px-2 py-1 rounded touch-manipulation"
                style={{ color: '#C17B5C', backgroundColor: '#FBF2EE' }}
              >
                🗑️ Entfernen
              </button>
            </div>
            <input
              id="bg-opacity"
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(opacityDraft * 100)}
              onChange={(e) => setOpacityDraft(Number(e.target.value) / 100)}
              onMouseUp={() => commitOpacity(opacityDraft)}
              onTouchEnd={() => commitOpacity(opacityDraft)}
              className="w-full touch-manipulation"
              style={{ accentColor: '#4A7C59' }}
            />
            <p className="text-[11px] leading-relaxed" style={{ color: '#888780' }}>
              Beete sollen lesbar bleiben — meistens zwischen 30 und 60 %.
            </p>
          </div>
        )}

        <p className="text-[11px] mt-4" style={{ color: '#888780' }}>
          Foto wird in deinen Browser auf 768 px verkleinert und als WebP
          hochgeladen. Liegt im Garten-Bucket bei Supabase, nicht öffentlich
          listbar.
        </p>
      </div>
    </div>
  )
}
