import Link from 'next/link'
import Image from 'next/image'
import { supabase, type Plant } from '@/lib/supabase'
import { getCurrentGardenId } from '@/lib/currentGarden'
import { getWeeklyTasks } from '@/lib/getWeeklyTasks'
import type {
  PlantedPlantInput,
  Urgency,
  WeeklyTask,
} from '@/lib/weeklyTasks'

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

type SplitPlants = {
  planted: Plant[]
  interested: Plant[]
  plantedForTasks: PlantedPlantInput[]
}

async function getMyPlants(gardenId: string | null): Promise<SplitPlants> {
  if (!gardenId) return { planted: [], interested: [], plantedForTasks: [] }
  const { data, error } = await supabase
    .from('garden_plants')
    .select('planted_at, plants(*)')
    .eq('garden_id', gardenId)
    .order('plant_id')

  if (error) {
    console.error('Error fetching garden plants:', error)
    return { planted: [], interested: [], plantedForTasks: [] }
  }

  const planted: Plant[] = []
  const interested: Plant[] = []
  const plantedForTasks: PlantedPlantInput[] = []
  for (const row of data ?? []) {
    const r = row as { planted_at: string | null; plants: Plant | Plant[] | null }
    const plantList: Plant[] = Array.isArray(r.plants)
      ? r.plants
      : r.plants
      ? [r.plants]
      : []
    if (r.planted_at) {
      planted.push(...plantList)
      for (const p of plantList) {
        plantedForTasks.push({
          plant_id: p.id,
          name: p.name,
          category: p.category,
          planted_at: r.planted_at,
          saatzeit: p.saatzeit ?? '',
          vorzucht: p.vorzucht ?? '',
          schneiden: p.schneiden ?? '',
          ernte: p.ernte ?? '',
          einjaehrig_oder_mehrjaehrig: p.einjaehrig_oder_mehrjaehrig ?? '',
        })
      }
    } else {
      interested.push(...plantList)
    }
  }

  const byName = (a: Plant, b: Plant) => a.name.localeCompare(b.name, 'de')
  planted.sort(byName)
  interested.sort(byName)

  return { planted, interested, plantedForTasks }
}

function urgencyPill(u: Urgency): { bg: string; fg: string; label: string } {
  if (u === 'jetzt') {
    return { bg: '#FDE8E2', fg: '#C17B5C', label: 'JETZT' }
  }
  if (u === 'diese_woche') {
    return { bg: '#E8F1EA', fg: '#4A7C59', label: 'DIESE WOCHE' }
  }
  return { bg: '#F0EFEA', fg: '#888780', label: 'DEMNÄCHST' }
}

function WeeklyTasksSection({ tasks }: { tasks: WeeklyTask[] }) {
  if (tasks.length === 0) return null
  return (
    <section
      className="mb-6 bg-white rounded-xl border p-4"
      style={{ borderColor: '#E8E6DF' }}
    >
      <h2
        className="text-base font-medium mb-3"
        style={{ color: '#2C2C2A' }}
      >
        📋 Diese Woche
      </h2>
      <div className="space-y-3">
        {tasks.map((t, i) => {
          const pill = urgencyPill(t.urgency)
          return (
            <Link
              key={`${t.plant_id}-${i}`}
              href={`/plants/${t.plant_id}`}
              className="block rounded-lg p-3 transition-all duration-200 active:scale-[0.98]"
              style={{ backgroundColor: '#FAFAF7' }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded px-2 py-1 mt-0.5"
                  style={{ backgroundColor: pill.bg, color: pill.fg }}
                >
                  {pill.label}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-sm font-medium leading-snug"
                    style={{ color: '#2C2C2A' }}
                  >
                    {t.task}
                  </div>
                  <div
                    className="text-sm leading-snug mt-1"
                    style={{ color: '#888780' }}
                  >
                    {t.why}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function PlantCard({ plant }: { plant: Plant }) {
  return (
    <Link href={`/plants/${plant.id}`} className="block">
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
  )
}

export default async function Home() {
  const gardenId = await getCurrentGardenId()
  const { planted, interested, plantedForTasks } = await getMyPlants(gardenId)
  const total = planted.length + interested.length

  const weeklyTasks =
    gardenId && plantedForTasks.length > 0
      ? await getWeeklyTasks(gardenId, plantedForTasks)
      : { tasks: [] }

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

        <WeeklyTasksSection tasks={weeklyTasks.tasks} />

        <Link
          href="/empfehlungen"
          className="block mb-6 rounded-xl p-4 text-center transition-all duration-200 active:scale-95"
          style={{
            backgroundColor: '#FFFFFF',
            border: '2px dashed #4A7C59',
            color: '#4A7C59',
          }}
        >
          <span className="text-base font-medium">🌿 Was kann ich pflanzen? →</span>
        </Link>

        {total === 0 ? (
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
          <div className="space-y-8">
            {planted.length > 0 && (
              <section>
                <h2
                  className="text-xs font-medium uppercase tracking-wide mb-3"
                  style={{ color: '#888780' }}
                >
                  Im Garten 🌱
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {planted.map((p) => <PlantCard key={p.id} plant={p} />)}
                </div>
              </section>
            )}

            {interested.length > 0 && (
              <section>
                <h2
                  className="text-xs font-medium uppercase tracking-wide mb-3"
                  style={{ color: '#888780' }}
                >
                  Meine Samen
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {interested.map((p) => <PlantCard key={p.id} plant={p} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
