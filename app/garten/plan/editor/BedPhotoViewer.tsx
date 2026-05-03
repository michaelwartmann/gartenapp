'use client'

import { useState, useTransition } from 'react'
import type { BedPhoto } from '@/lib/supabase'
import { deleteBedPhoto } from '../actions'

type Props = {
  photos: BedPhoto[]
  /** Index of the currently visible photo within `photos` (0 = newest). */
  startIndex: number
  /** Called after a delete succeeds so the parent can refresh + close. */
  onDeleted: () => void
  onClose: () => void
}

function formatISODate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
}

export default function BedPhotoViewer({
  photos,
  startIndex,
  onDeleted,
  onClose,
}: Props) {
  const [index, setIndex] = useState(
    Math.max(0, Math.min(photos.length - 1, startIndex))
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (photos.length === 0) return null
  const photo = photos[index]
  if (!photo) return null

  function prev() {
    setError(null)
    setConfirmDelete(false)
    setIndex((i) => (i + 1) % photos.length) // older
  }
  function next() {
    setError(null)
    setConfirmDelete(false)
    setIndex((i) => (i - 1 + photos.length) % photos.length) // newer
  }

  function doDelete() {
    setError(null)
    startTransition(async () => {
      const res = await deleteBedPhoto(photo.id)
      if ('error' in res) {
        setError('Konnte das Foto nicht löschen.')
        return
      }
      onDeleted()
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ backgroundColor: 'rgba(0,0,0,0.92)' }}
    >
      {/* Top bar — date + close */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ color: '#FAFAF7' }}
      >
        <div className="text-sm">
          <p className="font-medium">{formatISODate(photo.taken_at)}</p>
          <p className="text-xs" style={{ color: '#C8C5BA' }}>
            {index + 1} / {photos.length}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-base px-3 py-2 touch-manipulation"
          style={{ color: '#FAFAF7' }}
          aria-label="Schließen"
        >
          ✕
        </button>
      </div>

      {/* Image */}
      <div
        className="flex-1 flex items-center justify-center px-2"
        onClick={onClose}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.photo_url}
          alt={`Beet-Foto ${formatISODate(photo.taken_at)}`}
          className="max-w-full max-h-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Bottom bar — nav + delete */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-4 shrink-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      >
        <button
          onClick={prev}
          disabled={photos.length < 2}
          className="px-4 py-2 rounded-lg text-sm font-medium touch-manipulation disabled:opacity-30"
          style={{ color: '#FAFAF7', backgroundColor: 'rgba(255,255,255,0.1)' }}
          aria-label="Älteres Foto"
        >
          ← älter
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <button
              onClick={doDelete}
              disabled={pending}
              className="px-3 py-2 rounded-lg text-xs font-medium touch-manipulation"
              style={{ backgroundColor: '#C17B5C', color: '#FFFFFF' }}
            >
              {pending ? '…' : 'Wirklich löschen'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={pending}
              className="px-3 py-2 rounded-lg text-xs touch-manipulation"
              style={{ color: '#C8C5BA' }}
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-base px-3 py-2 touch-manipulation"
            style={{ color: '#FAFAF7' }}
            aria-label="Foto löschen"
          >
            🗑️
          </button>
        )}
        <button
          onClick={next}
          disabled={photos.length < 2}
          className="px-4 py-2 rounded-lg text-sm font-medium touch-manipulation disabled:opacity-30"
          style={{ color: '#FAFAF7', backgroundColor: 'rgba(255,255,255,0.1)' }}
          aria-label="Neueres Foto"
        >
          neuer →
        </button>
      </div>

      {error && (
        <div
          className="absolute bottom-20 left-4 right-4 rounded-lg p-2.5 text-sm text-center"
          style={{ backgroundColor: '#FDE8E2', color: '#C17B5C' }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
