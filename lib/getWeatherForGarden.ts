import { createClient } from '@supabase/supabase-js'
import { fetchForecast, type Forecast } from './weather'

const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export type GardenLocation = {
  id: string
  zip_code: string | null
  country_code: string | null
  latitude: number | null
  longitude: number | null
  location_label: string | null
}

export type WeatherForGarden = {
  hasLocation: boolean
  forecast: Forecast | null
  location: GardenLocation | null
}

export async function getWeatherForGarden(
  gardenId: string
): Promise<WeatherForGarden> {
  const supabase = adminClient()
  const { data: garden } = await supabase
    .from('gardens')
    .select(
      'id, zip_code, country_code, latitude, longitude, location_label, weather_cache, weather_cache_at'
    )
    .eq('id', gardenId)
    .maybeSingle()

  type Row = GardenLocation & {
    weather_cache: unknown
    weather_cache_at: string | null
  }
  const g = garden as Row | null

  if (!g) {
    return { hasLocation: false, forecast: null, location: null }
  }

  const location: GardenLocation = {
    id: g.id,
    zip_code: g.zip_code,
    country_code: g.country_code,
    latitude: g.latitude,
    longitude: g.longitude,
    location_label: g.location_label,
  }

  if (
    !g.latitude ||
    !g.longitude ||
    g.latitude === null ||
    g.longitude === null
  ) {
    return { hasLocation: false, forecast: null, location }
  }

  // Cache hit?
  if (g.weather_cache && g.weather_cache_at) {
    const age = Date.now() - new Date(g.weather_cache_at).getTime()
    if (
      age < CACHE_TTL_MS &&
      g.weather_cache &&
      typeof g.weather_cache === 'object'
    ) {
      return {
        hasLocation: true,
        forecast: g.weather_cache as Forecast,
        location,
      }
    }
  }

  // Fetch fresh
  const fresh = await fetchForecast(
    Number(g.latitude),
    Number(g.longitude)
  )
  if (!fresh) {
    // Fall back to stale cache if present
    if (g.weather_cache && typeof g.weather_cache === 'object') {
      return {
        hasLocation: true,
        forecast: g.weather_cache as Forecast,
        location,
      }
    }
    return { hasLocation: true, forecast: null, location }
  }

  await supabase
    .from('gardens')
    .update({
      weather_cache: fresh,
      weather_cache_at: new Date().toISOString(),
    })
    .eq('id', gardenId)

  return { hasLocation: true, forecast: fresh, location }
}

// Public: invalidate the weather cache (e.g. after location change)
export async function clearWeatherCache(gardenId: string): Promise<void> {
  const supabase = adminClient()
  await supabase
    .from('gardens')
    .update({ weather_cache: null, weather_cache_at: null })
    .eq('id', gardenId)
}
