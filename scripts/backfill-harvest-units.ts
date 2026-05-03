/**
 * Stage 9 — Backfill `plants.harvest_unit` for the existing 135+ catalog rows.
 *
 * Idempotent: skips rows where harvest_unit IS NOT NULL by default.
 *   --all : overwrite every row
 *   --dry : preview only, no DB writes
 *   --only=<key> : fixate to a single key for retries
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY
const GOOGLE_AI_KEY = process.env.GOOGLE_AI_API_KEY

if (!SUPABASE_URL || !SUPABASE_SECRET || !GOOGLE_AI_KEY) {
  console.error(
    'Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, GOOGLE_AI_API_KEY'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET)
const MODEL = process.env.HARVEST_UNIT_MODEL || 'gemini-2.5-flash-lite'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

const VALID_UNITS = ['kg', 'g', 'stueck', 'bund', 'kopf', 'schnitt', 'schale'] as const
// "keine" sentinel = no harvest unit (flowers etc.) — converted to NULL on store.
// Empty-string enum values are rejected by Gemini's response-schema validator,
// so we use an explicit sentinel.
const NONE_SENTINEL = 'keine'
const VALID_RESPONSES = [...VALID_UNITS, NONE_SENTINEL] as const

const SYSTEM_PROMPT = `Du bist Hobby-Gärtner und Botaniker. Du sagst, in welcher Mengen-Einheit die Ernte einer Pflanze typisch erfasst wird.

Wähle GENAU EINEN dieser Werte:
- "kg": Frucht-Gemüse (Tomate, Paprika, Gurke, Kürbis), Wurzelgemüse (Karotte, Kartoffel, Rote Bete), Obstbäume (Apfel, Birne, Pflaume, Zitrone), Beeren in größeren Mengen, Walnuss
- "g": kleine Beerenmengen, Pilze, sehr leichtes Erntegut wo "kg" zu groß wäre
- "stueck": einzelne zählbare Früchte oder Köpfe (Aubergine, Zitrone wenn vom kleinen Baum, Sonnenblumenköpfe, Blumenzwiebeln)
- "bund": Pflücksalat, Babyleaf, Kräuter mit Stiel (Petersilie, Schnittlauch, Dill, Koriander), Lauch, Radieschen
- "kopf": Kohlarten (Kopfsalat, Brokkoli, Blumenkohl, Eisbergsalat, Rosenkohl)
- "schnitt": Kräuter mit Schnittnutzung (Basilikum, Rosmarin, Thymian, Salbei, Oregano) — wenn "bund" auch passt, nimm "bund"
- "schale": Beeren (Erdbeeren, Brombeeren, Himbeeren, Heidelbeeren, Johannisbeeren, Stachelbeeren)
- "keine": bei Pflanzen wo keine Mengen-Ernte sinnvoll ist — Zier-Blumen (Tulpe, Rose), reine Zier-Sträucher (Forsythie, Hortensie), Zier-Bäume.

Beispiele:
- Tomate → "kg"
- Pflücksalat → "bund"
- Schnittlauch → "bund"
- Basilikum → "bund"
- Brokkoli → "kopf"
- Apfel → "kg"
- Erdbeere → "schale"
- Walnuss → "kg"
- Tulpe → "keine"
- Lavendel → "keine"
- Rose → "keine"`

async function classifyHarvestUnit(
  name: string,
  latinName: string | null,
  category: string,
  primary?: string
): Promise<string | null> {
  const url = `${API_BASE}/models/${MODEL}:generateContent?key=${GOOGLE_AI_KEY}`
  const userPrompt = [
    `Pflanze: ${name}${latinName ? ` (${latinName})` : ''}`,
    `Kategorie: ${category}`,
    primary ? `Primary: ${primary}` : null,
    '',
    'Welche Mengen-Einheit ist beim Ernten typisch? Antworte mit dem JSON-Schema.',
  ]
    .filter(Boolean)
    .join('\n')

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            harvest_unit: {
              type: 'STRING',
              enum: [...VALID_RESPONSES],
            },
          },
          required: ['harvest_unit'],
        },
        temperature: 0.1,
      },
    }),
  })
  if (!response.ok) {
    throw new Error(`Gemini API ${response.status}: ${await response.text()}`)
  }
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return null
  try {
    const parsed = JSON.parse(text) as { harvest_unit?: string }
    const v = (parsed.harvest_unit ?? '').trim()
    if (v === NONE_SENTINEL || v === '') return '' // valid "no unit"
    if ((VALID_UNITS as readonly string[]).includes(v)) return v
    return null
  } catch {
    return null
  }
}

async function main() {
  const all = process.argv.includes('--all')
  const dry = process.argv.includes('--dry')
  console.log(`Model: ${MODEL}`)
  console.log(
    `Mode: ${all ? '--all (overwrite every row)' : 'NULL-only'}${dry ? ', --dry (preview only)' : ''}`
  )

  const query = supabase
    .from('plants')
    .select('id, name, latin_name, category, harvest_unit')
    .order('name')
  if (!all) query.is('harvest_unit', null)
  const { data, error } = await query
  if (error) {
    console.error('SELECT failed:', error)
    process.exit(1)
  }
  const rows = data ?? []
  console.log(`Plants to process: ${rows.length}`)

  let ok = 0
  let nullSet = 0
  let failed = 0
  for (const row of rows) {
    const r = row as {
      id: string
      name: string
      latin_name: string | null
      category: string
      harvest_unit: string | null
    }
    process.stdout.write(`… ${r.name.padEnd(30)} `)
    try {
      const unit = await classifyHarvestUnit(r.name, r.latin_name, r.category)
      if (unit === null) {
        console.log(`✗ no answer`)
        failed++
      } else {
        const stored = unit === '' ? null : unit
        console.log(stored ? `→ ${stored}` : `→ (kein, NULL)`)
        if (!dry) {
          const { error: uErr } = await supabase
            .from('plants')
            .update({ harvest_unit: stored })
            .eq('id', r.id)
          if (uErr) {
            console.log(`  update failed: ${uErr.message}`)
            failed++
            continue
          }
        }
        if (stored === null) nullSet++
        else ok++
      }
    } catch (e) {
      console.log(`✗ ${e instanceof Error ? e.message.slice(0, 200) : 'error'}`)
      failed++
    }
    // Polite pause for free-tier rate limit
    await new Promise((r) => setTimeout(r, 600))
  }
  console.log(`\nDone. ok=${ok} null=${nullSet} failed=${failed}`)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
