import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const ORIG_ID = '9a8bbe14-c9a1-45ae-89bf-4e38f6784e4c' // Rote Bete (original)
const KIM_ID = 'ac22e450-8e27-4d83-9022-97c84de9f3f2' // Rote Beete (Kim's)

async function main() {
  console.log('Step 1: Move garden_plants refs from original → Kim version')
  const { data: gpUpdated, error: gpErr } = await supabase
    .from('garden_plants')
    .update({ plant_id: KIM_ID })
    .eq('plant_id', ORIG_ID)
    .select('id, garden_id')
  if (gpErr) throw gpErr
  console.log(`  → ${gpUpdated?.length ?? 0} garden_plants row(s) moved`)

  console.log('Step 2: Move bed_plantings refs (should be 0)')
  const { data: bpUpdated, error: bpErr } = await supabase
    .from('bed_plantings')
    .update({ plant_id: KIM_ID })
    .eq('plant_id', ORIG_ID)
    .select('id')
  if (bpErr) throw bpErr
  console.log(`  → ${bpUpdated?.length ?? 0} bed_plantings row(s) moved`)

  console.log('Step 3: Delete original "Rote Bete" plant row')
  const { error: delErr } = await supabase
    .from('plants')
    .delete()
    .eq('id', ORIG_ID)
  if (delErr) throw delErr
  console.log('  → deleted')

  // Verify
  console.log('\nVerify:')
  const { data: leftover } = await supabase
    .from('plants')
    .select('id, name')
    .eq('id', ORIG_ID)
    .maybeSingle()
  console.log(`  original row exists? ${leftover ? 'YES (FAIL)' : 'no ✓'}`)

  const { count: kimRefs } = await supabase
    .from('garden_plants')
    .select('id', { count: 'exact', head: true })
    .eq('plant_id', KIM_ID)
  console.log(`  garden_plants pointing at Kim's Rote Beete: ${kimRefs}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
