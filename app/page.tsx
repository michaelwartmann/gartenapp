import { supabase, Plant } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'

async function getPlants(): Promise<Plant[]> {
  const { data, error } = await supabase
    .from('plants')
    .select('*')
    .order('name')
  
  if (error) {
    console.error('Error fetching plants:', error)
    return []
  }
  
  return data || []
}

export default async function Home() {
  const plants = await getPlants()

  return (
    <div className="min-h-screen px-4 py-6 pb-8" style={{ backgroundColor: '#FAFAF7' }}>
      <div className="w-full max-w-md mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-xl text-gray-600">🌱 Gartenapp</h1>
        </header>
        
        <div className="grid grid-cols-2 gap-4">
          {plants.map((plant) => (
            <Link key={plant.id} href={`/plants/${plant.id}`} className="block">
              <div 
                className="bg-white rounded-xl border overflow-hidden transition-all duration-200 hover:shadow-sm active:scale-95 min-h-[200px] touch-none"
                style={{ borderColor: '#E8E6DF' }}
              >
                <div className="aspect-square relative">
                  <Image
                    src={plant.illustration_url}
                    alt={plant.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 480px) 50vw, 200px"
                  />
                </div>
                <div className="p-4">
                  <h2 className="font-medium text-base leading-tight" style={{ color: '#2C2C2A' }}>
                    {plant.name}
                  </h2>
                  <p className="text-sm mt-1 leading-tight" style={{ color: '#888780' }}>
                    {plant.latin_name}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
