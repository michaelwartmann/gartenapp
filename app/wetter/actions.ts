'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getCurrentGardenId } from '@/lib/currentGarden'
import { geocodeZip, type CountryCode } from '@/lib/weather'
import { clearWeatherCache } from '@/lib/getWeatherForGarden'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

const VALID_COUNTRIES: CountryCode[] = ['DE', 'AT', 'CH', 'NL']

export type SetupLocationResult =
  | { ok: true; label: string }
  | { error: 'no-garden' | 'invalid' | 'not-found' | 'server' }

export async function setupGardenLocation(
  zip: string,
  country: string
): Promise<SetupLocationResult> {
  const cleanZip = zip.trim()
  const cc = country.trim().toUpperCase() as CountryCode
  if (!cleanZip || !VALID_COUNTRIES.includes(cc)) {
    return { error: 'invalid' }
  }
  const gardenId = await getCurrentGardenId()
  if (!gardenId) return { error: 'no-garden' }

  const geo = await geocodeZip(cleanZip, cc)
  if (!geo) return { error: 'not-found' }

  const supabase = adminClient()
  const { error } = await supabase
    .from('gardens')
    .update({
      zip_code: geo.zip,
      country_code: geo.country,
      latitude: geo.lat,
      longitude: geo.lng,
      location_label: geo.label,
      // Bust the weather cache so the next page load fetches for the new spot
      weather_cache: null,
      weather_cache_at: null,
    })
    .eq('id', gardenId)
  if (error) {
    console.error('setupGardenLocation update failed:', error)
    return { error: 'server' }
  }
  revalidatePath('/')
  return { ok: true, label: geo.label }
}

export async function clearGardenLocation(): Promise<{ ok: true } | { error: 'no-garden' | 'server' }> {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) return { error: 'no-garden' }
  const supabase = adminClient()
  const { error } = await supabase
    .from('gardens')
    .update({
      zip_code: null,
      country_code: null,
      latitude: null,
      longitude: null,
      location_label: null,
      weather_cache: null,
      weather_cache_at: null,
    })
    .eq('id', gardenId)
  if (error) {
    console.error('clearGardenLocation failed:', error)
    return { error: 'server' }
  }
  await clearWeatherCache(gardenId)
  revalidatePath('/')
  return { ok: true }
}
