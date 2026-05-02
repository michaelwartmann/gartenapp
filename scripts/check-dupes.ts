import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

async function main() {
  for (const search of ['hortensie', 'rote bete', 'rote beete']) {
    const { data } = await supabase
      .from('plants')
      .select(
        'id, name, latin_name, category, categories, illustration_url, created_at'
      )
      .ilike('name', `%${search}%`)
      .order('created_at')

    console.log(`\n── search "${search}" → ${data?.length ?? 0} match(es)`)
    for (const p of data ?? []) {
      // Count refs
      const [{ count: gpCount }, { count: bpCount }] = await Promise.all([
        supabase
          .from('garden_plants')
          .select('id', { count: 'exact', head: true })
          .eq('plant_id', p.id),
        supabase
          .from('bed_plantings')
          .select('id', { count: 'exact', head: true })
          .eq('plant_id', p.id),
      ])
      console.log(`  ${p.id}`)
      console.log(`    name:        ${p.name}`)
      console.log(`    latin_name:  ${p.latin_name}`)
      console.log(`    category:    ${p.category}`)
      console.log(`    categories:  ${JSON.stringify(p.categories)}`)
      console.log(`    image:       ${p.illustration_url ? '✓' : '—'}`)
      console.log(`    created_at:  ${p.created_at}`)
      console.log(`    refs:        garden_plants=${gpCount}, bed_plantings=${bpCount}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
