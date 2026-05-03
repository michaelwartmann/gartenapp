'use client'

import { useEffect, useState } from 'react'
import type { BedPhoto } from '@/lib/supabase'
import { listBedPhotos } from '../actions'
import BedPhotoUploadSheet from './BedPhotoUploadSheet'
import BedPhotoViewer from './BedPhotoViewer'

type Props = {
  bedId: string
  bedLabel: string
}

function formatDayMonth(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${m[3]}.${m[2]}.`
}

/**
 * Stage 13 — horizontal scroll strip of bed photos with date stamps.
 * Lives in BedInlineView under the "Letztes Jahr" section. Tap a thumb
 * → fullscreen viewer; "+ Foto" opens upload sheet.
 */
export default function BedPhotoStrip({ bedId, bedLabel }: Props) {
  const [photos, setPhotos] = useState<BedPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [viewerStartIndex, setViewerStartIndex] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    try {
      const list = await listBedPhotos(bedId)
      setPhotos(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bedId])

  const hasPhotos = photos.length > 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p
          className="text-[11px] uppercase tracking-wide font-medium"
          style={{ color: '#888780' }}
        >
          📷 Tagebuch{hasPhotos ? ` (${photos.length})` : ''}
        </p>
        <button
          onClick={() => setUploadOpen(true)}
          className="text-xs font-medium touch-manipulation"
          style={{ color: '#4A7C59' }}
        >
          + Foto
        </button>
      </div>

      {loading ? (
        <p className="text-xs" style={{ color: '#C8C5BA' }}>
          …
        </p>
      ) : !hasPhotos ? (
        <p className="text-xs" style={{ color: '#C8C5BA' }}>
          Mach ein Foto, um den Beet-Verlauf festzuhalten — gut für nächstes
          Jahr.
        </p>
      ) : (
        <div
          className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setViewerStartIndex(i)}
              className="shrink-0 flex flex-col items-center gap-1 touch-manipulation"
              style={{ scrollSnapAlign: 'start' }}
              aria-label={`Foto vom ${formatDayMonth(p.taken_at)} öffnen`}
            >
              <div
                className="w-20 h-20 rounded-lg overflow-hidden border bg-white"
                style={{ borderColor: '#E8E6DF' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.photo_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <span
                className="text-[10px] leading-tight"
                style={{ color: '#888780' }}
              >
                {formatDayMonth(p.taken_at)}
              </span>
            </button>
          ))}
        </div>
      )}

      {uploadOpen && (
        <BedPhotoUploadSheet
          bedId={bedId}
          bedLabel={bedLabel}
          onUploaded={() => load()}
          onClose={() => setUploadOpen(false)}
        />
      )}

      {viewerStartIndex !== null && (
        <BedPhotoViewer
          photos={photos}
          startIndex={viewerStartIndex}
          onDeleted={() => load()}
          onClose={() => setViewerStartIndex(null)}
        />
      )}
    </div>
  )
}
