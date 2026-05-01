import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const ORIG_ID = '9a8bbe14-c9a1-45ae-89bf-4e38f6784e4c' // Rote Bete (original)
const KIM_ID = 'ac22e450-8e27-4d83-9022-97c84de9f3f2' // Rote Beete (Kim)

async function main() {
  // Who has the original "Rote Bete" in their garden?
  const { data: origRefs } = await supabase
    .from('garden_plants')
    .select('id, planted_at, gardens!inner(owner_name)')
    .eq('plant_id', ORIG_ID)

  console.log('Refs to ORIGINAL "Rote Bete":')
  for (const r of (origRefs ?? []) as Array<{
    id: string
    planted_at: string | null
    gardens: { owner_name: string } | Array<{ owner_name: string }> | null
  }>) {
    const g = Array.isArray(r.gardens) ? r.gardens[0] : r.gardens
    const status = r.planted_at ? `gepflanzt ${r.planted_at}` : 'interessiert'
    console.log(`  - ${g?.owner_name ?? '?'}: ${status}`)
  }

  // Does that garden also already have Kim's "Rote Beete"?
  const ownerIds = new Set<string>()
  for (const r of (origRefs ?? []) as Array<{
    gardens: { owner_name: string } | Array<{ owner_name: string }> | null
  }>) {
    // Need garden_id, not name. Re-query with garden_id.
  }

  const { data: refsWithGid } = await supabase
    .from('garden_plants')
    .select('garden_id')
    .eq('plant_id', ORIG_ID)
  const gids = new Set<string>(
    (refsWithGid ?? []).map((r: { garden_id: string }) => r.garden_id)
  )

  console.log(`\nGardens holding original: ${gids.size}`)
  for (const gid of gids) {
    const { data: collision } = await supabase
      .from('garden_plants')
      .select('id')
      .eq('plant_id', KIM_ID)
      .eq('garden_id', gid)
      .maybeSingle()
    console.log(
      `  garden=${gid}: also has Kim's Rote Beete? ${collision ? 'YES (collision)' : 'no'}`
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
