import { createClient } from '@supabase/supabase-js'
import { readFile } from 'fs/promises'
import * as path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseSecretKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseSecretKey)

type PlantEntry = {
  name: string
  latin_name: string
  category: 'Gemüse' | 'Kraut' | 'Blume' | 'Obst'
  sorte?: string
  saatzeit?: string
  saattiefe?: string
  nachbarn?: string
  erde?: string
  witterung?: string
  bodenmilieu?: string
  duenger?: string
  vorzucht?: string
  schneiden?: string
  einwintern?: string
  ernte?: string
  einjaehrig_oder_mehrjaehrig?: string
  pflanzort?: string
  wirkung?: string
  stark_oder_schwachzehrer?: string
  needs_review?: boolean
}

async function main() {
  const jsonPath = path.resolve(process.cwd(), 'data/plants.json')
  const raw = await readFile(jsonPath, 'utf-8')
  const entries: PlantEntry[] = JSON.parse(raw)

  console.log(`Loaded ${entries.length} plant entries from ${jsonPath}`)

  let inserted = 0
  let updated = 0
  let failed = 0

  for (const entry of entries) {
    // Fetch existing to preserve illustration_url if already set.
    const { data: existing } = await supabase
      .from('plants')
      .select('id, illustration_url')
      .eq('name', entry.name)
      .eq('latin_name', entry.latin_name)
      .maybeSingle()

    // Drop fields that aren't columns on the plants table.
    // needs_review is a curation-only flag, kept out of the DB.
    const { needs_review: _ignored, ...dbFields } = entry

    if (existing) {
      const { error } = await supabase
        .from('plants')
        .update(dbFields)
        .eq('id', existing.id)
      if (error) {
        console.error(`  ✗ update failed for ${entry.name}:`, error.message)
        failed++
      } else {
        console.log(`  ↻ updated  ${entry.name} (${entry.latin_name})`)
        updated++
      }
    } else {
      const { error } = await supabase.from('plants').insert(dbFields)
      if (error) {
        console.error(`  ✗ insert failed for ${entry.name}:`, error.message)
        failed++
      } else {
        console.log(`  + inserted ${entry.name} (${entry.latin_name})`)
        inserted++
      }
    }
  }

  console.log('')
  console.log(`Done — inserted: ${inserted}, updated: ${updated}, failed: ${failed}`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
