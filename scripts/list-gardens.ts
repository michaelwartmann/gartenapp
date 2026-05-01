import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

async function main() {
  const { data, error } = await supabase
    .from('gardens')
    .select('owner_name, location_label, zip_code, created_at')
    .order('created_at', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    console.error(error)
    process.exit(1)
  }
  console.log(JSON.stringify(data, null, 2))
}

main()
