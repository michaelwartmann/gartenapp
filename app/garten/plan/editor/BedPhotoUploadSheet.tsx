'use client'

import { useState, useTransition } from 'react'
import { addBedPhoto } from '../actions'
import { compressImage } from '@/lib/imageCompression'

const PHOTO_MAX_DIM = 1024 // higher than backgrounds (768) — detail matters per shot

type Props = {
  bedId: string
  bedLabel: string
  /** Called after successful upload so the parent can refresh its strip. */
  onUploaded: () => void
  onClose: () => void
}

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

export default function BedPhotoUploadSheet({
  bedId,
  bedLabel,
  onUploaded,
  onClose,
}: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [date, setDate] = useState<string>(todayISO())
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    if (!f) return
    if (!f.type.startsWith('image/')) {
      setError('Bitte ein Bild auswählen.')
      return
    }
    setError(null)
    setFile(f)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(f))
  }

  function handleSubmit() {
    if (!file) return
    setError(null)
    startTransition(async () => {
      try {
        const blob = await compressImage(file, PHOTO_MAX_DIM)
        const fd = new FormData()
        fd.set('bedId', bedId)
        fd.set('file', blob, 'beet.webp')
        fd.set('takenAt', date)
        const res = await addBedPhoto(fd)
        if ('error' in res) {
          setError(
            res.error === 'no-garden'
              ? 'Bitte erneut anmelden.'
              : res.error === 'too-large'
              ? 'Bild ist zu groß. Versuche ein kleineres.'
              : res.error === 'invalid'
              ? 'Bild konnte nicht gelesen werden.'
              : 'Upload fehlgeschlagen. Versuch es nochmal.'
          )
          return
        }
        onUploaded()
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        onClose()
      } catch (err) {
        console.error('bed photo upload failed:', err)
        setError('Upload fehlgeschlagen. Versuch es nochmal.')
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
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
            📷 {bedLabel} · Foto hinzufügen
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

        {previewUrl && (
          <div
            className="w-full rounded-lg overflow-hidden border"
            style={{ borderColor: '#E8E6DF', maxHeight: '40vh' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt=""
              className="w-full h-full object-cover"
              style={{ maxHeight: '40vh' }}
            />
          </div>
        )}

        <div>
          <label
            htmlFor="bed-photo-file"
            className="block text-[11px] uppercase tracking-wide font-medium mb-1.5"
            style={{ color: '#888780' }}
          >
            Foto
          </label>
          <input
            id="bed-photo-file"
            type="file"
            accept="image/*"
            onChange={handleFileChosen}
            className="block w-full text-sm"
            style={{ color: '#2C2C2A' }}
          />
        </div>

        <div>
          <label
            htmlFor="bed-photo-date"
            className="block text-[11px] uppercase tracking-wide font-medium mb-1.5"
            style={{ color: '#888780' }}
          >
            Aufgenommen am
          </label>
          <input
            id="bed-photo-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
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

        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || !file}
          className="w-full py-3 rounded-lg text-white text-sm font-medium min-h-[48px] touch-manipulation disabled:opacity-40"
          style={{ backgroundColor: '#4A7C59' }}
        >
          {pending ? '…' : '✓ Hochladen'}
        </button>
        <p className="text-[11px] leading-relaxed" style={{ color: '#888780' }}>
          Foto wird in deinem Browser auf 1024 px verkleinert und als WebP
          hochgeladen.
        </p>
      </div>
    </div>
  )
}
