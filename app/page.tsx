import Link from 'next/link'
import { supabaseAdmin, type Plant } from '@/lib/supabase'
import { getCurrentGardenId } from '@/lib/currentGarden'
import { getWeeklyTasks } from '@/lib/getWeeklyTasks'
import { getWeatherForGarden } from '@/lib/getWeatherForGarden'
import { detectEvents, nearTermEvents } from '@/lib/weatherEvents'
import WeatherStrip from './wetter/WeatherStrip'
import WeatherSetup from './wetter/WeatherSetup'
import MyGardenSections from './MyGardenSections'
import type {
  PlantedPlantInput,
  Urgency,
  WeeklyTask,
} from '@/lib/weeklyTasks'

export const dynamic = 'force-dynamic'

type BedRef = { kind: string; label: string }

type SplitPlants = {
  planted: Plant[]
  interested: Plant[]
  plantedForTasks: PlantedPlantInput[]
  bedsByPlant: Map<string, BedRef[]>
}

async function getMyPlants(gardenId: string | null): Promise<SplitPlants> {
  if (!gardenId) {
    return {
      planted: [],
      interested: [],
      plantedForTasks: [],
      bedsByPlant: new Map(),
    }
  }
  const supabase = supabaseAdmin()
  const yearNow = new Date().getFullYear()

  const [gpRes, bedsRes] = await Promise.all([
    supabase
      .from('garden_plants')
      .select('planted_at, plants(*)')
      .eq('garden_id', gardenId)
      .order('plant_id'),
    supabase
      .from('bed_plantings')
      .select('plant_id, beds!inner(garden_id, label, kind)')
      .eq('season_year', yearNow)
      .order('created_at', { ascending: true }),
  ])

  if (gpRes.error) {
    console.error('Error fetching garden plants:', gpRes.error)
    return {
      planted: [],
      interested: [],
      plantedForTasks: [],
      bedsByPlant: new Map(),
    }
  }

  type BedJoinRow = {
    plant_id: string
    beds:
      | { garden_id: string; label: string; kind: string }
      | Array<{ garden_id: string; label: string; kind: string }>
      | null
  }
  const bedsByPlant = new Map<string, BedRef[]>()
  for (const row of (bedsRes.data ?? []) as BedJoinRow[]) {
    const b = Array.isArray(row.beds) ? row.beds[0] : row.beds
    if (!b || b.garden_id !== gardenId) continue
    const list = bedsByPlant.get(row.plant_id) ?? []
    // Dedupe (same plant in same bed twice would otherwise show twice)
    if (!list.some((x) => x.label === b.label && x.kind === b.kind)) {
      list.push({ kind: b.kind, label: b.label })
    }
    bedsByPlant.set(row.plant_id, list)
  }

  const planted: Plant[] = []
  const interested: Plant[] = []
  const plantedForTasks: PlantedPlantInput[] = []
  for (const row of gpRes.data ?? []) {
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

  return { planted, interested, plantedForTasks, bedsByPlant }
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

// PlantCard + BedLine moved into MyGardenSections.tsx — only used inside
// the now-client-component grid. Keep KIND_ICON / categoryColor inlined
// in MyGardenSections so we don't share them via top-level page.tsx.

export default async function Home() {
  const gardenId = await getCurrentGardenId()
  const { planted, interested, plantedForTasks, bedsByPlant } = await getMyPlants(gardenId)
  const total = planted.length + interested.length

  const weather = gardenId
    ? await getWeatherForGarden(gardenId)
    : { hasLocation: false, forecast: null, location: null }

  const weatherEvents = weather.forecast ? detectEvents(weather.forecast) : []
  const weatherWarnings = nearTermEvents(weatherEvents)

  const weeklyTasks =
    gardenId && plantedForTasks.length > 0
      ? await getWeeklyTasks(gardenId, plantedForTasks, weather.forecast)
      : { tasks: [] }

  return (
    <div className="min-h-screen px-4 py-6 pb-12" style={{ backgroundColor: '#FAFAF7' }}>
      <div className="w-full max-w-md mx-auto">
        <header className="mb-6 flex items-center justify-between gap-2">
          <h1 className="text-xl text-gray-600 truncate">🌱 Mein Garten</h1>
          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href="/garten/plan"
              className="text-sm font-medium px-2.5 py-2 rounded-lg border touch-manipulation"
              style={{ borderColor: '#4A7C59', color: '#4A7C59' }}
              aria-label="Garten-Plan"
            >
              🗺️
            </Link>
            <Link
              href="/garten/bilanz"
              className="text-sm font-medium px-2.5 py-2 rounded-lg border touch-manipulation"
              style={{ borderColor: '#4A7C59', color: '#4A7C59' }}
              aria-label="Bilanz"
            >
              📊
            </Link>
            <Link
              href="/browse"
              className="text-sm font-medium px-3 py-2 rounded-lg touch-manipulation"
              style={{ backgroundColor: '#4A7C59', color: '#FFFFFF' }}
            >
              + Pflanzen
            </Link>
          </div>
        </header>

        {weather.hasLocation && weather.forecast ? (
          <WeatherStrip
            forecast={weather.forecast}
            locationLabel={weather.location?.location_label ?? null}
            events={weatherEvents}
            warnings={weatherWarnings}
          />
        ) : (
          <WeatherSetup />
        )}

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
              className="inline-block px-6 py-3 rounded-xl font-medium text-white touch-manipulation"
              style={{ backgroundColor: '#4A7C59' }}
            >
              Pflanzen durchsuchen
            </Link>
          </div>
        ) : (
          <MyGardenSections
            planted={planted}
            interested={interested}
            bedsByPlant={Object.fromEntries(bedsByPlant)}
          />
        )}
      </div>
    </div>
  )
}
