'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Bed } from '@/lib/supabase'
import EditBedSheet from '../EditBedSheet'
import { updateBedLayout } from '../actions'
import {
  assignDefaultPositions,
  type BedLayout,
} from './autoLayout'

const BedCanvas = dynamic(() => import('./BedCanvas'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full rounded-xl border flex items-center justify-center"
      style={{
        borderColor: '#E8E6DF',
        backgroundColor: '#FAFAF7',
        height: 360,
        color: '#888780',
      }}
    >
      Skizze wird geladen…
    </div>
  ),
})

type Props = {
  beds: Bed[]
}

export default function EditorClient({ beds }: Props) {
  const router = useRouter()
  const initial = useMemo(() => assignDefaultPositions(beds), [beds])
  const [layouts, setLayouts] = useState<BedLayout[]>(initial)
  const [dirty, setDirty] = useState<boolean>(initial.some((l) => l.autoLaid))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [editBedId, setEditBedId] = useState<string | null>(null)

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    if (!dirty) return
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  function handleChange(next: BedLayout[]) {
    setLayouts(next)
    setDirty(true)
    setSavedFlash(false)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const updates = layouts.map((l) => ({
        id: l.id,
        x: Math.round(l.x),
        y: Math.round(l.y),
        w: Math.round(l.w),
        h: Math.round(l.h),
      }))
      const res = await updateBedLayout(updates)
      if ('error' in res) {
        setError(
          res.error === 'no-garden'
            ? 'Bitte erneut anmelden.'
            : 'Konnte nicht speichern. Versuch es nochmal.'
        )
        return
      }
      setDirty(false)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1500)
      router.refresh()
    })
  }

  const editBed = editBedId
    ? beds.find((b) => b.id === editBedId) ?? null
    : null

  return (
    <div
      className="min-h-screen px-4 py-6 pb-12"
      style={{ backgroundColor: '#FAFAF7' }}
    >
      <div className="w-full max-w-md mx-auto">
        <header className="mb-4 flex items-center justify-between gap-2">
          <Link
            href="/garten/plan"
            className="text-sm font-medium shrink-0"
            style={{ color: '#4A7C59' }}
          >
            ← Plan
          </Link>
          <h1
            className="text-base font-medium text-center flex-1"
            style={{ color: '#2C2C2A' }}
          >
            Skizze
          </h1>
          <button
            onClick={handleSave}
            disabled={pending || !dirty}
            className="px-3 py-2 rounded-lg text-sm font-medium text-white touch-manipulation disabled:opacity-40 shrink-0 min-h-[40px]"
            style={{ backgroundColor: '#4A7C59' }}
          >
            {pending ? '…' : savedFlash ? '✓ Gespeichert' : '✓ Speichern'}
          </button>
        </header>

        <p className="text-xs mb-3 leading-relaxed" style={{ color: '#888780' }}>
          Beete antippen zum Auswählen, ziehen zum Verschieben, am Eck-Griff
          größer/kleiner. Nochmal antippen öffnet die Bearbeitung.
        </p>

        {error && (
          <div
            className="text-sm mb-3 px-3 py-2 rounded-lg"
            style={{ color: '#C17B5C', backgroundColor: '#FBF2EE' }}
          >
            {error}
          </div>
        )}

        {dirty && initial.some((l) => l.autoLaid) && (
          <div
            className="text-xs mb-3 px-3 py-2 rounded-lg"
            style={{ color: '#4A7C59', backgroundColor: '#F0F5F0' }}
          >
            Beete wurden automatisch angeordnet — auf „✓ Speichern" tippen, um
            die Skizze zu sichern.
          </div>
        )}

        <BedCanvas
          beds={layouts}
          onChange={handleChange}
          onTapBed={(id) => setEditBedId(id)}
        />
      </div>

      {editBed && (
        <EditBedSheet
          bedId={editBed.id}
          initialLabel={editBed.label}
          initialKind={editBed.kind}
          onClose={() => {
            setEditBedId(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
