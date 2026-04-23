import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY
const GOOGLE_AI_KEY = process.env.GOOGLE_AI_API_KEY

if (!SUPABASE_URL || !SUPABASE_SECRET || !GOOGLE_AI_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, GOOGLE_AI_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET)

// Imagen 3 endpoint via Google AI Studio. Free-tier limits apply; ~$0.04/image
// at standard pricing. Override the model name with IMAGEN_MODEL env var if a
// newer one becomes available (e.g. imagen-4.0-generate-001).
const IMAGEN_MODEL = process.env.IMAGEN_MODEL || 'imagen-3.0-generate-002'
const IMAGEN_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict?key=${GOOGLE_AI_KEY}`

type PlantInput = {
  id: string
  name: string
  latin_name: string
  category: string
  illustration_url: string | null
}

function buildPrompt(plant: PlantInput): string {
  // Style anchored to a consistent kawaii watercolor look. Avoids text on
  // image since text in generated images often comes out garbled.
  return [
    `kawaii botanical illustration of ${plant.name} (${plant.latin_name}),`,
    'cute character style, soft pastel watercolor,',
    'plain white background, single plant centered, friendly and charming,',
    'japanese kawaii aesthetic, gentle outlines,',
    'no text, no labels, no watermark',
  ].join(' ')
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ä/g, 'a')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

async function generateImage(prompt: string): Promise<Buffer> {
  const response = await fetch(IMAGEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '1:1',
        safetyFilterLevel: 'block_only_high',
        personGeneration: 'dont_allow',
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Imagen API ${response.status}: ${text}`)
  }

  const data = (await response.json()) as {
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>
  }
  const base64 = data.predictions?.[0]?.bytesBase64Encoded
  if (!base64) {
    throw new Error(`Imagen response missing image bytes: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return Buffer.from(base64, 'base64')
}

async function uploadImage(
  plantId: string,
  plantName: string,
  imageBytes: Buffer
): Promise<string> {
  const slug = slugify(plantName)
  const filePath = `kawaii/${plantId}-${slug}.png`

  const { error } = await supabase.storage
    .from('illustrations')
    .upload(filePath, imageBytes, {
      contentType: 'image/png',
      upsert: true,
    })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  const {
    data: { publicUrl },
  } = supabase.storage.from('illustrations').getPublicUrl(filePath)
  return publicUrl
}

async function main() {
  // CLI flag: --all reprocesses every plant; default skips ones that already
  // have an illustration_url. Useful for restyling the whole catalog later.
  const regenAll = process.argv.includes('--all')

  console.log(regenAll
    ? 'Mode: --all (regenerate every plant)'
    : 'Mode: missing-only (default)')

  const baseQuery = supabase
    .from('plants')
    .select('id, name, latin_name, category, illustration_url')
    .order('name')

  const { data: plants, error } = regenAll
    ? await baseQuery
    : await baseQuery.or('illustration_url.is.null,illustration_url.eq.')

  if (error) throw error
  if (!plants || plants.length === 0) {
    console.log('Nothing to do — all plants already have images.')
    return
  }

  console.log(`${plants.length} plant(s) to process.\n`)

  let success = 0
  let failed = 0
  const failures: string[] = []

  for (const plant of plants as PlantInput[]) {
    try {
      console.log(`🎨 ${plant.name} (${plant.latin_name})`)
      const prompt = buildPrompt(plant)
      const imageBytes = await generateImage(prompt)
      const url = await uploadImage(plant.id, plant.name, imageBytes)
      const { error: updateError } = await supabase
        .from('plants')
        .update({ illustration_url: url })
        .eq('id', plant.id)
      if (updateError) throw new Error(`DB update: ${updateError.message}`)
      console.log(`   ✓ ${url}`)
      success++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`   ✗ ${msg}`)
      failures.push(`${plant.name}: ${msg}`)
      failed++
    }

    // Light rate-limit pacing between requests.
    await new Promise((r) => setTimeout(r, 1500))
  }

  console.log(`\nDone — success: ${success}, failed: ${failed}`)
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
