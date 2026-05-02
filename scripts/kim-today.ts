import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

async function main() {
  const { data: gardens } = await supabase
    .from('gardens')
    .select('id, owner_name')
    .ilike('owner_name', '%kim%')

  if (!gardens || gardens.length === 0) {
    console.log('No garden matching "kim" found.')
    return
  }

  const startUTC = new Date()
  startUTC.setUTCHours(0, 0, 0, 0)
  const startISO = startUTC.toISOString()

  console.log(`Window: since ${startISO} (UTC)\n`)

  for (const g of gardens as Array<{ id: string; owner_name: string }>) {
    const [gpRes, beddingRes] = await Promise.all([
      supabase
        .from('garden_plants')
        .select('id, plant_id, planted_at, created_at, plants(name, category, created_at)')
        .eq('garden_id', g.id)
        .gte('created_at', startISO)
        .order('created_at', { ascending: true }),
      supabase
        .from('bed_plantings')
        .select('id, plant_id, planted_at, season_year, created_at, plants(name), beds!inner(label, garden_id)')
        .eq('beds.garden_id', g.id)
        .gte('created_at', startISO)
        .order('created_at', { ascending: true }),
    ])

    type GP = {
      id: string
      plant_id: string
      planted_at: string | null
      created_at: string
      plants:
        | { name: string; category: string; created_at: string }
        | Array<{ name: string; category: string; created_at: string }>
        | null
    }
    type BP = {
      id: string
      plant_id: string
      planted_at: string | null
      season_year: number
      created_at: string
      plants: { name: string } | Array<{ name: string }> | null
      beds:
        | { label: string; garden_id: string }
        | Array<{ label: string; garden_id: string }>
        | null
    }

    const gp = (gpRes.data ?? []) as GP[]
    const bp = (beddingRes.data ?? []) as BP[]

    let manuallyCreatedToday = 0
    for (const r of gp) {
      const p = Array.isArray(r.plants) ? r.plants[0] : r.plants
      if (!p) continue
      // Plant row was newly created today (not just added to garden) →
      // counts as a manual /browse/add action by this user.
      if (p.created_at >= startISO) manuallyCreatedToday++
    }

    console.log(`────── ${g.owner_name} (${g.id})`)
    console.log(`  garden_plants neu heute:   ${gp.length}`)
    console.log(`     davon manuell angelegt: ${manuallyCreatedToday}`)
    console.log(`  bed_plantings neu heute:   ${bp.length}`)

    if (gp.length > 0) {
      console.log('\n  Pflanzen heute hinzugefügt:')
      for (const r of gp) {
        const p = Array.isArray(r.plants) ? r.plants[0] : r.plants
        if (!p) continue
        const t = r.created_at.slice(11, 16)
        const isNew = p.created_at >= startISO ? ' [NEU im Katalog]' : ''
        const planted = r.planted_at ? ` · gepflanzt seit ${r.planted_at}` : ' · interessiert'
        console.log(`    ${t}  ${p.name} (${p.category})${planted}${isNew}`)
      }
    }

    if (bp.length > 0) {
      console.log('\n  Beet-Bepflanzungen heute:')
      for (const r of bp) {
        const p = Array.isArray(r.plants) ? r.plants[0] : r.plants
        const b = Array.isArray(r.beds) ? r.beds[0] : r.beds
        if (!p || !b) continue
        const t = r.created_at.slice(11, 16)
        const planted = r.planted_at
          ? `gepflanzt ${r.planted_at}`
          : r.season_year < new Date().getFullYear()
            ? `Vorjahr ${r.season_year}`
            : 'geplant'
        console.log(`    ${t}  ${b.label} ← ${p.name} · ${planted}`)
      }
    }
    console.log('')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
