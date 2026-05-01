'use client'

import { useActionState } from 'react'
import SuggestionCard from './SuggestionCard'
import { getSuggestions, type RecommendState } from './actions'
import type { IdeaVerdict } from '@/lib/recommendPlants'

const SUN_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'sonnig', label: 'sonnig' },
  { value: 'halbschattig', label: 'halbschattig' },
  { value: 'schattig', label: 'schattig' },
]

const SPACE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'klein', label: 'klein' },
  { value: 'mittel', label: 'mittel' },
  { value: 'gross', label: 'groß' },
]

const LIKE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'essbar', label: 'essbar' },
  { value: 'kraeuter', label: 'Kräuter' },
  { value: 'zierpflanze', label: 'Zierpflanze' },
]

function Chip({
  name,
  value,
  label,
  type,
}: {
  name: string
  value: string
  label: string
  type: 'radio' | 'checkbox'
}) {
  return (
    <label className="relative inline-flex items-center cursor-pointer touch-manipulation">
      <input
        type={type}
        name={name}
        value={value}
        className="peer sr-only"
      />
      <span className="px-4 py-2 rounded-xl text-sm font-medium border-2 transition-colors bg-white text-[#2C2C2A] border-[#E8E6DF] peer-checked:bg-[#4A7C59] peer-checked:text-white peer-checked:border-[#4A7C59]">
        {label}
      </span>
    </label>
  )
}

function verdictStyling(verdict: IdeaVerdict) {
  switch (verdict) {
    case 'good':
      return {
        bg: '#F0EDE4',
        border: '#4A7C59',
        heading: '#4A7C59',
        icon: '🌱',
        headingPrefix: 'Gute Idee',
      }
    case 'mixed':
      return {
        bg: '#FFF9EC',
        border: '#D49C3D',
        heading: '#A87A1F',
        icon: '🤔',
        headingPrefix: 'Das geht — mit Bedingungen',
      }
    case 'tricky':
      return {
        bg: '#FDE8E2',
        border: '#C17B5C',
        heading: '#C17B5C',
        icon: '⚠',
        headingPrefix: 'Lieber nicht direkt',
      }
    default:
      return {
        bg: '#F0EDE4',
        border: '#888780',
        heading: '#4A7C59',
        icon: '🌿',
        headingPrefix: 'Zu deiner Idee',
      }
  }
}

export default function RecommendationForm() {
  const [state, formAction, pending] = useActionState<RecommendState, FormData>(
    getSuggestions,
    undefined
  )

  const errorMessage =
    state && 'error' in state
      ? state.error === 'no-garden'
        ? 'Bitte zuerst einloggen.'
        : state.error === 'invalid'
          ? 'Bitte Sonne, Platz und mindestens eine Vorliebe wählen.'
          : 'Etwas ist schiefgelaufen. Bitte nochmal.'
      : null

  const showIdea =
    state &&
    'ok' in state &&
    state.ok &&
    state.idea.verdict !== 'none' &&
    state.idea.commentary.length > 0

  const suggestionsHeading = showIdea
    ? 'Auch interessant für deinen Garten'
    : 'Vorschläge für deinen Garten'

  const basisLine =
    state && 'ok' in state && state.ok
      ? formatBasisLine(state.basis.planted, state.basis.interested)
      : null

  return (
    <>
      <form action={formAction} className="space-y-5">
        <div>
          <label
            htmlFor="note"
            className="block text-base font-medium mb-2"
            style={{ color: '#2C2C2A' }}
          >
            Was hast du im Kopf?
          </label>
          <p
            className="text-xs mb-2 leading-relaxed"
            style={{ color: '#888780' }}
          >
            Erzähl, was du säen oder pflanzen möchtest — und was sonst noch
            wichtig ist. Z.B. &bdquo;Ich habe Romanesco-Samen, passt das
            zu meinem Brokkoli?&ldquo; oder &bdquo;Ich hätte gern was Pflegeleichtes,
            was Bienen mögen.&ldquo;
          </p>
          <textarea
            id="note"
            name="note"
            rows={4}
            maxLength={800}
            placeholder="Deine Idee…"
            className="w-full p-3 rounded-xl border-2 bg-white text-base resize-none focus:outline-none"
            style={{ borderColor: '#E8E6DF', color: '#2C2C2A' }}
          />
        </div>

        <fieldset>
          <legend
            className="text-xs font-medium uppercase tracking-wide mb-2"
            style={{ color: '#888780' }}
          >
            Sonne
          </legend>
          <div className="flex flex-wrap gap-2">
            {SUN_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                type="radio"
                name="sun"
                value={o.value}
                label={o.label}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend
            className="text-xs font-medium uppercase tracking-wide mb-2"
            style={{ color: '#888780' }}
          >
            Platz
          </legend>
          <div className="flex flex-wrap gap-2">
            {SPACE_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                type="radio"
                name="space"
                value={o.value}
                label={o.label}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend
            className="text-xs font-medium uppercase tracking-wide mb-2"
            style={{ color: '#888780' }}
          >
            Was ich mag
          </legend>
          <div className="flex flex-wrap gap-2">
            {LIKE_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                type="checkbox"
                name="likes"
                value={o.value}
                label={o.label}
              />
            ))}
          </div>
        </fieldset>

        {errorMessage && (
          <p className="text-sm text-center" style={{ color: '#C17B5C' }}>
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full py-4 rounded-xl text-white font-medium text-lg min-h-[56px] touch-manipulation disabled:opacity-60"
          style={{ backgroundColor: '#4A7C59' }}
        >
          {pending ? '…' : 'Was meinst du?'}
        </button>
      </form>

      {state && 'ok' in state && state.ok && (
        <div className="mt-8 space-y-5">
          {basisLine && (
            <p
              className="text-xs leading-relaxed text-center"
              style={{ color: '#888780' }}
            >
              {basisLine}
            </p>
          )}

          {showIdea && (
            <IdeaBlock idea={state.idea} />
          )}

          {state.suggestions.length > 0 && (
            <div>
              <h2
                className="text-xs font-medium uppercase tracking-wide mb-3"
                style={{ color: '#888780' }}
              >
                {suggestionsHeading}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {state.suggestions.map((s) => (
                  <SuggestionCard
                    key={s.plant.id}
                    plant={s.plant}
                    reason={s.reason}
                  />
                ))}
              </div>
            </div>
          )}

          {state.suggestions.length === 0 && !showIdea && (
            <p
              className="text-sm text-center py-6"
              style={{ color: '#888780' }}
            >
              Gerade keine passenden Vorschläge — probier andere Antworten
              oder erzähl mehr im Freitext.
            </p>
          )}
        </div>
      )}
    </>
  )
}

function IdeaBlock({
  idea,
}: {
  idea: { plants_mentioned: string[]; verdict: IdeaVerdict; commentary: string }
}) {
  const style = verdictStyling(idea.verdict)
  const plantsLabel =
    idea.plants_mentioned.length > 0
      ? `: ${idea.plants_mentioned.join(', ')}`
      : ''

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
      }}
    >
      <p
        className="text-sm font-medium mb-2"
        style={{ color: style.heading }}
      >
        {style.icon} {style.headingPrefix}{plantsLabel}
      </p>
      <p
        className="text-sm leading-relaxed whitespace-pre-line"
        style={{ color: '#2C2C2A' }}
      >
        {idea.commentary}
      </p>
    </div>
  )
}

function formatBasisLine(planted: string[], interested: string[]): string {
  if (planted.length === 0 && interested.length === 0) {
    return 'Basiert auf: noch nichts in deinem Garten.'
  }
  const parts: string[] = []
  if (planted.length > 0) {
    parts.push(`${planted.join(', ')} im Garten`)
  }
  if (interested.length > 0) {
    const label =
      interested.length === 1
        ? '1 Same'
        : `${interested.length} Samen`
    parts.push(`${label} (${interested.join(', ')})`)
  }
  return `Basiert auf: ${parts.join(' · ')}`
}
