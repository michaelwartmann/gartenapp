import { VALID_BED_KINDS } from './bedKinds'
import { PLANT_CATEGORIES } from './supabase'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const REQUEST_TIMEOUT_MS = 60_000

function getEnrichModel(): string {
  return process.env.ENRICH_MODEL || 'gemini-2.5-flash'
}

const FIELD_KEYS = [
  'latin_name',
  'sorte',
  'saatzeit',
  'saattiefe',
  'nachbarn',
  'erde',
  'witterung',
  'bodenmilieu',
  'duenger',
  'vorzucht',
  'schneiden',
  'einwintern',
  'ernte',
  'einjaehrig_oder_mehrjaehrig',
  'pflanzort',
  'wirkung',
  'stark_oder_schwachzehrer',
  'family',
] as const

type FieldKey = (typeof FIELD_KEYS)[number]
export type EnrichedPlant = Record<FieldKey, string> & {
  suitable_bed_kinds: string[]
  /**
   * Multi-category suggestion from Gemini (1-3 of the 7 plant categories).
   * Used to *expand* the user's primary pick when they select only one
   * category. Caller decides whether to merge (see merge logic in
   * `createPlantAndAdd`).
   */
  categories: string[]
}

const FIELD_DESCRIPTIONS: Record<FieldKey, string> = {
  latin_name:
    'Wissenschaftlicher (lateinischer) Name. LEER lassen wenn unsicher — nicht erraten.',
  sorte:
    'Übliche Sorten in Westeuropa, kommasepariert. Beispiel: "San Marzano, Ochsenherz, Matina".',
  saatzeit:
    'Beste Aussaatzeit als kurze Phrase. Beispiel: "März bis April, Vorkultur ab Februar". Bei Bäumen/Sträuchern: Pflanzzeit (z.B. "wurzelnackt: Oktober bis März, Containerware ganzjährig").',
  saattiefe:
    'Saattiefe in cm als kurze Phrase. Beispiel: "0.5–1 cm, Lichtkeimer". Bei Bäumen/Sträuchern: Pflanzgrube-Tiefe oder "nicht relevant".',
  nachbarn:
    'Gute Pflanznachbarn für Mischkultur, kommasepariert.',
  erde:
    'Bodenart / Erde. Beispiel: "humos, locker, nährstoffreich".',
  witterung:
    'Bevorzugte Witterung / Klima. Beispiel: "warm, sonnig, windgeschützt".',
  bodenmilieu:
    'pH-Bereich und Bodenfeuchte. Beispiel: "pH 6.0–6.8, mäßig feucht".',
  duenger:
    'Düngung. Beispiel: "Kompost, Hornspäne, während der Blüte alle 2 Wochen flüssig".',
  vorzucht:
    'Vorzucht / Anzucht. Beispiel: "8 Wochen vor dem Auspflanzen am Fenster bei 20°C". Bei Bäumen/Sträuchern oft "nicht relevant".',
  schneiden:
    'Schnitt. Beispiel: "Geiztriebe entfernen, im Herbst stark zurückschneiden". Bei Bäumen/Sträuchern: Schnittzeitpunkt + Schnittart (z.B. "Erhaltungsschnitt im Februar, Pflegeschnitt nach der Blüte").',
  einwintern:
    'Überwinterung. Beispiel: "winterhart ab Zone 6, mit Laub oder Vlies schützen".',
  ernte:
    'Erntezeit. Beispiel: "Juli bis September".',
  einjaehrig_oder_mehrjaehrig:
    'Genau einer der Werte: "einjährig", "zweijährig" oder "mehrjährig". Bäume und Sträucher sind immer "mehrjährig".',
  pflanzort:
    'Bevorzugter Pflanzort. Beispiel: "sonnig, im Freiland oder Gewächshaus".',
  wirkung:
    'Wirkung auf den menschlichen Körper (Heilwirkung, Nährwerte). Kurz, praktisch. Nur wenn relevant; sonst leer lassen.',
  stark_oder_schwachzehrer:
    'Genau einer der Werte: "Starkzehrer", "Mittelzehrer" oder "Schwachzehrer". Bei Bäumen/Sträuchern im Kontext mehrjähriger Düngung interpretieren.',
  family:
    'Botanische Familie auf Latein, z.B. "Solanaceae" (Nachtschattengewächse), "Brassicaceae" (Kreuzblütler), "Asteraceae", "Apiaceae", "Fabaceae", "Cucurbitaceae", "Lamiaceae", "Amaryllidaceae", "Rosaceae". Wird für Fruchtfolge-Empfehlungen genutzt — bitte korrekt angeben oder leer lassen wenn unsicher, niemals raten.',
}

const CATEGORIES_DESCRIPTION = `Welche der folgenden Pflanzen-Kategorien beschreiben die Pflanze? Gib 1–3 Werte aus dieser Liste zurück: ${PLANT_CATEGORIES.join(', ')}.

Eine Pflanze kann zu mehreren Kategorien gehören:
- Tomate → ["Gemüse", "Obst"] (botanisch Frucht, kulinarisch Gemüse)
- Apfelbaum → ["Obst", "Baum"]
- Walnuss → ["Nuss", "Baum"]
- Haselnuss → ["Nuss", "Strauch"]
- Brombeere → ["Obst", "Strauch"]
- Lavendel → ["Kraut", "Strauch"] (Halbstrauch)
- Möhre → ["Gemüse"] (nur eine zutreffend)
- Tulpe → ["Blume"]

Beginne mit der treffendsten Primär-Kategorie. Mehrere möglich nur wenn beide gleichermaßen zutreffen.`

const SUITABLE_BED_KINDS_DESCRIPTION = `Welche der folgenden Beet-Arten passen zu dieser Pflanze? Gib 1–4 Werte aus dieser Liste zurück: ${VALID_BED_KINDS.join(', ')}.

Bedeutung der Werte:
- "beet": Freiland-Beet im Boden (klassisch)
- "hochbeet": erhöhtes Beet
- "gewaechshaus": Gewächshaus, Folientunnel, Frühbeet
- "topf": Topf außen (Balkon, Terrasse)
- "topf_innen": Fensterbank, Indoor-Topf
- "hydroponik": substratlos, oft indoor
- "rasen": Streuobstwiese, freistehend in Rasen/Wiese (vor allem Bäume und Sträucher)
- "kuebel": Großgefäß für Kübelpflanzen (Olive, Zitrus, Balkonbaum)

Wähle nur die Beet-Arten, in denen die Pflanze realistisch gut gedeiht. Beispiele: Tomate → ["beet", "hochbeet", "topf", "gewaechshaus"]; Basilikum → ["topf", "topf_innen", "hochbeet"]; Apfelbaum → ["beet", "rasen"]; Lavendel → ["beet", "hochbeet", "topf", "kuebel"]; Salat → ["beet", "hochbeet", "topf", "gewaechshaus"].`

function buildResponseSchema() {
  const properties: Record<
    string,
    { type: string; description: string; items?: { type: string; enum?: string[] } }
  > = {}
  for (const key of FIELD_KEYS) {
    properties[key] = { type: 'STRING', description: FIELD_DESCRIPTIONS[key] }
  }
  properties.suitable_bed_kinds = {
    type: 'ARRAY',
    description: SUITABLE_BED_KINDS_DESCRIPTION,
    items: { type: 'STRING', enum: [...VALID_BED_KINDS] },
  }
  properties.categories = {
    type: 'ARRAY',
    description: CATEGORIES_DESCRIPTION,
    items: { type: 'STRING', enum: [...PLANT_CATEGORIES] },
  }
  return {
    type: 'OBJECT',
    properties,
    required: [...FIELD_KEYS, 'suitable_bed_kinds', 'categories'],
  }
}

const SYSTEM_PROMPT = `Du bist ein erfahrener Gärtner und Botaniker. Du hilfst Nutzern einer deutschen Garten-App, Pflanzen-Karteikarten auszufüllen.

Schreibe alle Antworten auf DEUTSCH, in knapper, praktischer Form — jedes Feld nur eine kurze Phrase oder ein bis zwei Sätze, wie auf einer Samenpackung. Der Kontext ist Hobby-Gartenbau in Mitteleuropa (Deutschland, Schweiz, Österreich).

Wenn du dir bei einem Feld unsicher bist, gib eine sinnvolle generische Antwort. Wenn du dir beim lateinischen Namen unsicher bist, gib einen leeren String zurück — erfinde niemals einen lateinischen Namen.

Bei category="Baum" oder "Strauch":
- "saatzeit" beschreibt die Pflanzzeit (z.B. wurzelnackte Ware Oktober–März, Containerware ganzjährig).
- "schneiden" beschreibt Schnittzeitpunkt und Schnittart (z.B. Erhaltungsschnitt im Februar, Pflegeschnitt nach der Blüte).
- "einjaehrig_oder_mehrjaehrig" ist immer "mehrjährig".
- "vorzucht" oft "nicht relevant".
- "saattiefe" oft "nicht relevant" oder beschreibt die Pflanzgrube.`

export type EnrichSeed = {
  name: string
  latin_name?: string
  category: string
}

export async function enrichPlantWithGemini(
  seed: EnrichSeed
): Promise<EnrichedPlant> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('Missing GOOGLE_AI_API_KEY')

  const model = getEnrichModel()

  const userPrompt = [
    `Pflanze: ${seed.name}`,
    seed.latin_name
      ? `Lateinischer Name (vom Nutzer vorgegeben): ${seed.latin_name}`
      : null,
    `Kategorie: ${seed.category}`,
    '',
    'Fülle alle Felder der Karteikarte aus. Wenn der lateinische Name vorgegeben ist, übernimm ihn exakt.',
  ]
    .filter(Boolean)
    .join('\n')

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
        responseSchema: buildResponseSchema(),
        temperature: 0.3,
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `Gemini enrich API ${response.status}: ${text.slice(0, 500)}`
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

  let parsed: Partial<EnrichedPlant>
  try {
    parsed = JSON.parse(text) as Partial<EnrichedPlant>
  } catch {
    throw new Error(`Gemini returned non-JSON: ${text.slice(0, 300)}`)
  }

  const result = {} as EnrichedPlant
  for (const key of FIELD_KEYS) {
    const v = parsed[key]
    result[key] = typeof v === 'string' ? v.trim() : ''
  }
  if (seed.latin_name) {
    result.latin_name = seed.latin_name
  }
  // Normalize bed-kind array: keep only known values, dedupe, cap at 4.
  const rawKinds = Array.isArray(parsed.suitable_bed_kinds)
    ? parsed.suitable_bed_kinds
    : []
  const cleanKinds: string[] = []
  for (const k of rawKinds) {
    if (typeof k !== 'string') continue
    const v = k.trim()
    if (!(VALID_BED_KINDS as readonly string[]).includes(v)) continue
    if (cleanKinds.includes(v)) continue
    cleanKinds.push(v)
    if (cleanKinds.length >= 4) break
  }
  result.suitable_bed_kinds = cleanKinds

  // Normalize categories array: keep only known values, dedupe, cap at 3.
  const rawCats = Array.isArray(parsed.categories) ? parsed.categories : []
  const cleanCats: string[] = []
  for (const c of rawCats) {
    if (typeof c !== 'string') continue
    const v = c.trim()
    if (!(PLANT_CATEGORIES as readonly string[]).includes(v)) continue
    if (cleanCats.includes(v)) continue
    cleanCats.push(v)
    if (cleanCats.length >= 3) break
  }
  result.categories = cleanCats
  return result
}

export { FIELD_KEYS }
