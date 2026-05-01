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
    .select('id, owner_name, password_hash, location_label, zip_code')
    .order('owner_name')

  if (!gardens) {
    console.error('No gardens')
    process.exit(1)
  }

  type Row = {
    name: string
    loggedIn: boolean
    plants: number
    planted: number
    interessiert: number
    beds: number
    bedPlantings: number
    location: string | null
  }

  const rows: Row[] = []

  for (const g of gardens as Array<{
    id: string
    owner_name: string
    password_hash: string | null
    location_label: string | null
  }>) {
    const [gp, beds, bp] = await Promise.all([
      supabase
        .from('garden_plants')
        .select('id, planted_at', { count: 'exact', head: false })
        .eq('garden_id', g.id),
      supabase
        .from('beds')
        .select('id', { count: 'exact', head: true })
        .eq('garden_id', g.id),
      supabase
        .from('bed_plantings')
        .select('id, beds!inner(garden_id)', { count: 'exact', head: true })
        .eq('beds.garden_id', g.id),
    ])
    const gpRows = (gp.data ?? []) as Array<{ planted_at: string | null }>
    rows.push({
      name: g.owner_name,
      loggedIn: !!g.password_hash,
      plants: gpRows.length,
      planted: gpRows.filter((r) => !!r.planted_at).length,
      interessiert: gpRows.filter((r) => !r.planted_at).length,
      beds: beds.count ?? 0,
      bedPlantings: bp.count ?? 0,
      location: g.location_label,
    })
  }

  // Print as table
  console.log('')
  console.log(
    'Garten         Login   Pflanzen (✓gepflanzt + 📦Samen)   Beete   Bepflanzungen   Standort'
  )
  console.log('─'.repeat(110))
  for (const r of rows) {
    const login = r.loggedIn ? '✓' : '·'
    const plants = `${r.plants.toString().padStart(2)} (${r.planted}✓ + ${r.interessiert}📦)`
    const beds = r.beds.toString().padStart(2)
    const bp = r.bedPlantings.toString().padStart(2)
    const loc = r.location ?? '—'
    console.log(
      `${r.name.padEnd(15)}${login.padEnd(8)}${plants.padEnd(34)}${beds.padEnd(8)}${bp.padEnd(16)}${loc}`
    )
  }
  console.log('')

  const active = rows.filter((r) => r.loggedIn && (r.plants > 0 || r.beds > 0))
  const setup = rows.filter((r) => r.loggedIn && r.plants === 0 && r.beds === 0)
  const cold = rows.filter((r) => !r.loggedIn)
  console.log(`Aktiv (eingeloggt + Daten):   ${active.map((r) => r.name).join(', ') || '—'}`)
  console.log(`Eingeloggt aber leer:         ${setup.map((r) => r.name).join(', ') || '—'}`)
  console.log(`Noch nie eingeloggt:          ${cold.map((r) => r.name).join(', ') || '—'}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
