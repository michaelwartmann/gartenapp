import Link from 'next/link'
import Image from 'next/image'
import { supabase, type Plant } from '@/lib/supabase'
import { getCurrentGardenId } from '@/lib/currentGarden'

export const dynamic = 'force-dynamic'

function categoryColor(cat: string): string {
  switch (cat) {
    case 'Gemüse': return '#4A7C59'
    case 'Kraut': return '#C17B5C'
    case 'Blume': return '#8B5A95'
    case 'Obst': return '#D49C3D'
    default: return '#888780'
  }
}

async function getMyPlants(gardenId: string | null): Promise<Plant[]> {
  if (!gardenId) return []
  const { data, error } = await supabase
    .from('garden_plants')
    .select('plants(*)')
    .eq('garden_id', gardenId)
    .order('plant_id')

  if (error) {
    console.error('Error fetching garden plants:', error)
    return []
  }

  // Flatten the joined plants. Supabase returns plants either as object or array
  // depending on FK detection; handle both shapes.
  const plants: Plant[] = []
  for (const row of data ?? []) {
    const p = (row as { plants: Plant | Plant[] | null }).plants
    if (Array.isArray(p)) plants.push(...p)
    else if (p) plants.push(p)
  }
  // Sort by display name
  plants.sort((a, b) => a.name.localeCompare(b.name, 'de'))
  return plants
}

export default async function Home() {
  const gardenId = await getCurrentGardenId()
  const plants = await getMyPlants(gardenId)

  return (
    <div className="min-h-screen px-4 py-6 pb-12" style={{ backgroundColor: '#FAFAF7' }}>
      <div className="w-full max-w-md mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-xl text-gray-600">🌱 Mein Garten</h1>
          <Link
            href="/browse"
            className="text-sm font-medium px-3 py-2 rounded-lg touch-none"
            style={{ backgroundColor: '#4A7C59', color: '#FFFFFF' }}
          >
            + Pflanzen
          </Link>
        </header>

        {plants.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="text-5xl mb-4">🌱</div>
            <h2 className="text-lg font-medium mb-2" style={{ color: '#2C2C2A' }}>
              Dein Garten ist noch leer.
            </h2>
            <p className="text-sm mb-6" style={{ color: '#888780' }}>
              Stöbere im Pflanzen-Katalog und füge Pflanzen hinzu, die du anbauen möchtest.
            </p>
            <Link
              href="/browse"
              className="inline-block px-6 py-3 rounded-xl font-medium text-white touch-none"
              style={{ backgroundColor: '#4A7C59' }}
            >
              Pflanzen durchsuchen
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {plants.map((plant) => (
              <Link key={plant.id} href={`/plants/${plant.id}`} className="block">
                <div
                  className="bg-white rounded-xl border overflow-hidden transition-all duration-200 active:scale-95 min-h-[200px]"
                  style={{ borderColor: '#E8E6DF' }}
                >
                  <div className="aspect-square relative" style={{ backgroundColor: '#FAFAF7' }}>
                    {plant.illustration_url ? (
                      <Image
                        src={plant.illustration_url}
                        alt={plant.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 480px) 50vw, 200px"
                      />
                    ) : (
                      <div
                        className="absolute inset-0 flex items-center justify-center text-4xl"
                        style={{
                          backgroundColor: categoryColor(plant.category) + '22',
                          color: categoryColor(plant.category),
                        }}
                      >
                        🌱
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h2 className="font-medium text-base leading-tight" style={{ color: '#2C2C2A' }}>
                      {plant.name}
                    </h2>
                    <p className="text-sm mt-1 leading-tight italic" style={{ color: '#888780' }}>
                      {plant.latin_name}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
