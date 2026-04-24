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

// Default to Gemini image generation since it's available on the free tier of
// Google AI Studio. Imagen 3 requires billing enabled on the underlying GCP
// project. Override with IMAGE_MODEL env var to use a different model.
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-2.5-flash-image'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

import { generateAndUploadKawaiiImage } from '../lib/generateKawaiiImage'

type PlantInput = {
  id: string
  name: string
  latin_name: string
  category: string
  illustration_url: string | null
}

async function listImageModels() {
  const url = `${API_BASE}/models?key=${GOOGLE_AI_KEY}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`ListModels failed: ${response.status} ${await response.text()}`)
  }
  const data = (await response.json()) as {
    models?: Array<{
      name?: string
      displayName?: string
      supportedGenerationMethods?: string[]
    }>
  }
  console.log('Image-generation-capable models for your API key:\n')
  const candidates = (data.models ?? []).filter((m) => {
    const n = m.name ?? ''
    const supports = m.supportedGenerationMethods ?? []
    const isImagey =
      n.includes('imagen') || n.includes('image') || n.includes('vision')
    const generates =
      supports.includes('predict') || supports.includes('generateContent')
    return isImagey && generates
  })
  if (candidates.length === 0) {
    console.log('  (none found — your key may not have image-gen access yet)')
    console.log('\nAll available models:')
    for (const m of data.models ?? []) {
      console.log(`  - ${m.name}  [${(m.supportedGenerationMethods ?? []).join(', ')}]`)
    }
    return
  }
  for (const m of candidates) {
    console.log(`  - ${m.name}  [${(m.supportedGenerationMethods ?? []).join(', ')}]`)
  }
  console.log('\nSet IMAGE_MODEL env var to one of these (without the "models/" prefix).')
  console.log('Example: IMAGE_MODEL=gemini-2.5-flash-image npm run generate-images')
}

async function main() {
  if (process.argv.includes('--list-models')) {
    await listImageModels()
    return
  }

  const regenAll = process.argv.includes('--all')
  console.log(`Model: ${IMAGE_MODEL}`)
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
      const url = await generateAndUploadKawaiiImage(
        plant.id,
        plant.name,
        plant.latin_name
      )
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
