// Bulk-set garden locations from a JSON file.
//
// Usage:
//   1. Create scripts/locations.json with shape:
//      {
//        "Heike":  { "zip": "70173", "country": "DE" },
//        "Alina":  { "zip": "72655", "country": "DE" },
//        ...
//      }
//   2. Run: npx tsx scripts/set-locations.ts
//
// Idempotent — re-running with the same file is safe (it just re-geocodes
// and writes the same lat/lng). Pass --dry to preview without writing.

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { geocodeZip, type CountryCode } from '../lib/weather'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

type Entry = { zip: string; country: string }
type Spec = Record<string, Entry>

async function main() {
  const dryRun = process.argv.includes('--dry')
  const path = resolve(process.cwd(), 'scripts/locations.json')
  let spec: Spec
  try {
    spec = JSON.parse(readFileSync(path, 'utf-8')) as Spec
  } catch (err) {
    console.error(
      `Konnte ${path} nicht lesen — lege die Datei an mit Format:`
    )
    console.error(
      JSON.stringify(
        {
          Heike: { zip: '70173', country: 'DE' },
          Alina: { zip: '72655', country: 'DE' },
        },
        null,
        2
      )
    )
    process.exit(1)
  }

  console.log(
    dryRun ? 'Dry-Run — schreibe nichts.' : 'Setze Standorte ...'
  )
  console.log(`${Object.keys(spec).length} Garten/Gärten in der Spec.\n`)

  let success = 0
  let failed = 0

  for (const [name, entry] of Object.entries(spec)) {
    const cc = entry.country.trim().toUpperCase() as CountryCode
    const geo = await geocodeZip(entry.zip, cc)
    if (!geo) {
      console.error(`  ✗ ${name}: PLZ ${entry.zip} (${cc}) nicht gefunden`)
      failed++
      continue
    }
    console.log(
      `  ✓ ${name}: ${geo.zip} → ${geo.label} (${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)})`
    )
    if (dryRun) {
      success++
      continue
    }
    const { error } = await supabase
      .from('gardens')
      .update({
        zip_code: geo.zip,
        country_code: geo.country,
        latitude: geo.lat,
        longitude: geo.lng,
        location_label: geo.label,
        weather_cache: null,
        weather_cache_at: null,
      })
      .eq('owner_name', name)
    if (error) {
      console.error(`     DB-Update für "${name}" fehlgeschlagen: ${error.message}`)
      failed++
    } else {
      success++
    }
    await new Promise((r) => setTimeout(r, 250))
  }

  console.log(`\nFertig — ${success} ok, ${failed} Fehler.`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
