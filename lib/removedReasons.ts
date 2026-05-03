/**
 * Stage 10 — Single source of truth for the 7 removed-reasons.
 *
 * Used by HarvestSheet's "Pflanze raus" reason picker AND by the Bilanz
 * page's "💔 Was nicht klappte" section. Tone classifies how the Bilanz
 * displays each entry:
 *   - 'positive' = a normal end-of-season closure (Apfel done)
 *   - 'event'   = an external interrupt (Frost)
 *   - 'loss'    = a Lerntagebuch-relevant loss to highlight
 *   - 'neutral' = administrative (umgepflanzt, anderes)
 */

export type RemovedReasonKey =
  | 'saison_ende'
  | 'frost'
  | 'schaedlinge'
  | 'krankheit'
  | 'eingegangen'
  | 'umgepflanzt'
  | 'anderes'

export type RemovedReasonTone = 'positive' | 'event' | 'loss' | 'neutral'

export type RemovedReason = {
  key: RemovedReasonKey
  label: string
  emoji: string
  tone: RemovedReasonTone
  /** One-liner shown in Bilanz "Was nicht klappte" hint context. */
  hint?: string
}

export const REMOVED_REASONS: RemovedReason[] = [
  {
    key: 'saison_ende',
    label: 'Saison-Ende',
    emoji: '✓',
    tone: 'positive',
  },
  {
    key: 'frost',
    label: 'Frost',
    emoji: '🥶',
    tone: 'event',
    hint: 'nächstes Jahr Vlies oder später pflanzen',
  },
  {
    key: 'schaedlinge',
    label: 'Schädlinge',
    emoji: '🐛',
    tone: 'loss',
    hint: 'Schädlings-Kontrolle früher checken',
  },
  {
    key: 'krankheit',
    label: 'Krankheit',
    emoji: '☔',
    tone: 'loss',
    hint: 'Standort oder Sorte überdenken',
  },
  {
    key: 'eingegangen',
    label: 'Eingegangen',
    emoji: '🥀',
    tone: 'loss',
    hint: 'Boden, Wasser oder Sorte prüfen',
  },
  {
    key: 'umgepflanzt',
    label: 'Umgepflanzt',
    emoji: '🚚',
    tone: 'neutral',
  },
  {
    key: 'anderes',
    label: 'Anderes',
    emoji: '…',
    tone: 'neutral',
  },
]

const BY_KEY = new Map<RemovedReasonKey, RemovedReason>(
  REMOVED_REASONS.map((r) => [r.key, r])
)

const VALID_SET = new Set<string>(REMOVED_REASONS.map((r) => r.key))

export function isValidRemovedReason(s: string): s is RemovedReasonKey {
  return VALID_SET.has(s)
}

export function removedReasonMeta(
  key: string | null | undefined
): RemovedReason | null {
  if (!key) return null
  return BY_KEY.get(key as RemovedReasonKey) ?? null
}

/** True if this reason should appear in the Bilanz "Was nicht klappte" list. */
export function isLossReason(key: string | null | undefined): boolean {
  const m = removedReasonMeta(key)
  return !!m && (m.tone === 'loss' || m.tone === 'event')
}
