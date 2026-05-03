/**
 * Stage 8.2 — lightweight Gemini call that returns ONLY plant categories,
 * for the live "smart suggestion" UI in /browse/add. Reused server-side by
 * `app/browse/add/actions.ts:suggestCategoriesForPlant` and shares the same
 * SYSTEM_PROMPT as the bulk backfill (`scripts/backfill-categories.ts`)
 * so suggestions stay consistent.
 *
 * Much cheaper than the full enrich (16 fields + bed kinds + categories) —
 * gemini-2.5-flash-lite, single ARRAY-of-STRING return, ~600–900 ms.
 */

import { PLANT_CATEGORIES } from '@/lib/supabase'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const REQUEST_TIMEOUT_MS = 12_000
const MODEL = process.env.CATEGORIES_MODEL || 'gemini-2.5-flash-lite'

const SYSTEM_PROMPT = `Du bist Botaniker und Hobby-Gärtner. Du klassifizierst Pflanzen in 1–3 Findability-Kategorien.

Wähle aus dieser Liste:
- "Gemüse": klassisches Gemüse (Karotte, Salat, Gurke …). Auch botanisch-Frucht-aber-kulinarisch-Gemüse: Tomate, Paprika, Aubergine, Zucchini, Kürbis bekommen ZUSÄTZLICH "Obst" weil botanisch eine Frucht.
- "Kraut": Würz- und Heilkräuter (Petersilie, Basilikum, Salbei, Oregano …). Halbsträucher wie Lavendel, Rosmarin, Thymian, Salbei bekommen ZUSÄTZLICH "Strauch".
- "Blume": Zier-Blühpflanzen (Tulpe, Rose, Sonnenblume …)
- "Obst": eßbare Früchte. Obstbäume (Apfel, Kirsche, Pflaume, Zitrone, Orange …) bekommen ZUSÄTZLICH "Baum". Beerensträucher (Brombeere, Himbeere, Heidelbeere, Holunder, Johannisbeere, Stachelbeere) bekommen ZUSÄTZLICH "Strauch".
- "Baum": Zier-/Forstgehölze und große Holzgewächse. Obstbäume sind primär "Obst" + sekundär "Baum".
- "Strauch": Zier-Sträucher (Forsythie, Hortensie, Flieder …). Beerensträucher sind primär "Obst" + sekundär "Strauch".
- "Nuss": Nuss-Pflanzen (Walnuss, Haselnuss, Mandel). Kombiniert mit "Baum" oder "Strauch" je nach Wuchsform.

Reihenfolge: die treffendste Primär-Kategorie zuerst. Maximal 3 Werte.

Beispiele:
- Tomate → ["Gemüse", "Obst"]
- Apfel → ["Obst", "Baum"]
- Zitrone → ["Obst", "Baum"]
- Walnuss → ["Nuss", "Baum"]
- Haselnuss → ["Nuss", "Strauch"]
- Brombeere → ["Obst", "Strauch"]
- Lavendel → ["Kraut", "Strauch"]
- Möhre → ["Gemüse"]
- Rose → ["Blume", "Strauch"]
- Tulpe → ["Blume"]
- Tanne → ["Baum"]`

export type ClassifyResult = {
  categories: string[]
} | null

/**
 * Calls Gemini to classify a plant. Returns null on any failure (rate-limit,
 * network, parse error) so the caller can silently fall back to manual mode.
 */
export async function classifyPlantCategories(
  name: string,
  latinName: string
): Promise<ClassifyResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) return null
  if (!name || name.length < 2 || name.length > 80) return null

  const url = `${API_BASE}/models/${MODEL}:generateContent?key=${apiKey}`
  const userPrompt = [
    `Pflanze: ${name}${latinName ? ` (${latinName})` : ''}`,
    '',
    'Welche 1–3 Kategorien beschreiben diese Pflanze am besten? Antworte mit dem JSON-Schema.',
  ].join('\n')

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              categories: {
                type: 'ARRAY',
                items: { type: 'STRING', enum: [...PLANT_CATEGORIES] },
              },
            },
            required: ['categories'],
          },
          temperature: 0.1,
        },
      }),
    })
    if (!response.ok) return null
    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return null
    const parsed = JSON.parse(text) as { categories?: string[] }
    const raw = parsed.categories ?? []
    const clean: string[] = []
    const valid = PLANT_CATEGORIES as readonly string[]
    for (const c of raw) {
      if (typeof c !== 'string') continue
      const v = c.trim()
      if (!valid.includes(v)) continue
      if (clean.includes(v)) continue
      clean.push(v)
      if (clean.length >= 3) break
    }
    if (clean.length === 0) return null
    return { categories: clean }
  } catch {
    return null
  }
}
