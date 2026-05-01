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
const MODEL = process.env.BEDKINDS_MODEL || 'gemini-2.5-flash-lite'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

const VALID_BED_KINDS = [
  'beet',
  'hochbeet',
  'gewaechshaus',
  'topf',
  'topf_innen',
  'hydroponik',
  'rasen',
  'kuebel',
] as const

const SYSTEM_PROMPT = `Du bist ein erfahrener Gärtner. Du klassifizierst, welche Beet-Arten für eine bestimmte Pflanze in einem mitteleuropäischen Hobby-Garten realistisch in Frage kommen.

Wähle 1 bis 4 Werte aus dieser Liste:
- "beet": klassisches Freiland-Beet im Boden
- "hochbeet": erhöhtes Beet
- "gewaechshaus": Gewächshaus, Folientunnel, Frühbeet
- "topf": Topf außen (Balkon, Terrasse)
- "topf_innen": Fensterbank, Indoor-Topf
- "hydroponik": substratlos, oft indoor
- "rasen": Streuobstwiese, freistehend in Rasen/Wiese (vor allem für Bäume und Sträucher)
- "kuebel": Großgefäß für Kübelpflanzen (Olive, Zitrus, Balkonbaum)

Wähle nur die Beet-Arten, in denen die Pflanze realistisch gut gedeiht. Nicht raten — wenn unsicher, gib weniger Werte zurück. Beispiele: Tomate → ["beet","hochbeet","topf","gewaechshaus"]; Basilikum → ["topf","topf_innen","hochbeet"]; Apfelbaum → ["beet","rasen"]; Lavendel → ["beet","hochbeet","topf","kuebel"]; Salat → ["beet","hochbeet","topf","gewaechshaus"].`

async function classifyBedKinds(
  name: string,
  latinName: string,
  category: string,
  pflanzort: string | null
): Promise<string[] | null> {
  const url = `${API_BASE}/models/${MODEL}:generateContent?key=${GOOGLE_AI_KEY}`
  const userPrompt = [
    `Pflanze: ${name}${latinName ? ` (${latinName})` : ''}`,
    `Kategorie: ${category}`,
    pflanzort ? `Pflanzort-Hinweis aus Karteikarte: ${pflanzort}` : null,
    '',
    'Welche Beet-Arten passen? Antworte mit dem JSON-Schema.',
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
            suitable_bed_kinds: {
              type: 'ARRAY',
              items: { type: 'STRING', enum: [...VALID_BED_KINDS] },
            },
          },
          required: ['suitable_bed_kinds'],
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
    const parsed = JSON.parse(text) as { suitable_bed_kinds?: string[] }
    const raw = parsed.suitable_bed_kinds ?? []
    const clean: string[] = []
    for (const k of raw) {
      if (typeof k !== 'string') continue
      const v = k.trim()
      if (!(VALID_BED_KINDS as readonly string[]).includes(v)) continue
      if (clean.includes(v)) continue
      clean.push(v)
      if (clean.length >= 4) break
    }
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
    `Mode: ${all ? '--all (overwrite)' : 'missing-only (default)'}${
      dry ? ', --dry (preview only)' : ''
    }`
  )

  const baseQuery = supabase
    .from('plants')
    .select('id, name, latin_name, category, pflanzort, suitable_bed_kinds')
    .order('name')

  const { data: plants, error } = all
    ? await baseQuery
    : await baseQuery.is('suitable_bed_kinds', null)

  if (error) throw error
  if (!plants || plants.length === 0) {
    console.log('Nothing to do — all plants already have suitable_bed_kinds.')
    return
  }

  console.log(`${plants.length} plant(s) to classify.\n`)

  let success = 0
  let skipped = 0
  let failed = 0
  const failures: string[] = []

  for (const p of plants as Array<{
    id: string
    name: string
    latin_name: string
    category: string
    pflanzort: string | null
    suitable_bed_kinds: string[] | null
  }>) {
    try {
      const kinds = await classifyBedKinds(
        p.name,
        p.latin_name,
        p.category,
        p.pflanzort
      )
      if (!kinds) {
        console.log(`  ? ${p.name} — uncertain, leaving null`)
        skipped++
      } else {
        if (dry) {
          console.log(`  ~ ${p.name} → [${kinds.join(', ')}] (dry)`)
        } else {
          const { error: updateError } = await supabase
            .from('plants')
            .update({ suitable_bed_kinds: kinds })
            .eq('id', p.id)
          if (updateError) throw new Error(`DB update: ${updateError.message}`)
          console.log(`  ✓ ${p.name} → [${kinds.join(', ')}]`)
        }
        success++
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
    `\nDone — classified: ${success}, uncertain: ${skipped}, failed: ${failed}`
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
