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
const MODEL = process.env.CATEGORIES_MODEL || 'gemini-2.5-flash-lite'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

const VALID_CATEGORIES = [
  'Gemüse',
  'Kraut',
  'Blume',
  'Obst',
  'Baum',
  'Strauch',
  'Nuss',
] as const

const SYSTEM_PROMPT = `Du bist Botaniker und Hobby-Gärtner. Du klassifizierst Pflanzen in 1–3 Findability-Kategorien.

Wähle aus dieser Liste:
- "Gemüse": klassisches Gemüse (Karotte, Salat, Gurke …). Auch botanisch-Frucht-aber-kulinarisch-Gemüse: Tomate, Paprika, Aubergine, Zucchini, Kürbis bekommen ZUSÄTZLICH "Obst" weil botanisch eine Frucht.
- "Kraut": Würz- und Heilkräuter (Petersilie, Basilikum, Salbei, Oregano …). Halbsträucher wie Lavendel, Rosmarin, Thymian, Salbei bekommen ZUSÄTZLICH "Strauch".
- "Blume": Zier-Blühpflanzen (Tulpe, Rose, Sonnenblume …)
- "Obst": eßbare Früchte. Obstbäume (Apfel, Kirsche, Pflaume …) bekommen ZUSÄTZLICH "Baum". Beerensträucher (Brombeere, Himbeere, Heidelbeere, Holunder, Johannisbeere, Stachelbeere) bekommen ZUSÄTZLICH "Strauch".
- "Baum": Zier-/Forstgehölze und große Holzgewächse. Obstbäume sind primär "Obst" + sekundär "Baum".
- "Strauch": Zier-Sträucher (Forsythie, Hortensie, Flieder …). Beerensträucher sind primär "Obst" + sekundär "Strauch".
- "Nuss": Nuss-Pflanzen (Walnuss, Haselnuss, Mandel). Kombiniert mit "Baum" oder "Strauch" je nach Wuchsform.

Reihenfolge: die treffendste Primär-Kategorie zuerst (= aktuelle plants.category als Anker, falls plausibel). Maximal 3 Werte.

Beispiele:
- Tomate → ["Gemüse", "Obst"]
- Apfel → ["Obst", "Baum"]
- Walnuss → ["Nuss", "Baum"]
- Haselnuss → ["Nuss", "Strauch"]
- Brombeere → ["Obst", "Strauch"]
- Lavendel → ["Kraut", "Strauch"]
- Möhre → ["Gemüse"] (nur eine zutreffend)
- Rose → ["Blume", "Strauch"] (Rose wird als Strauch kultiviert, blüht aber prominent)
- Tulpe → ["Blume"]
- Tanne → ["Baum"]`

async function classifyCategories(
  name: string,
  latinName: string,
  primary: string
): Promise<string[] | null> {
  const url = `${API_BASE}/models/${MODEL}:generateContent?key=${GOOGLE_AI_KEY}`
  const userPrompt = [
    `Pflanze: ${name}${latinName ? ` (${latinName})` : ''}`,
    `Aktuelle Primär-Kategorie: ${primary}`,
    '',
    'Welche 1–3 Kategorien beschreiben diese Pflanze am besten? Antworte mit dem JSON-Schema.',
  ].join('\n')

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
            categories: {
              type: 'ARRAY',
              items: { type: 'STRING', enum: [...VALID_CATEGORIES] },
            },
          },
          required: ['categories'],
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
    const parsed = JSON.parse(text) as { categories?: string[] }
    const raw = parsed.categories ?? []
    const clean: string[] = []
    for (const c of raw) {
      if (typeof c !== 'string') continue
      const v = c.trim()
      if (!(VALID_CATEGORIES as readonly string[]).includes(v)) continue
      if (clean.includes(v)) continue
      clean.push(v)
      if (clean.length >= 3) break
    }
    // Ensure existing primary is in result, prepend if missing.
    if (!clean.includes(primary)) clean.unshift(primary)
    if (clean.length > 3) clean.length = 3
    return clean.length > 0 ? clean : null
  } catch {
    return null
  }
}

async function main() {
  const all = process.argv.includes('--all')
  const dry = process.argv.includes('--dry')
  console.log(`Model: ${MODEL}`)
  console.log(
    `Mode: ${
      all
        ? '--all (overwrite every row)'
        : 'incomplete-only (cardinality < 2 or null)'
    }${dry ? ', --dry (preview only)' : ''}`
  )

  // Pull candidate set. Without --all, we want rows where categories is null
  // or only contains the primary (cardinality 1).
  const baseQuery = supabase
    .from('plants')
    .select('id, name, latin_name, category, categories')
    .order('name')

  const { data: plants, error } = await baseQuery
  if (error) throw error
  if (!plants || plants.length === 0) {
    console.log('No plants found.')
    return
  }

  const filtered = all
    ? plants
    : plants.filter((p) => {
        const cats = (p as { categories: string[] | null }).categories
        return !cats || cats.length < 2
      })

  if (filtered.length === 0) {
    console.log('Nothing to do — all plants already have ≥2 categories.')
    return
  }

  console.log(`${filtered.length} plant(s) to classify.\n`)

  let success = 0
  let unchanged = 0
  let failed = 0
  const failures: string[] = []

  for (const p of filtered as Array<{
    id: string
    name: string
    latin_name: string
    category: string
    categories: string[] | null
  }>) {
    try {
      const cats = await classifyCategories(p.name, p.latin_name, p.category)
      if (!cats) {
        console.log(`  ? ${p.name} — no result, skipping`)
        unchanged++
      } else {
        // Compare against existing — only write if different.
        const existing = p.categories ?? [p.category]
        const same =
          existing.length === cats.length &&
          existing.every((v, i) => v === cats[i])
        if (same) {
          console.log(`  = ${p.name} unchanged [${cats.join(', ')}]`)
          unchanged++
        } else if (dry) {
          console.log(
            `  ~ ${p.name} ${JSON.stringify(existing)} → ${JSON.stringify(cats)} (dry)`
          )
          success++
        } else {
          const { error: updateError } = await supabase
            .from('plants')
            .update({ categories: cats })
            .eq('id', p.id)
          if (updateError) throw new Error(`DB update: ${updateError.message}`)
          console.log(`  ✓ ${p.name} → [${cats.join(', ')}]`)
          success++
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ ${p.name}: ${msg}`)
      failures.push(`${p.name}: ${msg}`)
      failed++
    }
    await new Promise((r) => setTimeout(r, 600))
  }

  console.log(
    `\nDone — updated: ${success}, unchanged: ${unchanged}, failed: ${failed}`
  )
  if (failures.length > 0) {
    console.log('\nFailures:')
    failures.forEach((f) => console.log(`  - ${f}`))
  }
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
