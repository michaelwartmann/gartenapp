'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createPlantAndAdd, type CreateResult } from './actions'

const CATEGORIES = [
  { value: 'Gemüse', color: '#4A7C59' },
  { value: 'Kraut', color: '#C17B5C' },
  { value: 'Blume', color: '#8B5A95' },
  { value: 'Obst', color: '#D49C3D' },
  { value: 'Baum', color: '#5C7C4A' },
  { value: 'Strauch', color: '#8FA376' },
  { value: 'Nuss', color: '#A37D5C' },
] as const

type Props = {
  /** Called when the server action returns ok=true. The parent decides what
   *  happens next (typically: show AssignBedSheet, then redirect). */
  onSuccess: (result: Extract<CreateResult, { ok: true }>) => void
}

export default function AddPlantForm({ onSuccess }: Props) {
  const searchParams = useSearchParams()
  const prefilledName = searchParams.get('name') ?? ''
  // Keep insertion order so the *first* picked category is the primary
  // (used for the colored display-pill on plant detail).
  const [categoryOrder, setCategoryOrder] = useState<string[]>([
    CATEGORIES[0].value,
  ])
  const selectedSet = useMemo(() => new Set(categoryOrder), [categoryOrder])
  const primary = categoryOrder[0] ?? CATEGORIES[0].value
  const categoriesCSV = categoryOrder.join(',')

  const [state, formAction, pending] = useActionState<CreateResult | null, FormData>(
    async (_prev, formData) => createPlantAndAdd(_prev, formData),
    null
  )

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      onSuccess(state)
    }
  }, [state, onSuccess])

  function toggle(cat: string) {
    setCategoryOrder((cur) => {
      if (cur.includes(cat)) {
        const next = cur.filter((c) => c !== cat)
        // Always keep at least one; if the user toggles off the last, restore it.
        return next.length === 0 ? cur : next
      }
      return [...cur, cat]
    })
  }

  const errorMessage =
    state && 'error' in state
      ? state.error === 'invalid'
        ? 'Bitte Name und mindestens eine Kategorie ausfüllen.'
        : state.error === 'no-garden'
          ? 'Garten nicht gefunden — bitte neu anmelden.'
          : 'Ups — etwas ist schiefgelaufen. Bitte nochmal.'
      : null

  const submitted = state && 'ok' in state && state.ok

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="category" value={primary} />
      <input type="hidden" name="categories" value={categoriesCSV} />

      <div className="space-y-2">
        <label
          htmlFor="name"
          className="block text-xs font-medium uppercase tracking-wide"
          style={{ color: '#888780' }}
        >
          Name *
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={prefilledName}
          maxLength={80}
          placeholder="z.B. Hortensie"
          autoFocus
          className="w-full p-4 rounded-lg border bg-white text-base min-h-[48px] focus:outline-none"
          style={{ borderColor: '#E8E6DF', color: '#2C2C2A' }}
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="latin_name"
          className="block text-xs font-medium uppercase tracking-wide"
          style={{ color: '#888780' }}
        >
          Lateinischer Name (optional)
        </label>
        <input
          id="latin_name"
          name="latin_name"
          type="text"
          maxLength={80}
          placeholder="z.B. Hydrangea macrophylla"
          className="w-full p-4 rounded-lg border bg-white text-base min-h-[48px] italic focus:outline-none"
          style={{ borderColor: '#E8E6DF', color: '#2C2C2A' }}
        />
      </div>

      <div className="space-y-2">
        <label
          className="block text-xs font-medium uppercase tracking-wide"
          style={{ color: '#888780' }}
        >
          Kategorie *
        </label>
        <p className="text-xs leading-snug" style={{ color: '#888780' }}>
          Mehrfach möglich. Die zuerst gewählte ist die Primär-Kategorie für
          Farbe und Anzeige.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((cat) => {
            const active = selectedSet.has(cat.value)
            const isPrimary = active && cat.value === primary
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => toggle(cat.value)}
                className="p-3 rounded-lg border text-sm font-medium min-h-[48px] touch-manipulation flex items-center justify-center gap-1"
                style={{
                  backgroundColor: active ? cat.color : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#2C2C2A',
                  borderColor: active ? cat.color : '#E8E6DF',
                }}
              >
                <span>{cat.value}</span>
                {isPrimary && categoryOrder.length > 1 && (
                  <span className="text-[10px] opacity-80">★</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div
        className="rounded-lg p-3 text-xs leading-relaxed"
        style={{ backgroundColor: '#F0EDE4', color: '#4A7C59' }}
      >
        ✨ Die Felder deiner Pflanzen-Karteikarte werden im Hintergrund mit
        Gemini automatisch ausgefüllt. Du kannst alles später selbst anpassen.
      </div>

      {errorMessage && (
        <div
          className="rounded-lg p-3 text-sm"
          style={{ backgroundColor: '#FDE8E2', color: '#C17B5C' }}
        >
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || !!submitted || categoryOrder.length === 0}
        className="w-full py-4 rounded-xl text-white text-base font-medium min-h-[48px] touch-manipulation disabled:opacity-60"
        style={{ backgroundColor: '#4A7C59' }}
      >
        {pending || submitted ? 'Wird hinzugefügt…' : 'Hinzufügen'}
      </button>
    </form>
  )
}
