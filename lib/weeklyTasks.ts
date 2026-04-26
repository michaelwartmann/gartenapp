const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const REQUEST_TIMEOUT_MS = 45_000

function getTasksModel(): string {
  return process.env.WEEKLY_TASKS_MODEL || 'gemini-2.5-flash-lite'
}

export type Urgency = 'jetzt' | 'diese_woche' | 'demnaechst'

export type WeeklyTask = {
  plant_id: string
  plant_name: string
  task: string
  why: string
  urgency: Urgency
}

export type WeeklyTasksResult = {
  tasks: WeeklyTask[]
}

export type PlantedPlantInput = {
  plant_id: string
  name: string
  category: string
  planted_at: string
  saatzeit: string
  vorzucht: string
  schneiden: string
  ernte: string
  einjaehrig_oder_mehrjaehrig: string
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    tasks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          plant_id: { type: 'STRING' },
          plant_name: { type: 'STRING' },
          task: { type: 'STRING' },
          why: { type: 'STRING' },
          urgency: { type: 'STRING' },
        },
        required: ['plant_id', 'plant_name', 'task', 'why', 'urgency'],
      },
    },
  },
  required: ['tasks'],
}

const SYSTEM_PROMPT = `Du bist ein erfahrener Gärtner in Mitteleuropa (Deutschland, Schweiz, Österreich) und gibst einer Hobby-Gärtnerin konkrete Hinweise, was sie in den nächsten Tagen für ihre gepflanzten Pflanzen tun sollte.

Du bekommst:
- heutiges Datum
- Liste der gepflanzten Pflanzen mit Pflanzdatum (planted_at) und den Feldern: saatzeit, vorzucht, schneiden, ernte, einjaehrig_oder_mehrjaehrig

---

Aufgabe: Erstelle eine kurze Liste von Aufgaben (0 bis 8 Einträge), die in den nächsten ca. 14 Tagen anstehen.

Felder pro Aufgabe:
- "plant_id": exakt aus der Eingabe übernehmen
- "plant_name": exakt aus der Eingabe übernehmen
- "task": kurzer Imperativ auf Deutsch, idealerweise unter 50 Zeichen. Beispiele: "Tomate ausgeizen", "Salat ernten", "Basilikum gießen wenn trocken", "Kürbis pikieren", "Erdbeeren mulchen"
- "why": ein kurzer deutscher Satz, der den Grund erklärt. Konkret und warm. Beziehe dich auf Pflanzdatum oder Saison wenn relevant ("seit 6 Wochen im Boden, jetzt Erntefenster", "warme Tage, Boden trocknet schnell")
- "urgency": eine von drei Kategorien:
    - "jetzt"        = heute oder morgen
    - "diese_woche"  = in 2 bis 7 Tagen
    - "demnaechst"   = in 8 bis 14 Tagen

Regeln:
- HARTE REGEL: maximal 8 Aufgaben insgesamt.
- HARTE REGEL: maximal 2 Aufgaben pro Pflanze.
- HARTE REGEL: keine Aufgaben für Pflanzen, die nicht in der Eingabe sind.
- Wenn für eine Pflanze nichts ansteht (z.B. Stauden im Sommer ohne Pflegebedarf), lass sie weg. Es ist okay, eine leere Liste zurückzugeben, wenn wirklich nichts dringend ist.
- Sprich die Person mit "du" an.
- Berücksichtige Saatzeit-Fenster: wenn vorzucht/saatzeit jetzt ansteht, nenne das. Wenn die Saatzeit längst vorbei ist, ignoriere das.
- Berücksichtige typische Pflegezyklen: Tomaten ausgeizen ab ~3 Wochen nach Auspflanzung, Salat ernten ab ~6 Wochen, etc.

Schreib alles auf Deutsch. Gib ausschließlich JSON zurück, passend zum Response-Schema.`

function buildUserPrompt(input: {
  todayISO: string
  planted: PlantedPlantInput[]
}): string {
  const lines: string[] = []
  lines.push(`Heute: ${input.todayISO}`)
  lines.push('')
  lines.push(`Gepflanzte Pflanzen (${input.planted.length}):`)
  lines.push(JSON.stringify(input.planted))
  return lines.join('\n')
}

function normalizeUrgency(u: unknown): Urgency {
  if (u === 'jetzt' || u === 'diese_woche' || u === 'demnaechst') return u
  return 'diese_woche'
}

function urgencyRank(u: Urgency): number {
  if (u === 'jetzt') return 0
  if (u === 'diese_woche') return 1
  return 2
}

export async function recommendTasks(input: {
  todayISO: string
  planted: PlantedPlantInput[]
}): Promise<WeeklyTasksResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('Missing GOOGLE_AI_API_KEY')

  if (input.planted.length === 0) return { tasks: [] }

  const model = getTasksModel()
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
      `Gemini weeklyTasks API ${response.status}: ${text.slice(0, 500)}`
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

  let parsed: { tasks?: Array<Partial<WeeklyTask>> }
  try {
    parsed = JSON.parse(text) as { tasks?: Array<Partial<WeeklyTask>> }
  } catch {
    throw new Error(`Gemini returned non-JSON: ${text.slice(0, 300)}`)
  }

  const validIds = new Map(input.planted.map((p) => [p.plant_id, p.name]))
  const seen = new Set<string>()
  const perPlantCount = new Map<string, number>()
  const tasks: WeeklyTask[] = []

  for (const t of parsed.tasks ?? []) {
    if (!t.plant_id || !t.task || !t.why) continue
    if (!validIds.has(t.plant_id)) continue
    const key = `${t.plant_id}::${String(t.task).trim().toLowerCase()}`
    if (seen.has(key)) continue
    const count = perPlantCount.get(t.plant_id) ?? 0
    if (count >= 2) continue
    seen.add(key)
    perPlantCount.set(t.plant_id, count + 1)
    tasks.push({
      plant_id: t.plant_id,
      plant_name: validIds.get(t.plant_id)!,
      task: String(t.task).trim(),
      why: String(t.why).trim(),
      urgency: normalizeUrgency(t.urgency),
    })
    if (tasks.length >= 8) break
  }

  tasks.sort((a, b) => urgencyRank(a.urgency) - urgencyRank(b.urgency))

  return { tasks }
}
