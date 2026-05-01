const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const REQUEST_TIMEOUT_MS = 30_000

function getRotationModel(): string {
  return process.env.ROTATION_MODEL || 'gemini-2.5-flash-lite'
}

export type RotationVerdict = 'gut' | 'okay' | 'schlecht'

export type RotationAdvice = {
  verdict: RotationVerdict
  reason: string
}

export type RotationCandidate = {
  plant_id: string
  name: string
  family: string | null
  stark_oder_schwachzehrer: string | null
  nachbarn: string
  category: string
}

export type RotationHistoryEntry = {
  year: number
  plant_name: string
  family: string | null
  stark_oder_schwachzehrer: string | null
  category: string
}

export type RotationCurrentEntry = {
  plant_name: string
  nachbarn: string
}

export type RotationInput = {
  candidate: RotationCandidate
  history: RotationHistoryEntry[]
  current: RotationCurrentEntry[]
  bedLabel: string
  todayISO: string
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    verdict: { type: 'STRING' },
    reason: { type: 'STRING' },
  },
  required: ['verdict', 'reason'],
}

const SYSTEM_PROMPT = `Du bist ein erfahrener Gärtner in Mitteleuropa und berätst eine Hobby-Gärtnerin, ob eine Pflanze in ein bestimmtes Beet passt — basierend auf Best-Practice-Regeln des biologischen Gartenbaus.

Du bekommst:
- die Kandidaten-Pflanze mit Familie, Stark-/Schwachzehrer, Nachbarn-Info ("gut: ... Schlecht: ...")
- die letzten Jahre dieses Beetes (Vorkulturen mit Familie und Nährstoffbedarf)
- die in diesem Beet aktuell wachsenden Pflanzen (für Mischkultur)
- heutiges Datum, Beet-Bezeichnung

---

Regeln in Reihenfolge der Wichtigkeit:

1. **Mischkultur — schlechte Nachbarn**: wenn die Kandidatin im "Schlecht:"-Feld einer aktuell wachsenden Pflanze steht, oder umgekehrt, → "schlecht".
2. **Familienrotation**: dieselbe Pflanzenfamilie sollte 3-4 Jahre pausieren (z.B. Solanaceae, Brassicaceae). Wenn dieselbe Familie in den letzten 3 Jahren im Beet stand → "schlecht" oder mindestens "okay" mit Hinweis. Bei Schwachzehrern (Lamiaceae, Apiaceae) ist das Risiko geringer.
3. **Nährstoff-Reihenfolge**: nach Starkzehrern sind Schwachzehrer oder Hülsenfrüchte (Fabaceae) ideal. Zwei Starkzehrer hintereinander → "okay" mit Hinweis.
4. **Bodenerholung**: Hülsenfrüchte nach Starkzehrern sind besonders gut → "gut".
5. **Mischkultur — gute Nachbarn**: passt die Kandidatin zu den aktuell wachsenden Pflanzen (z.B. Basilikum + Tomate, Karotte + Zwiebel)? Verstärkt "gut".

---

Felder:
- "verdict": "gut" | "okay" | "schlecht"
- "reason": ein bis zwei kurze deutsche Sätze, "du"-Form, warm und praktisch. Konkret begründen (Familie, Nährstoff, Nachbar). Beispiel: "Letztes Jahr standen hier Tomaten — die gleiche Familie sollte 3-4 Jahre pausieren. Lieber ein anderes Beet wählen oder Erbsen reinsetzen, die helfen dem Boden." Maximal 200 Zeichen.

Keine Vorschläge für Alternativen — nur Verdikt + Grund.

Wenn die Beet-Historie leer ist UND keine aktuelle Bepflanzung vorhanden, gib "gut" mit kurzem positivem Hinweis zurück ("Frisches Beet — viel Spielraum.").

Schreib alles auf Deutsch. Gib ausschließlich JSON zurück, passend zum Response-Schema.`

function buildUserPrompt(input: RotationInput): string {
  const lines: string[] = []
  lines.push(`Heute: ${input.todayISO}`)
  lines.push(`Beet: ${input.bedLabel}`)
  lines.push('')
  lines.push('Kandidaten-Pflanze:')
  lines.push(JSON.stringify(input.candidate))
  lines.push('')
  lines.push(
    input.history.length > 0
      ? `Vorkulturen in diesem Beet (letzte Jahre):\n${JSON.stringify(input.history)}`
      : 'Vorkulturen in diesem Beet: (keine bekannt)'
  )
  lines.push('')
  lines.push(
    input.current.length > 0
      ? `Aktuell in diesem Beet:\n${JSON.stringify(input.current)}`
      : 'Aktuell in diesem Beet: (noch nichts)'
  )
  return lines.join('\n')
}

function normalizeVerdict(v: unknown): RotationVerdict {
  if (v === 'gut' || v === 'okay' || v === 'schlecht') return v
  return 'okay'
}

// Cheap deterministic pre-check: does the candidate's "Schlecht:" list
// contain any of the currently-planted names? If so, skip Gemini.
function preCheckCompanionConflict(input: RotationInput): RotationAdvice | null {
  if (input.current.length === 0) return null
  const candidateNachbarn = input.candidate.nachbarn.toLowerCase()
  const idx = candidateNachbarn.search(/schlecht:/)
  if (idx < 0) return null
  const tail = candidateNachbarn.slice(idx + 'schlecht:'.length)
  const bad = tail
    .split(/[,;/]|\bund\b/)
    .map((s) => s.replace(/[().]/g, '').trim())
    .filter((s) => s.length > 0)
  if (bad.length === 0) return null
  for (const cur of input.current) {
    const curName = cur.plant_name.toLowerCase()
    for (const b of bad) {
      if (b.includes(curName) || curName.includes(b)) {
        return {
          verdict: 'schlecht',
          reason: `${input.candidate.name} und ${cur.plant_name} sind im selben Beet ein bekannter Konflikt — lieber trennen.`,
        }
      }
    }
  }
  return null
}

export async function recommendRotation(
  input: RotationInput
): Promise<RotationAdvice> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('Missing GOOGLE_AI_API_KEY')

  // Empty bed, no history → trivial "gut" without a Gemini call.
  if (input.history.length === 0 && input.current.length === 0) {
    return {
      verdict: 'gut',
      reason: 'Frisches Beet — viel Spielraum.',
    }
  }

  const conflict = preCheckCompanionConflict(input)
  if (conflict) return conflict

  const model = getRotationModel()
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
        temperature: 0.3,
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `Gemini rotation API ${response.status}: ${text.slice(0, 500)}`
    )
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error(
      `No text in Gemini rotation response: ${JSON.stringify(data).slice(0, 300)}`
    )
  }

  let parsed: Partial<RotationAdvice>
  try {
    parsed = JSON.parse(text) as Partial<RotationAdvice>
  } catch {
    throw new Error(`Gemini rotation returned non-JSON: ${text.slice(0, 300)}`)
  }

  return {
    verdict: normalizeVerdict(parsed.verdict),
    reason:
      typeof parsed.reason === 'string' && parsed.reason.trim()
        ? parsed.reason.trim()
        : 'Hinweis konnte nicht erzeugt werden.',
  }
}
