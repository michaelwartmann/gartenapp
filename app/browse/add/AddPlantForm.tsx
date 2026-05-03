'use client'

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSearchParams } from 'next/navigation'
import {
  createPlantAndAdd,
  suggestCategoriesForPlant,
  type CreateResult,
} from './actions'

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
  /** Called when the server action returns ok=true. */
  onSuccess: (result: Extract<CreateResult, { ok: true }>) => void
}

type ConflictPayload = {
  suggestion: string[]
  formData: FormData
}

export default function AddPlantForm({ onSuccess }: Props) {
  const searchParams = useSearchParams()
  const prefilledName = searchParams.get('name') ?? ''

  const [name, setName] = useState(prefilledName)
  const [latinName, setLatinName] = useState('')
  // Insertion order = first picked is the primary (used for color pill).
  const [categoryOrder, setCategoryOrder] = useState<string[]>([
    CATEGORIES[0].value,
  ])
  const selectedSet = useMemo(() => new Set(categoryOrder), [categoryOrder])
  const primary = categoryOrder[0] ?? CATEGORIES[0].value
  const categoriesCSV = categoryOrder.join(',')

  // Smart-suggestion state
  const [suggestion, setSuggestion] = useState<string[] | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const userOverrodeRef = useRef(false)
  const lastClassifiedKey = useRef<string>('')

  const [conflict, setConflict] = useState<ConflictPayload | null>(null)

  const [state, formAction, pending] = useActionState<CreateResult | null, FormData>(
    async (_prev, formData) => createPlantAndAdd(_prev, formData),
    null
  )

  useEffect(() => {
    if (state && 'ok' in state && state.ok) {
      onSuccess(state)
    }
  }, [state, onSuccess])

  // Debounced live category suggestion as the user types name + latin.
  useEffect(() => {
    const cleanName = name.trim()
    if (cleanName.length < 2) {
      setSuggestion(null)
      return
    }
    const key = `${cleanName.toLowerCase()}|${latinName.trim().toLowerCase()}`
    if (key === lastClassifiedKey.current) return
    const handle = setTimeout(async () => {
      lastClassifiedKey.current = key
      setSuggestLoading(true)
      const res = await suggestCategoriesForPlant(cleanName, latinName.trim())
      setSuggestLoading(false)
      if (!res || res.categories.length === 0) return
      setSuggestion(res.categories)
      if (!userOverrodeRef.current) {
        setCategoryOrder(res.categories)
      }
    }, 600)
    return () => clearTimeout(handle)
  }, [name, latinName])

  function toggle(cat: string) {
    userOverrodeRef.current = true
    setCategoryOrder((cur) => {
      if (cur.includes(cat)) {
        const next = cur.filter((c) => c !== cat)
        return next.length === 0 ? cur : next
      }
      return [...cur, cat]
    })
  }

  function applySuggestion() {
    if (!suggestion) return
    setCategoryOrder(suggestion)
    userOverrodeRef.current = false
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    // Mirror state into the FormData so server gets the canonical values.
    fd.set('category', primary)
    fd.set('categories', categoriesCSV)

    // Soft-confirm: if Gemini's suggestion has ZERO overlap with user's
    // pick, ask before submitting. (Lemon = Gemüse → "Gemini denkt Obst, Baum").
    if (suggestion && suggestion.length > 0 && categoryOrder.length > 0) {
      const userSet = new Set(categoryOrder)
      const overlap = suggestion.some((c) => userSet.has(c))
      if (!overlap) {
        setConflict({ suggestion, formData: fd })
        return
      }
    }
    formAction(fd)
  }

  function confirmTakeGemini() {
    if (!conflict) return
    const { suggestion: sug, formData } = conflict
    formData.set('category', sug[0])
    formData.set('categories', sug.join(','))
    setCategoryOrder(sug)
    userOverrodeRef.current = false
    setConflict(null)
    formAction(formData)
  }

  function confirmKeepMine() {
    if (!conflict) return
    formAction(conflict.formData)
    setConflict(null)
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

  // Show Gemini hint if we have a suggestion AND it differs from current pick
  const suggestionDiffersFromCurrent =
    suggestion &&
    (suggestion.length !== categoryOrder.length ||
      suggestion.some((c, i) => c !== categoryOrder[i]))

  return (
    <>
      <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
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
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            value={latinName}
            onChange={(e) => setLatinName(e.target.value)}
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

          {suggestLoading && (
            <p className="text-xs" style={{ color: '#888780' }}>
              ✨ Gemini überlegt …
            </p>
          )}

          {suggestion && !suggestLoading && (
            <div
              className="rounded-lg p-2.5 text-xs flex items-center justify-between gap-2"
              style={{
                backgroundColor: '#F0EDE4',
                color: '#4A7C59',
              }}
            >
              <span>
                ✨ Gemini denkt:{' '}
                <span className="font-medium">{suggestion.join(', ')}</span>
              </span>
              {suggestionDiffersFromCurrent && (
                <button
                  type="button"
                  onClick={applySuggestion}
                  className="text-xs px-2 py-1 rounded touch-manipulation shrink-0"
                  style={{ backgroundColor: '#FFFFFF', color: '#4A7C59' }}
                >
                  Übernehmen
                </button>
              )}
            </div>
          )}

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
          ✨ Die übrigen Felder deiner Pflanzen-Karteikarte werden im
          Hintergrund mit Gemini ausgefüllt. Du kannst alles später anpassen.
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

      {conflict && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setConflict(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl p-4 pb-6 space-y-4"
            style={{ backgroundColor: '#FAFAF7' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2
                className="text-base font-medium mb-2"
                style={{ color: '#2C2C2A' }}
              >
                Welche Kategorien nehmen wir?
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#2C2C2A' }}>
                Du hast{' '}
                <span className="font-medium">{categoryOrder.join(', ')}</span>{' '}
                gewählt. Gemini denkt bei „{name}" eher{' '}
                <span className="font-medium">{conflict.suggestion.join(', ')}</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={confirmTakeGemini}
              disabled={pending}
              className="w-full py-3 rounded-lg text-white text-sm font-medium touch-manipulation disabled:opacity-60"
              style={{ backgroundColor: '#4A7C59' }}
            >
              ✨ Geminis Vorschlag nehmen
            </button>
            <button
              type="button"
              onClick={confirmKeepMine}
              disabled={pending}
              className="w-full py-3 rounded-lg text-sm font-medium border touch-manipulation disabled:opacity-60"
              style={{
                color: '#2C2C2A',
                borderColor: '#E8E6DF',
                backgroundColor: '#FFFFFF',
              }}
            >
              Meine Wahl behalten
            </button>
            <button
              type="button"
              onClick={() => setConflict(null)}
              disabled={pending}
              className="w-full py-2 text-xs touch-manipulation"
              style={{ color: '#888780' }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </>
  )
}
