const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const REQUEST_TIMEOUT_MS = 45_000

function getRecommendModel(): string {
  // Flash-lite is ~20x faster than flash (3s vs 60s+ for our ~10k-token
  // prompt). Quality comparable once we post-filter deterministically.
  return process.env.RECOMMEND_MODEL || 'gemini-2.5-flash-lite'
}

function extractSchlechtNames(nachbarn: string): string[] {
  if (!nachbarn) return []
  const lower = nachbarn.toLowerCase()
  const idx = lower.search(/schlecht:/)
  if (idx < 0) return []
  const tail = nachbarn.slice(idx + 'schlecht:'.length)
  return tail
    .split(/[,;/]|\bund\b/)
    .map((s) => s.replace(/[().]/g, '').trim().toLowerCase())
    .filter((s) => s.length > 0)
}

function hasCompanionConflict(
  candidateNachbarn: string,
  plantedNames: string[]
): boolean {
  if (plantedNames.length === 0) return false
  const schlecht = extractSchlechtNames(candidateNachbarn)
  if (schlecht.length === 0) return false
  for (const planted of plantedNames) {
    const p = planted.toLowerCase()
    for (const bad of schlecht) {
      if (bad.includes(p) || p.includes(bad)) return true
    }
  }
  return false
}

export type QuestionnaireInput = {
  sun: 'sonnig' | 'halbschattig' | 'schattig'
  space: 'klein' | 'mittel' | 'gross'
  likes: Array<'essbar' | 'kraeuter' | 'zierpflanze'>
  note: string
  todayISO: string
}

export type CatalogItem = {
  id: string
  name: string
  latin_name: string
  category: string
  saatzeit: string
  pflanzort: string
  nachbarn: string
  stark_oder_schwachzehrer: string | null
  einjaehrig_oder_mehrjaehrig: string | null
}

export type IdeaVerdict = 'good' | 'mixed' | 'tricky' | 'none'

export type IdeaFeedback = {
  plants_mentioned: string[]
  verdict: IdeaVerdict
  commentary: string
}

export type Suggestion = {
  plant_id: string
  reason: string
}

export type RecommendResult = {
  idea: IdeaFeedback
  suggestions: Suggestion[]
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    idea: {
      type: 'OBJECT',
      properties: {
        plants_mentioned: {
          type: 'ARRAY',
          items: { type: 'STRING' },
        },
        verdict: { type: 'STRING' },
        commentary: { type: 'STRING' },
      },
      required: ['plants_mentioned', 'verdict', 'commentary'],
    },
    suggestions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          plant_id: { type: 'STRING' },
          reason: { type: 'STRING' },
        },
        required: ['plant_id', 'reason'],
      },
    },
  },
  required: ['idea', 'suggestions'],
}

const SYSTEM_PROMPT = `Du bist ein erfahrener Gärtner in Mitteleuropa (Deutschland, Schweiz, Österreich) und berätst eine Hobby-Gärtnerin, was sie als Nächstes säen oder pflanzen soll.

Du bekommst:
- heutiges Datum
- den aktuellen Garten der Nutzerin: Pflanzen, die bereits im Boden sind ("gepflanzt"), und Pflanzen, die sie als Samen / auf dem Zettel hat ("interessiert")
- ihre Antworten (Sonne, Platz, Vorlieben)
- optional einen Freitext, in dem sie ihre aktuelle Idee äußert (z.B. "Ich habe Romanesco-Samen, was meinst du?")
- einen Katalog verfügbarer Pflanzen mit Saatzeit, Pflanzort, Nachbarn-Info (enthält oft "gut: ... Schlecht: ..."), Starkzehrer/Schwachzehrer

---

WICHTIG — Feld "idea" ("Zu deiner Idee"):

Wenn die Nutzerin im Freitext konkrete Pflanzen nennt:
- "plants_mentioned" = Liste der genannten Pflanzennamen, genau wie sie sie im Katalog heißen würden (deutsch, Singular wo möglich, z.B. ["Romanesco"]).
- "verdict" = eine von drei Kategorien:
    - "good"    = passt gut zum Garten und zur Saison
    - "mixed"   = funktioniert, aber mit Einschränkungen (Platz, Sonne, Timing)
    - "tricky"  = lieber nicht zusammen mit etwas bereits Gepflanztem (gleiche Krankheiten, gleiche Nährstoffe, bekannter Konflikt), oder die Saatzeit ist vorbei
- "commentary" = 2 bis 5 Sätze, warm und ehrlich, auf Deutsch. Sprich die Person direkt an ("du"). Nimm ihre Idee ernst. Erkläre den Zusammenhang:
    - Bei "good": bestätige und nenne 1-2 konkrete Gründe (Nachbarn, Saison, Licht).
    - Bei "mixed": sag klar, was passt, und was sie beachten muss.
    - Bei "tricky": erklär behutsam warum (z.B. "Romanesco und Brokkoli sind beide Kohlgewächse und übertragen sich gegenseitig Krankheiten wie Kohlhernie"), und schlag eine Lösung vor (woanders pflanzen, warten bis XY geerntet, andere Sorte).
- KEINE Zeichenbegrenzung — schreib so viel wie nötig, aber nicht länger als nötig. Jeder Satz muss sitzen.

Wenn die Nutzerin KEINE konkrete Pflanze im Freitext nennt oder kein Freitext vorhanden ist:
- "plants_mentioned" = []
- "verdict" = "none"
- "commentary" = ""

---

Feld "suggestions" (immer 5 bis 8 Einträge, sortiert nach Passung):

- Wenn "idea.verdict" = "tricky", sind die Vorschläge primär Alternativen zur getricky'ten Idee — Pflanzen, die stattdessen gut passen.
- Wenn "idea.verdict" = "good" oder "mixed", sind die Vorschläge ergänzende Ideen, die zur Idee der Nutzerin und ihrem Garten passen.
- Wenn kein Freitext: einfach passende Vorschläge für den aktuellen Garten + Saison.

Regeln für Vorschläge:
- Bevorzuge Pflanzen, deren Saatzeit den aktuellen Monat abdeckt.
- Bevorzuge gute Nachbarn der gepflanzten Liste. Lies das "nachbarn"-Feld ("gut: ..." und "Schlecht: ...").
- HARTE REGEL: empfiehl NIEMALS eine Pflanze, deren "Schlecht:"-Liste eine bereits gepflanzte Pflanze enthält.
- HARTE REGEL: empfiehl NIEMALS eine Pflanze, die schon im Garten (gepflanzt oder interessiert) ist.
- HARTE REGEL: wenn "idea.verdict" = "tricky", empfiehl NIEMALS die in "plants_mentioned" genannten Pflanzen im suggestions-Feld.
- Achte auf Fruchtfolge (Stark-/Schwachzehrer), Sonne, Platz, Vorlieben.
- "reason" = 1 bis 2 deutsche Sätze, warm und konkret. Erkläre den Hauptgrund (Saison, Nachbar, Licht, Fruchtfolge).
- "plant_id" = die ID aus dem Katalog, exakt übernehmen.

Schreib alles auf Deutsch. Gib ausschließlich JSON zurück, passend zum Response-Schema.`

type RecommendInput = {
  questionnaire: QuestionnaireInput
  planted: Array<{ name: string; category: string }>
  interested: Array<{ name: string }>
  catalog: CatalogItem[]
}

function buildUserPrompt(input: RecommendInput): string {
  const { questionnaire: q, planted, interested, catalog } = input
  const likesDe = q.likes
    .map((l) =>
      l === 'essbar' ? 'essbar' : l === 'kraeuter' ? 'Kräuter' : 'Zierpflanze'
    )
    .join(', ')

  const lines: string[] = []
  lines.push(`Heute: ${q.todayISO}`)
  lines.push(`Sonne: ${q.sun}`)
  lines.push(`Platz: ${q.space}`)
  lines.push(`Mag: ${likesDe || '—'}`)
  if (q.note.trim()) {
    lines.push('')
    lines.push(`Freitext / Idee der Nutzerin:`)
    lines.push(q.note.trim())
  } else {
    lines.push('Kein Freitext.')
  }
  lines.push('')
  lines.push(
    planted.length > 0
      ? `Gepflanzt im Garten (${planted.length}): ${planted
          .map((p) => `${p.name} (${p.category})`)
          .join(', ')}`
      : 'Gepflanzt im Garten: (noch nichts)'
  )
  lines.push(
    interested.length > 0
      ? `Samen / Interessiert (${interested.length}): ${interested
          .map((p) => p.name)
          .join(', ')}`
      : 'Samen / Interessiert: (nichts)'
  )
  lines.push('')
  lines.push(`Katalog (${catalog.length} Pflanzen als JSON):`)
  lines.push(JSON.stringify(catalog))
  return lines.join('\n')
}

function normalizeVerdict(v: unknown): IdeaVerdict {
  if (v === 'good' || v === 'mixed' || v === 'tricky' || v === 'none') return v
  return 'none'
}

export async function recommendPlants(
  input: RecommendInput
): Promise<RecommendResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('Missing GOOGLE_AI_API_KEY')

  const model = getRecommendModel()
  const userPrompt = buildUserPrompt(input)
  const url = `${API_BASE}/models/${model}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.4,
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `Gemini recommend API ${response.status}: ${text.slice(0, 500)}`
    )
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
    }>
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error(
      `No text in Gemini response: ${JSON.stringify(data).slice(0, 300)}`
    )
  }

  let parsed: RecommendResult
  try {
    parsed = JSON.parse(text) as RecommendResult
  } catch {
    throw new Error(`Gemini returned non-JSON: ${text.slice(0, 300)}`)
  }

  const validIds = new Set(input.catalog.map((c) => c.id))
  const plantedNames = new Set(
    input.planted.map((p) => p.name.toLowerCase())
  )
  const interestedNames = new Set(
    input.interested.map((p) => p.name.toLowerCase())
  )
  const excludedNames = new Set([...plantedNames, ...interestedNames])

  const plantedNamesRaw = input.planted.map((p) => p.name)

  // Normalize idea first so we can use it for suggestion filtering.
  const rawIdea = parsed.idea as Partial<IdeaFeedback> | undefined
  const idea: IdeaFeedback = {
    plants_mentioned: Array.isArray(rawIdea?.plants_mentioned)
      ? rawIdea!.plants_mentioned
          .filter((x): x is string => typeof x === 'string')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [],
    verdict: normalizeVerdict(rawIdea?.verdict),
    commentary:
      typeof rawIdea?.commentary === 'string' ? rawIdea.commentary.trim() : '',
  }

  const trickyBlocked = new Set<string>()
  if (idea.verdict === 'tricky') {
    for (const name of idea.plants_mentioned) {
      trickyBlocked.add(name.toLowerCase())
    }
  }

  const suggestions: Suggestion[] = []
  const seenIds = new Set<string>()
  for (const s of parsed.suggestions ?? []) {
    if (!s.plant_id || !s.reason) continue
    if (!validIds.has(s.plant_id)) continue
    if (seenIds.has(s.plant_id)) continue
    const catalogItem = input.catalog.find((c) => c.id === s.plant_id)
    if (!catalogItem) continue
    const candidateLower = catalogItem.name.toLowerCase()
    if (excludedNames.has(candidateLower)) continue
    if (trickyBlocked.size > 0) {
      let blocked = false
      for (const t of trickyBlocked) {
        if (candidateLower.includes(t) || t.includes(candidateLower)) {
          blocked = true
          break
        }
      }
      if (blocked) continue
    }
    if (hasCompanionConflict(catalogItem.nachbarn, plantedNamesRaw)) continue
    seenIds.add(s.plant_id)
    suggestions.push({
      plant_id: s.plant_id,
      reason: String(s.reason).trim(),
    })
    if (suggestions.length >= 8) break
  }

  return { idea, suggestions }
}
