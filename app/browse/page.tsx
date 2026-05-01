import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentGardenId } from '@/lib/currentGarden'
import SearchFilter from './SearchFilter'

export const dynamic = 'force-dynamic'

export default async function BrowsePage() {
  const gardenId = await getCurrentGardenId()
  const supabase = supabaseAdmin()

  const { data: plants } = await supabase
    .from('plants')
    .select('*')
    .order('name')

  let inGardenIds: string[] = []
  if (gardenId) {
    const { data: gp } = await supabase
      .from('garden_plants')
      .select('plant_id')
      .eq('garden_id', gardenId)
    inGardenIds = (gp ?? []).map((row) => row.plant_id as string)
  }

  return (
    <div className="min-h-screen px-4 py-6 pb-12" style={{ backgroundColor: '#FAFAF7' }}>
      <div className="w-full max-w-md mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm font-medium" style={{ color: '#4A7C59' }}>
            ← Mein Garten
          </Link>
          <h1 className="text-base font-medium" style={{ color: '#2C2C2A' }}>
            Pflanzen-Katalog
          </h1>
          <span className="w-16" />
        </header>

        <SearchFilter plants={plants ?? []} inGardenIds={inGardenIds} />
      </div>
    </div>
  )
}
