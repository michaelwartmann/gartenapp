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
const MODEL = process.env.FAMILY_MODEL || 'gemini-2.5-flash-lite'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

const FAMILIES = [
  'Solanaceae',
  'Brassicaceae',
  'Asteraceae',
  'Apiaceae',
  'Fabaceae',
  'Cucurbitaceae',
  'Lamiaceae',
  'Amaryllidaceae',
  'Rosaceae',
  'Chenopodiaceae',
  'Amaranthaceae',
  'Polygonaceae',
  'Liliaceae',
  'Asparagaceae',
  'Poaceae',
  'Boraginaceae',
  'Tropaeolaceae',
  'Caryophyllaceae',
  'Other',
]

async function classifyFamily(
  name: string,
  latinName: string
): Promise<string | null> {
  const url = `${API_BASE}/models/${MODEL}:generateContent?key=${GOOGLE_AI_KEY}`
  const systemPrompt = `Du bist Botaniker. Gib für eine Pflanze die korrekte botanische Familie auf Latein zurück. Wähle aus der vorgegebenen Liste oder gib "Other" wenn keine passt. Niemals raten — wenn du dir unsicher bist, gib "Other" zurück.`
  const userPrompt = `Pflanze: ${name}${
    latinName ? ` (${latinName})` : ''
  }\n\nMögliche Familien: ${FAMILIES.join(', ')}\n\nAntworte mit dem JSON-Schema.`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: { family: { type: 'STRING' } },
          required: ['family'],
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
    const parsed = JSON.parse(text) as { family?: string }
    const f = parsed.family?.trim()
    if (!f || f === 'Other') return null
    return f
  } catch {
    return null
  }
}

async function main() {
  const all = process.argv.includes('--all')
  console.log(`Model: ${MODEL}`)
  console.log(all ? 'Mode: --all (overwrite)' : 'Mode: missing-only (default)')

  const baseQuery = supabase
    .from('plants')
    .select('id, name, latin_name, family')
    .order('name')

  const { data: plants, error } = all
    ? await baseQuery
    : await baseQuery.is('family', null)

  if (error) throw error
  if (!plants || plants.length === 0) {
    console.log('Nothing to do — all plants already have a family.')
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
    family: string | null
  }>) {
    try {
      const family = await classifyFamily(p.name, p.latin_name)
      if (!family) {
        console.log(`  ? ${p.name} — uncertain, leaving null`)
        skipped++
      } else {
        const { error: updateError } = await supabase
          .from('plants')
          .update({ family })
          .eq('id', p.id)
        if (updateError) throw new Error(`DB update: ${updateError.message}`)
        console.log(`  ✓ ${p.name} → ${family}`)
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
