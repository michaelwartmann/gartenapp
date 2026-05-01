// Pure Open-Meteo + Zippopotam wrappers. No DB, no caching here.

const GEOCODE_TIMEOUT_MS = 10_000
const FORECAST_TIMEOUT_MS = 15_000

export type GeocodeResult = {
  zip: string
  country: string
  lat: number
  lng: number
  label: string
}

export type CountryCode = 'DE' | 'AT' | 'CH' | 'NL'

export const COUNTRY_LABELS: Record<CountryCode, string> = {
  DE: 'Deutschland',
  AT: 'Österreich',
  CH: 'Schweiz',
  NL: 'Niederlande',
}

export async function geocodeZip(
  zip: string,
  country: CountryCode = 'DE'
): Promise<GeocodeResult | null> {
  const cleaned = zip.trim()
  if (!cleaned) return null
  const cc = country.toLowerCase()
  const url = `https://api.zippopotam.us/${cc}/${encodeURIComponent(cleaned)}`
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      'post code'?: string
      'country abbreviation'?: string
      places?: Array<{
        'place name'?: string
        latitude?: string
        longitude?: string
        state?: string
      }>
    }
    const place = data.places?.[0]
    if (!place || !place.latitude || !place.longitude) return null
    const lat = Number(place.latitude)
    const lng = Number(place.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    const label = [place['place name'], place.state].filter(Boolean).join(', ')
    return {
      zip: data['post code'] ?? cleaned,
      country: data['country abbreviation'] ?? country,
      lat,
      lng,
      label: label || cleaned,
    }
  } catch (err) {
    console.error('geocodeZip failed:', err)
    return null
  }
}

export type DailyForecast = {
  date: string // ISO YYYY-MM-DD
  tmin: number // °C
  tmax: number // °C
  precip_mm: number
  wind_gust_max: number // km/h
  weather_code: number
  uv_max: number
}

export type HourlyForecast = {
  time: string // ISO with hour
  date: string // YYYY-MM-DD
  hour: number // 0-23
  temp: number
  precip_mm: number
  wind_gust: number
  weather_code: number
}

export type Forecast = {
  daily: DailyForecast[]
  hourly: HourlyForecast[]
  fetchedAt: string
  timezone: string
}

export async function fetchForecast(
  lat: number,
  lng: number
): Promise<Forecast | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily:
      'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max,weather_code,uv_index_max',
    hourly: 'temperature_2m,precipitation,wind_gusts_10m,weather_code',
    timezone: 'auto',
    forecast_days: '7',
  })
  const url = `https://api.open-meteo.com/v1/forecast?${params}`
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FORECAST_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      timezone?: string
      daily?: {
        time?: string[]
        temperature_2m_max?: number[]
        temperature_2m_min?: number[]
        precipitation_sum?: number[]
        wind_gusts_10m_max?: number[]
        weather_code?: number[]
        uv_index_max?: number[]
      }
      hourly?: {
        time?: string[]
        temperature_2m?: number[]
        precipitation?: number[]
        wind_gusts_10m?: number[]
        weather_code?: number[]
      }
    }

    const daily: DailyForecast[] = []
    const dt = data.daily
    if (dt?.time) {
      for (let i = 0; i < dt.time.length; i++) {
        daily.push({
          date: dt.time[i],
          tmin: dt.temperature_2m_min?.[i] ?? 0,
          tmax: dt.temperature_2m_max?.[i] ?? 0,
          precip_mm: dt.precipitation_sum?.[i] ?? 0,
          wind_gust_max: dt.wind_gusts_10m_max?.[i] ?? 0,
          weather_code: dt.weather_code?.[i] ?? 0,
          uv_max: dt.uv_index_max?.[i] ?? 0,
        })
      }
    }

    const hourly: HourlyForecast[] = []
    const ht = data.hourly
    if (ht?.time) {
      for (let i = 0; i < ht.time.length; i++) {
        const t = ht.time[i] // 2026-05-01T14:00
        const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})/.exec(t)
        if (!m) continue
        hourly.push({
          time: t,
          date: m[1],
          hour: Number(m[2]),
          temp: ht.temperature_2m?.[i] ?? 0,
          precip_mm: ht.precipitation?.[i] ?? 0,
          wind_gust: ht.wind_gusts_10m?.[i] ?? 0,
          weather_code: ht.weather_code?.[i] ?? 0,
        })
      }
    }

    return {
      daily,
      hourly,
      fetchedAt: new Date().toISOString(),
      timezone: data.timezone ?? 'auto',
    }
  } catch (err) {
    console.error('fetchForecast failed:', err)
    return null
  }
}

// WMO Weather Codes → Emoji + short label
const CODE_MAP: Record<number, { icon: string; label: string }> = {
  0: { icon: '☀️', label: 'klar' },
  1: { icon: '🌤️', label: 'meist klar' },
  2: { icon: '⛅', label: 'wolkig' },
  3: { icon: '☁️', label: 'bedeckt' },
  45: { icon: '🌫️', label: 'Nebel' },
  48: { icon: '🌫️', label: 'Reifnebel' },
  51: { icon: '🌦️', label: 'Niesel' },
  53: { icon: '🌦️', label: 'Niesel' },
  55: { icon: '🌦️', label: 'starker Niesel' },
  61: { icon: '🌧️', label: 'Regen' },
  63: { icon: '🌧️', label: 'Regen' },
  65: { icon: '🌧️', label: 'Starkregen' },
  71: { icon: '🌨️', label: 'Schnee' },
  73: { icon: '🌨️', label: 'Schnee' },
  75: { icon: '🌨️', label: 'Schnee' },
  80: { icon: '🌦️', label: 'Schauer' },
  81: { icon: '🌧️', label: 'Schauer' },
  82: { icon: '⛈️', label: 'starke Schauer' },
  95: { icon: '⛈️', label: 'Gewitter' },
  96: { icon: '⛈️', label: 'Gewitter, Hagel' },
  99: { icon: '⛈️', label: 'Gewitter, Hagel' },
}

export function describeWeatherCode(code: number): {
  icon: string
  label: string
} {
  return CODE_MAP[code] ?? { icon: '·', label: '' }
}
