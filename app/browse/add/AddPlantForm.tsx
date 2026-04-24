'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPlantAndAdd, type CreateResult } from './actions'

const CATEGORIES = [
  { value: 'Gemüse', color: '#4A7C59' },
  { value: 'Kraut', color: '#C17B5C' },
  { value: 'Blume', color: '#8B5A95' },
  { value: 'Obst', color: '#D49C3D' },
] as const

export default function AddPlantForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefilledName = searchParams.get('name') ?? ''
  const [category, setCategory] = useState<string>(CATEGORIES[0].value)
  const [state, formAction, pending] = useActionState<CreateResult | null, FormData>(
    async (_prev, formData) => createPlantAndAdd(_prev, formData),
    null
  )

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      router.push(`/plants/${state.plantId}${state.deduped ? '' : '?fresh=1'}`)
    }
  }, [state, router])

  const errorMessage =
    state && 'error' in state
      ? state.error === 'invalid'
        ? 'Bitte Name und Kategorie ausfüllen.'
        : state.error === 'no-garden'
          ? 'Garten nicht gefunden — bitte neu anmelden.'
          : 'Ups — etwas ist schiefgelaufen. Bitte nochmal.'
      : null

  const submitted = state && 'ok' in state && state.ok

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="category" value={category} />

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
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((cat) => {
            const active = cat.value === category
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className="p-4 rounded-lg border text-sm font-medium min-h-[48px] touch-none"
                style={{
                  backgroundColor: active ? cat.color : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#2C2C2A',
                  borderColor: active ? cat.color : '#E8E6DF',
                }}
              >
                {cat.value}
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
        disabled={pending || !!submitted}
        className="w-full py-4 rounded-xl text-white text-base font-medium min-h-[48px] touch-none disabled:opacity-60"
        style={{ backgroundColor: '#4A7C59' }}
      >
        {pending || submitted ? 'Wird hinzugefügt…' : 'Hinzufügen'}
      </button>
    </form>
  )
}
